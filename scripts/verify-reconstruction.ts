/**
 * Reconstruction Truth Test — 真机验收
 * ===================================================================
 * Phase 2 / Sprint B。用法：
 *
 *   npm run verify:reconstruction
 *
 * ## Step 2 判据（renderHtmlScreenshot）
 *
 * | # | 场景                                    | 期望                                            |
 * |---|-----------------------------------------|-------------------------------------------------|
 * | 1 | buildPreviewHtml() 产出的 HTML（真 CDN）| status = success，探针通过，截图非空             |
 * | 2 | 把 CDN 域名换成不可达地址                | status = degraded，reason = tailwind-cdn-unavailable |
 * | 3 | 空字符串                                | status = failed，reason = empty-document         |
 * | 4 | 自包含 HTML（无 CDN，内联 <style>）     | status = success（不该被误判成 degraded）        |
 *
 * ## Step 3 判据（captureScreenshotPair 双截图链路）
 *
 * | # | 场景                          | 期望                                                    |
 * |---|-------------------------------|----------------------------------------------------------|
 * | 1 | 客户端复用原站截图（主路径）  | originalSource = client，originalMs ≈ 0，clone success   |
 * | 2 | 服务端兜底采集原站（fallback）| originalSource = server，两张图都非空                    |
 * | 3 | clone 渲染降级                | 链路不抛错，render.status = degraded 照常返回            |
 *
 * 端到端耗时目标：主路径（client 复用）< 8s。
 *
 * ## Step 6 判据（决定性证据：quality ≠ reconstruction）
 *
 *   npm run verify:reconstruction -- --proof
 *
 * | 实验 | 操作                                            | 预期                          |
 * |------|-------------------------------------------------|-------------------------------|
 * | E0   | 同一输入两次 runReconstruction                  | score 一致（确定性）          |
 * | E1   | Apple 基线                                      | 记录 Q0 / R0                  |
 * | E2   | 同时改三处：hero→1/3、主色→紫、删所有图片       | Δreconstruction ≥ 15，Δquality ≤ 8 |
 * | E2-a | 只改 hero 高度 → 1/3                            | heightProfile 单项下降        |
 * | E2-b | 只改主色 → 紫                                   | colorTokens 单项下降          |
 * | E2-c | 只删图片                                        | mediaDensity 单项下降         |
 * | E3   | 同一 clone，换原站 apple.com → stripe.com       | reconstruction 明显低，quality 基本不动 |
 *
 * 主判据（冻结文档 §8.3）：**E2 或 E3 任一同时满足「Δreconstruction ≥ 15」且
 * 「Δquality ≤ 8」即 PASS**。实测不满足时如实记录，**不得为了数字好看调整权重**。
 *
 * `--proof` 只跑 Step 6（Step 2/3/5 已在前面各自验收过，不重复烧时间）。
 *
 * 产物落在 `.verify-reconstruction/`（已 gitignore）。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { buildPreviewHtml } from '@/lib/preview-utils';
import { renderHtmlScreenshot } from '@/lib/render-preview';
import {
  captureScreenshotPair,
  getOriginalFingerprints,
  runReconstruction,
  type SideFingerprints,
} from '@/lib/reconstruction';
import { callMiMoStream } from '@/lib/mimo';
import {
  buildVisualEvaluationSystemPrompt,
  buildVisualEvaluationUserMessage,
  normalizeVisualScore,
} from '@/lib/visual-evaluation';
import { mockGeneratedCode } from '@/lib/mock-data';
import type { RenderResult, RenderStatus } from '@/types/reconstruction';

const OUT_DIR = '.verify-reconstruction';

/** Step 3 / Step 5 的原站对照目标。 */
const TARGET_URL = 'https://apple.com';

/**
 * Step 6 E3「交叉对比」的第二个原站。
 *
 * 冻结文档写的是「用 Linear 的克隆页去跟 Apple 的原站比」——那需要一份 Linear
 * 克隆产物。本项目 mock 库里只有 Apple 一份，所以把实验**对偶地**改成
 * 「同一份 Apple 克隆页，分别跟 Apple 原站 和 Stripe 原站 比」：
 * clone 侧完全不变（唯一变量是原站），比原方案的变量更少、更干净。
 */
const CROSS_URL = 'https://stripe.com';

/** `npm run verify:reconstruction -- --proof` → 只跑 Step 6 决定性证据。 */
const PROOF_MODE = process.argv.includes('--proof');

interface Case {
  name: string;
  html: () => string;
  expect: RenderStatus;
  expectReason?: RenderResult['reason'];
}

/** 把 Tailwind CDN 换成一个不可达的地址，模拟「外网不通」。 */
const UNREACHABLE_CDN = 'https://cdn.tailwindcss.invalid.example';

/** 苹果克隆的 mock 产物 —— Step 2 / Step 3 共用。 */
function applePreviewHtml(): string {
  return buildPreviewHtml(mockGeneratedCode);
}

const CASES: Case[] = [
  {
    name: '1. buildPreviewHtml() 真实产物（含 Tailwind CDN）',
    html: applePreviewHtml,
    expect: 'success',
  },
  {
    name: '2. CDN 域名不可达（模拟断网）',
    html: () => applePreviewHtml().replace(/https:\/\/cdn\.tailwindcss\./g, UNREACHABLE_CDN),
    expect: 'degraded',
    expectReason: 'tailwind-cdn-unavailable',
  },
  {
    name: '3. 空字符串',
    html: () => '',
    expect: 'failed',
    expectReason: 'empty-document',
  },
  {
    name: '4. 自包含 HTML（无 CDN，内联 style）',
    html: () =>
      `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
      `<style>body{margin:0;font-family:system-ui;background:#111;color:#eee}` +
      `.hero{height:80vh;display:flex;align-items:center;justify-content:center;font-size:64px}` +
      `.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:48px}` +
      `.card{padding:24px;background:#222;border-radius:16px}` +
      `</style></head><body>` +
      `<div class="hero">Code Designer AI — 这是一个自包含页面的渲染测试，用于确认没有 CDN 依赖时不会被误判为降级。</div>` +
      `<div class="grid">` +
      `<div class="card">布局还原</div><div class="card">视觉 token</div><div class="card">资源密度</div>` +
      `</div></body></html>`,
    expect: 'success',
  },
];

// ---------------------------------------------------------------------------
// Step 6 —— 对齐克隆构造器 + 变异器（三组单变量 + 一处合并）
// ---------------------------------------------------------------------------

/**
 * 按原站指纹构造一个「结构对齐」的克隆页（内联 style，自包含无 CDN）。
 *
 * ## 为什么不用 mock Apple 页做 E1/E2（第一轮实测的教训）
 *
 * 第一轮用 mock 模板页做基线，R0 = 50 —— 基线本身就是「烂」的：
 *   - E2-a（hero→1/3）落进**地板效应**：heightProfile 基线已是 0，无从再降；
 *   - E2-b（主色→紫）撞上**算法盲区**：apple.com 纯灰度 → 原站主色 undefined →
 *     「一边有主色一边没有 → 罚满 1」成为常数，clone 主色怎么变都吞掉；
 *   - E2-c（删图）Δ=1.3 × 权重 0.10 = 0.13 分，四舍五入后总分不动。
 * 在 50 分的地板上做破坏实验没有区分度。用户原话是「同一个生成页面
 * quality 90 / reconstruction 60 可能存在」—— 需要先高还原、再破坏。
 *
 * 这里的构造器让 clone 与原站的 flow 逐块对齐（role / 高度 / 列数 / 对齐），
 * 实测 R0 = 91。破坏它，下降空间才真实。
 */
function buildAlignedClone(orig: SideFingerprints): string {
  const svgDot =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="12" height="12"%3E%3Crect width="12" height="12" fill="%23d2d2d7"/%3E%3C/svg%3E';
  const img = () => `<img src="${svgDot}" width="12" height="12" alt="">`;
  const svg = () => `<svg width="3" height="3" xmlns="http://www.w3.org/2000/svg"></svg>`;
  const video = () => `<video muted playsinline></video>`;

  const body: string[] = [];

  for (const b of orig.layout.flow) {
    const align =
      b.alignment === 'center'
        ? 'text-align:center;'
        : b.alignment === 'right'
          ? 'text-align:right;'
          : 'text-align:left;';
    const h = b.heightPx ?? 400;
    if (b.role === 'nav') {
      body.push(
        `<nav style="height:${h}px;display:flex;justify-content:space-between;align-items:center;padding:0 16px;">` +
          `<div style="display:flex;gap:24px;">${svg()}${svg()}</div>` +
          `<div style="display:flex;gap:24px;">${svg()}${svg()}</div>` +
          `</nav>`,
      );
    } else if (b.role === 'footer') {
      let inner = '';
      for (let i = 0; i < 60; i++) {
        inner += `<p style="font-size:12px;color:#6e6e73;">Footer line ${i} — fine print paragraph.</p>`;
      }
      body.push(
        `<footer style="min-height:${h}px;padding:19px 16px;">` +
          `<div style="display:grid;grid-template-columns:1fr;gap:8px;">${inner}</div>` +
          `<div style="display:flex;gap:16px;">${img()}${img()}${img()}</div>` +
          `</footer>`,
      );
    } else if (b.role === 'hero') {
      body.push(
        `<section class="hero" style="height:${h}px;${align}padding:19px 16px;">` +
          `<h1 style="font-size:34px;color:#1d1d1f;">Apple Special Event</h1>` +
          `<p style="font-size:17px;color:#6e6e73;">September. A new era.</p>` +
          `</section>`,
      );
    } else if (b.columns >= 2) {
      const cols = Math.min(b.columns, 4);
      const cells = Array.from(
        { length: cols },
        () =>
          `<div style="background:#fff;padding:12px;">${img()}<h2 style="font-size:34px;">Block</h2>` +
          `<p style="font-size:17px;">Description text.</p></div>`,
      ).join('');
      body.push(
        `<section style="height:${h}px;${align}padding:12px 16px;background:rgba(245,245,247,0.8);">` +
          `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px;height:100%;">${cells}</div>` +
          `</section>`,
      );
    } else {
      const cls = b.role === 'product' ? ' class="product"' : '';
      body.push(
        `<section${cls} style="height:${h}px;${align}padding:12px 16px;">` +
          `<h2 style="font-size:34px;color:#1d1d1f;">${b.role === 'product' ? 'Product' : 'Section'}</h2>` +
          `<p style="font-size:17px;color:#6e6e73;">Overview paragraph.</p>` +
          `<div>${img()}</div>` +
          `</section>`,
      );
    }
  }

  // 补齐媒体数量到与原站一致（img/svg/video），全部放首屏之下（heroMedia 不掺水）
  const fill =
    `<div style="height:1px;overflow:hidden;margin-top:12px;">` +
    Array.from({ length: 120 }, (_, i) => (i % 2 === 0 ? img() : svg())).join('') +
    `</div>` +
    video() +
    video();

  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif;` +
    `background:#fff;color:#1d1d1f;font-size:17px;">` +
    body.join('\n') +
    fill +
    `</body></html>`
  );
}

/**
 * E2-a：只改 hero 高度 → 1/3，其余一律不动。
 * 对齐克隆的 hero 是内联 style 高度，直接改值（不用 mock 版的 class 锚点）。
 */
function mutateAlignedHeroHeight(html: string, targetPx: number): string {
  if (!/class="hero" style="height:\d+px/.test(html)) {
    throw new Error('mutateAlignedHeroHeight: 找不到 hero 锚点（构造器变了）');
  }
  return html.replace(/(class="hero" style="height:)\d+(px)/, `$1${targetPx}$2`);
}

/**
 * E2-b：只改主色 → 紫色，其余一律不动。
 *
 * 给 hero 加紫色大面积背景 + 替换 2col 区块的灰底。
 * colorTokens 的有效通路：基线两侧都无主色（全灰度）→ 不产出 primary；
 * 改紫后 clone 有主色、原站仍无 → 走「一边有主色罚满 1」→ colorTokens 100 → 66.7。
 * （mock 版失败正是卡在这一步 —— 见 buildAlignedClone 的注释。）
 */
function mutateAlignedColor(html: string): string {
  return html
    .replace(/class="hero" style="/, 'class="hero" style="background:#7C3AED;')
    .replace(/background:rgba\(245,245,247,0\.8\)/g, 'background:#7C3AED');
}

/** E2-c：只删所有图片（img + svg），video 保留。 */
function dropAllImages(html: string): string {
  return html.replace(/<img\b[^>]*>/g, '').replace(/<svg\b[^>]*>([\s\S]*?)<\/svg>/g, '');
}

/**
 * 走**生产同一条 QA 链路**取 quality 分。
 *
 * 刻意与 `src/app/api/mimo/route.ts` 的 qa 分支保持同口径：
 * system prompt + user message（含 diff 报告）+ 两张截图（VL）。
 * 只有同口径，测出来的「quality 与 reconstruction 是不是两件事」才有意义。
 *
 * 解析策略也照抄 route.ts 的三段式（裸 JSON → ```json 块 → 首个 {...} 配平）。
 */
async function askQualityScore(input: {
  label: string;
  previewHtml: string;
  originalBase64: string;
  cloneBase64: string;
  diffReportJson?: string;
}): Promise<{ score: number | null; raw: string }> {
  const systemPrompt = buildVisualEvaluationSystemPrompt();
  const userMessage = buildVisualEvaluationUserMessage(
    input.previewHtml,
    '', // designAnalysisSummary：验证脚本不跑 vision，留空
    '', // designSystemSummary：同上
    undefined,
    input.diffReportJson ?? '',
  );

  const images = [input.originalBase64, input.cloneBase64].filter((s) => s.length > 100);
  if (images.length < 2) {
    return { score: null, raw: '（缺少两张截图，跳过 quality 调用）' };
  }

  const stream = await callMiMoStream(systemPrompt, userMessage, { images });
  const reader = stream.getReader();
  let acc = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.content) acc += value.content;
  }

  const parsed = parseLooseJson(acc);
  if (parsed === null) return { score: null, raw: acc };

  const score = normalizeVisualScore(parsed, 1).overall_score;
  return { score, raw: acc };
}

/** 照抄 route.ts 的三段式 JSON 抽取（裸 JSON → 代码块 → 首个 {...} 配平）。 */
function parseLooseJson(text: string): unknown | null {
  const trimmed = text.trim();
  const attempts: string[] = [];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) attempts.push(trimmed);

  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) attempts.push(codeBlock[1].trim());

  const first = trimmed.search(/[{[]/);
  if (first !== -1) {
    const candidate = trimmed.slice(first);
    const open = candidate[0];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    for (let i = 0; i < candidate.length; i++) {
      if (candidate[i] === open) depth++;
      if (candidate[i] === close) depth--;
      if (depth === 0) {
        attempts.push(candidate.slice(0, i + 1));
        break;
      }
    }
  }

  for (const a of attempts) {
    try {
      return JSON.parse(a);
    } catch {
      // 试下一个
    }
  }
  return null;
}

// ---------------------------------------------------------------------------

function saveShot(name: string, base64: string): void {
  if (base64.length === 0) return;
  const slug = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/-+$/, '');
  writeFileSync(join(OUT_DIR, `${slug}.png`), Buffer.from(base64, 'base64'));
}

async function main() {
  const log: string[] = [];
  const failures: string[] = [];
  let passed = 0;
  let total = 0;

  const say = (s: string) => {
    console.log(s);
    log.push(s);
  };

  const judge = (name: string, problems: string[]): boolean => {
    total++;
    const ok = problems.length === 0;
    if (ok) passed++;
    else failures.push(...problems.map((p) => `${name}: ${p}`));
    for (const p of problems) say(`  ❌ ${p}`);
    return ok;
  };

  mkdirSync(OUT_DIR, { recursive: true });

  // `--proof` 只跑 Step 6（决定性证据），不重复烧 Step 2/3/5 的时间
  if (PROOF_MODE) {
    await runStep6Proof({ say, judge });
    finish(log, passed, total, failures);
    return;
  }

  // =====================================================================
  // Step 2 — renderHtmlScreenshot
  // =====================================================================
  say('======================================================================');
  say('=== Step 2 — renderHtmlScreenshot() 真机验收 ===');
  say('======================================================================');

  for (const c of CASES) {
    const html = c.html();
    const t0 = Date.now();
    const result = await renderHtmlScreenshot(html);
    const ms = Date.now() - t0;

    const problems: string[] = [];
    if (result.status !== c.expect) {
      problems.push(`status 期望 ${c.expect}，实际 ${result.status}`);
    }
    if (c.expectReason && result.reason !== c.expectReason) {
      problems.push(`reason 期望 ${c.expectReason}，实际 ${result.reason}`);
    }
    if (result.status === 'success' && result.screenshot.length === 0) {
      problems.push('success 但截图为空');
    }
    if (result.status === 'success' && result.screenshot.length < 1000) {
      problems.push(`截图过小（${result.screenshot.length} 字符），可能截到了空白页`);
    }

    const sizeKB = Math.round(result.screenshot.length / 1024);
    say(`\n${c.name}`);
    say(
      `  → status=${result.status}${result.reason ? ` reason=${result.reason}` : ''} ` +
        `${ms}ms 截图 ${sizeKB}KB ${problems.length === 0 ? '✅' : '❌'}`,
    );
    judge(c.name, problems);

    saveShot(c.name, result.screenshot);
  }

  // =====================================================================
  // Step 3 — Original / Clone 双截图链路
  // =====================================================================
  say('\n======================================================================');
  say('=== Step 3 — captureScreenshotPair() 双截图链路验收 ===');
  say('======================================================================');

  // ---- 3.1 服务端兜底采集原站（fallback 路径，顺便拿到原站截图给 3.2 复用）----
  {
    const t0 = Date.now();
    const pair = await captureScreenshotPair({ html: applePreviewHtml(), url: TARGET_URL });
    const ms = Date.now() - t0;

    say('\n3.1 服务端兜底采集原站（url 传入，originalScreenshot 缺省）');
    say(
      `  → originalSource=${pair.originalSource} original=${Math.round(pair.original.length / 1024)}KB ` +
        `clone=${pair.render.status}(${Math.round(pair.clone.length / 1024)}KB) total=${ms}ms ` +
        `(clone ${pair.timings.cloneMs}ms + original ${pair.timings.originalMs}ms)`,
    );
    saveShot('3-1-original-server', pair.original);
    saveShot('3-1-clone', pair.clone);

    judge('3.1 服务端兜底', [
      ...(pair.originalSource !== 'server' ? [`originalSource 期望 server，实际 ${pair.originalSource}`] : []),
      ...(pair.original.length === 0 ? ['original 截图为空'] : []),
      ...(pair.clone.length === 0 ? ['clone 截图为空'] : []),
      ...(pair.render.status !== 'success' ? [`clone 渲染期望 success，实际 ${pair.render.status}`] : []),
    ]);
  }

  // ---- 3.2 客户端复用原站截图（主路径：这是真实工作流会走的路径）----
  {
    // 从上一步的产物文件里读回原站截图，模拟「客户端带 originalScreenshot 来」
    const originalBase64 = readShot('3-1-original-server');
    const t0 = Date.now();
    const pair = await captureScreenshotPair({
      html: applePreviewHtml(),
      url: TARGET_URL,
      originalScreenshot: originalBase64,
    });
    const ms = Date.now() - t0;

    say('\n3.2 客户端复用原站截图（主路径）');
    say(
      `  → originalSource=${pair.originalSource} originalMs=${pair.timings.originalMs}ms ` +
        `clone=${pair.render.status} total=${ms}ms ${pair.timings.totalMs < 8000 ? '✅ <8s' : '❌ ≥8s'}`,
    );

    judge('3.2 客户端复用', [
      ...(pair.originalSource !== 'client' ? [`originalSource 期望 client，实际 ${pair.originalSource}`] : []),
      ...(pair.timings.originalMs > 50 ? [`originalMs 期望 ≈0，实际 ${pair.timings.originalMs}ms（主路径不该再采原站）`] : []),
      ...(pair.render.status !== 'success' ? [`clone 渲染期望 success，实际 ${pair.render.status}`] : []),
      ...(pair.timings.totalMs >= 8000 ? [`端到端 ${pair.timings.totalMs}ms ≥ 8s（PASS 判据是 <8s）`] : []),
    ]);
  }

  // ---- 3.3 clone 渲染降级时链路仍完整返回（不抛错、不丢字段）----
  {
    const brokenHtml = applePreviewHtml().replace(/https:\/\/cdn\.tailwindcss\./g, UNREACHABLE_CDN);
    const t0 = Date.now();
    const pair = await captureScreenshotPair({
      html: brokenHtml,
      url: TARGET_URL,
      originalScreenshot: readShot('3-1-original-server'),
    });
    const ms = Date.now() - t0;

    say('\n3.3 clone 渲染降级（链路不抛错，字段完整）');
    say(
      `  → render.status=${pair.render.status} reason=${pair.render.reason ?? '—'} ` +
        `originalSource=${pair.originalSource} total=${ms}ms`,
    );

    judge('3.3 降级链路', [
      ...(pair.render.status !== 'degraded' ? [`render.status 期望 degraded，实际 ${pair.render.status}`] : []),
      ...(pair.render.reason !== 'tailwind-cdn-unavailable'
        ? [`reason 期望 tailwind-cdn-unavailable，实际 ${pair.render.reason ?? '—'}`]
        : []),
      ...(pair.originalSource !== 'client' ? [`originalSource 期望 client（原站截图与 clone 渲染无关）`] : []),
    ]);
  }

  // =====================================================================
  // Step 5 — 完整编排（runReconstruction）+ QA 接入
  // =====================================================================
  say('\n======================================================================');
  say('=== Step 5 — runReconstruction() 完整编排验收 ===');
  say('======================================================================');

  // ---- 5.1 正常路径：mock Apple 页 vs apple.com 原站 ----
  {
    const t0 = Date.now();
    const run = await runReconstruction({ html: applePreviewHtml(), url: TARGET_URL });
    const ms = Date.now() - t0;
    const score = run.score.score;

    say('\n5.1 正常路径（clone=mock Apple 页，original=apple.com）');
    say(
      `  → render=${run.render.status} score=${score ?? 'null'} ` +
        `original=${run.originalSource} total=${ms}ms ` +
        `(clone ${run.timings.cloneMs}ms + original ${run.timings.originalMs}ms)`,
    );
    if (run.score.report) {
      say(`  → 九维: ${JSON.stringify(run.score.dimensions)}`);
      say(`  → notes: ${JSON.stringify(run.score.report.notes?.slice(0, 6) ?? [])}`);
    }
    saveShot('5-1-clone', run.clone);
    saveShot('5-1-original', run.original);

    writeFileSync(
      join(OUT_DIR, 'step5-report.json'),
      JSON.stringify(run.score, null, 2),
      'utf8',
    );

    judge('5.1 正常路径', [
      ...(run.render.status !== 'success' ? [`render 期望 success，实际 ${run.render.status}`] : []),
      ...(score === null ? ['score 为 null（原站真值采集失败？）'] : []),
      ...(score !== null && (score < 0 || score > 100) ? [`score 越界：${score}`] : []),
      ...(!run.score.report ? ['缺少 report（有分就必须有可解释报告）'] : []),
      ...(run.originalSource === 'unavailable' ? ['原站截图不可用'] : []),
    ]);
  }

  // ---- 5.2 渲染降级 → score 必须是 null（不是低分）----
  {
    const brokenHtml = applePreviewHtml().replace(/https:\/\/cdn\.tailwindcss\./g, UNREACHABLE_CDN);
    const run = await runReconstruction({ html: brokenHtml, url: TARGET_URL });

    say('\n5.2 渲染降级（CDN 不可达）');
    say(
      `  → render=${run.render.status} reason=${run.render.reason ?? '—'} ` +
        `score=${run.score.score ?? 'null'}`,
    );

    judge('5.2 降级不产分', [
      ...(run.render.status !== 'degraded' ? [`render 期望 degraded，实际 ${run.render.status}`] : []),
      ...(run.score.score !== null ? [`score 必须为 null，实际 ${run.score.score}（降级不算低分）`] : []),
      ...(run.score.dimensions !== null ? ['dimensions 必须为 null'] : []),
    ]);
  }

  // ---- 5.3 原站真值缺失 → score null（不做部分计分）----
  {
    const run = await runReconstruction({ html: applePreviewHtml() });

    say('\n5.3 无原站 URL（真值缺失）');
    say(
      `  → render=${run.render.status} reason=${run.score.reason ?? '—'} ` +
        `score=${run.score.score ?? 'null'}`,
    );

    judge('5.3 真值缺失不产分', [
      ...(run.score.score !== null ? [`score 必须为 null，实际 ${run.score.score}`] : []),
      ...(run.score.reason !== 'original-layout-unavailable'
        ? [`reason 期望 original-layout-unavailable，实际 ${run.score.reason ?? '—'}`]
        : []),
      ...(run.score.report !== undefined ? ['report 必须为 undefined（不能只靠 style diff 凑报告）'] : []),
    ]);
  }

  finish(log, passed, total, failures);
}

/** 汇总 + 落盘 + 退出（puppeteer 会吊住 event loop，必须显式 exit）。 */
function finish(log: string[], passed: number, total: number, failures: string[]): never {
  log.push('\n======================================================================');
  log.push(`=== 总结果：${passed}/${total} 通过 ===`);
  log.push('======================================================================');
  for (const f of failures) log.push(`  ❌ ${f}`);

  console.log('\n======================================================================');
  console.log(`=== 总结果：${passed}/${total} 通过 ===`);
  console.log('======================================================================');
  for (const f of failures) console.log(`  ❌ ${f}`);

  writeFileSync(
    join(OUT_DIR, 'verify-log.md'),
    `# Reconstruction 真机验收\n\n${log.join('\n')}\n`,
    'utf8',
  );

  process.exit(failures.length === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Step 6 — 决定性证据
// ---------------------------------------------------------------------------

/** 九维分组：用于归因表（哪个维度被哪个改动打下来）。 */
const DIMENSION_KEYS = [
  'roleSequence',
  'heightProfile',
  'blockGeometry',
  'colorTokens',
  'typography',
  'spacing',
  'radius',
  'shadow',
  'mediaDensity',
] as const;

interface ProofCtx {
  say: (s: string) => void;
  judge: (name: string, problems: string[]) => boolean;
}

async function runStep6Proof(ctx: ProofCtx): Promise<void> {
  const { say, judge } = ctx;

  say('======================================================================');
  say('=== Step 6 — 决定性证据：quality ≠ reconstruction ===');
  say('======================================================================');

  // ---- 基线 = 按原站指纹构造的对齐克隆（实测 R0=91，见 buildAlignedClone 注释）----
  const origFp = await getOriginalFingerprints(TARGET_URL);
  if (!origFp) {
    judge('原站真值采集', [`apple.com 指纹采集失败（${TARGET_URL}）`]);
    return;
  }
  const baselineHtml = buildAlignedClone(origFp);
  const heroPx = origFp.layout.flow.find((b) => b.role === 'hero')?.heightPx ?? 0;
  const targetHeroPx = Math.round(heroPx / 3);
  say(`\n对齐克隆基线：hero 实测 ${heroPx}px → 目标 ${targetHeroPx}px（1/3）`);

  // ---- E0 确定性（§8.2）+ E1 基线（复用 E0 第一次跑）----
  const runA = await runReconstruction({ html: baselineHtml, url: TARGET_URL });
  const runB = await runReconstruction({ html: baselineHtml, url: TARGET_URL });

  say('\nE0 确定性（同一输入两次，§8.2）');
  say(
    `  → A: score=${runA.score.score ?? 'null'} render=${runA.render.status} | ` +
      `B: score=${runB.score.score ?? 'null'} render=${runB.render.status}`,
  );
  judge('E0 确定性', [
    ...(runA.render.status !== 'success' ? [`renderStatus 期望 success，实际 ${runA.render.status}`] : []),
    ...(runA.score.score === null ? ['score 为 null（验证无效）'] : []),
    ...(runA.score.score !== runB.score.score
      ? [`两次调用不一致：${runA.score.score} vs ${runB.score.score}`]
      : []),
  ]);

  // ---- E1 基线：Q0 / R0 ----
  const R0 = runA.score.score;
  const dims0 = runA.score.dimensions as unknown as Record<string, number> | null;
  say('\nE1 基线（clone = 对齐克隆，original = apple.com）');
  say(`  → reconstruction R0 = ${R0 ?? 'null'}`);
  const q0 = await askQualityScore({
    label: 'E1',
    previewHtml: baselineHtml,
    originalBase64: runA.original,
    cloneBase64: runA.clone,
    diffReportJson: runA.score.report ? JSON.stringify(runA.score.report) : '',
  });
  say(`  → quality Q0 = ${q0.score ?? 'null'}（生产同口径：两张截图 + diff 报告）`);
  saveShot('6-E1-original', runA.original);
  saveShot('6-E1-clone', runA.clone);

  judge('E1 基线双分存在', [
    ...(R0 === null ? ['reconstruction 为 null'] : []),
    ...(q0.score === null ? ['quality 为 null（MiMo 调用或解析失败）'] : []),
  ]);

  // ---- E2 三处同时破坏 ----
  const brokenHtml = dropAllImages(mutateAlignedColor(mutateAlignedHeroHeight(baselineHtml, targetHeroPx)));
  const run2 = await runReconstruction({ html: brokenHtml, url: TARGET_URL });
  const R1 = run2.score.score;
  const dims1 = run2.score.dimensions as unknown as Record<string, number> | null;
  say('\nE2 三处同时破坏（hero→1/3 + 主色→紫 + 删所有图片）');
  say(`  → reconstruction R1 = ${R1 ?? 'null'}`);
  const q1 = await askQualityScore({
    label: 'E2',
    previewHtml: brokenHtml,
    originalBase64: run2.original,
    cloneBase64: run2.clone,
    diffReportJson: run2.score.report ? JSON.stringify(run2.score.report) : '',
  });
  say(`  → quality Q1 = ${q1.score ?? 'null'}`);
  saveShot('6-E2-original', run2.original);
  saveShot('6-E2-clone', run2.clone);

  const dR_E2 = R0 !== null && R1 !== null ? R0 - R1 : null;
  const dQ_E2 = q0.score !== null && q1.score !== null ? Math.abs(q0.score - q1.score) : null;
  say(`  → Δreconstruction = ${dR_E2 ?? '—'}（目标 ≥ 15）`);
  say(`  → Δquality       = ${dQ_E2 ?? '—'}（目标 ≤ 8）`);

  // ---- E2-a/b/c 单变量归因（只要 reconstruction，不问 quality）----
  const single: Array<{ key: string; label: string; html: string }> = [
    { key: 'a', label: 'E2-a 只改 hero 高度→1/3', html: mutateAlignedHeroHeight(baselineHtml, targetHeroPx) },
    { key: 'b', label: 'E2-b 只改主色→紫', html: mutateAlignedColor(baselineHtml) },
    { key: 'c', label: 'E2-c 只删所有图片', html: dropAllImages(baselineHtml) },
  ];
  const dimsByCase: Record<string, Record<string, number> | null> = {};
  say('\n--- E2-a/b/c 单变量（只跑 reconstruction）---');
  for (const c of single) {
    const r = await runReconstruction({ html: c.html, url: TARGET_URL });
    dimsByCase[c.key] = r.score.dimensions as unknown as Record<string, number> | null;
    say(`  ${c.label}: score=${r.score.score ?? 'null'}`);
    saveShot(`6-E2${c.key}-clone`, r.clone);
  }

  // ---- E3 交叉对比：clone 完全不变，只换原站 ----
  const run3 = await runReconstruction({ html: baselineHtml, url: CROSS_URL });
  const R2 = run3.score.score;
  const dims3 = run3.score.dimensions as unknown as Record<string, number> | null;
  say(`\nE3 交叉对比（clone 不变，original = ${CROSS_URL}）`);
  say(`  → reconstruction R2 = ${R2 ?? 'null'}`);
  const q2 = await askQualityScore({
    label: 'E3',
    previewHtml: baselineHtml,
    originalBase64: run3.original,
    cloneBase64: run3.clone,
    diffReportJson: run3.score.report ? JSON.stringify(run3.score.report) : '',
  });
  say(`  → quality Q2 = ${q2.score ?? 'null'}`);
  saveShot('6-E3-original', run3.original);
  saveShot('6-E3-clone', run3.clone);

  const dR_E3 = R0 !== null && R2 !== null ? R0 - R2 : null;
  const dQ_E3 = q0.score !== null && q2.score !== null ? Math.abs(q0.score - q2.score) : null;
  say(`  → Δreconstruction = ${dR_E3 ?? '—'}（目标 ≥ 15）`);
  say(`  → Δquality       = ${dQ_E3 ?? '—'}（目标 ≤ 8）`);

  // ---- 归因表 ----
  say('\n======================================================================');
  say('=== 九维归因表（E1 基线 / E2 合并 / E2-a / E2-b / E2-c / E3）===');
  say('======================================================================');
  say(`  ${'维度'.padEnd(16)}${'E1'.padStart(7)}${'E2'.padStart(7)}${'E2-a'.padStart(7)}${'E2-b'.padStart(7)}${'E2-c'.padStart(7)}${'E3'.padStart(7)}`);
  for (const k of DIMENSION_KEYS) {
    const cells = [dims0, dims1, dimsByCase.a, dimsByCase.b, dimsByCase.c, dims3].map((d) =>
      d && typeof d[k] === 'number' ? String(Math.round(d[k] * 10) / 10) : '—',
    );
    say(`  ${k.padEnd(16)}${cells.map((c) => c.padStart(7)).join('')}`);
  }

  // ---- 主判据（§8.3）----
  say('\n======================================================================');
  say('=== 主判据（§8.3）：E2 或 E3 任一同时满足 ΔR ≥ 15 且 ΔQ ≤ 8 ===');
  say('======================================================================');
  const e2Pass = dR_E2 !== null && dQ_E2 !== null && dR_E2 >= 15 && dQ_E2 <= 8;
  const e3Pass = dR_E3 !== null && dQ_E3 !== null && dR_E3 >= 15 && dQ_E3 <= 8;
  say(`  E2: ΔR=${dR_E2 ?? '—'} ΔQ=${dQ_E2 ?? '—'} → ${e2Pass ? 'PASS' : '不满足'}`);
  say(`  E3: ΔR=${dR_E3 ?? '—'} ΔQ=${dQ_E3 ?? '—'} → ${e3Pass ? 'PASS' : '不满足'}`);
  say(`  → 结论：${e2Pass || e3Pass ? '✅ quality 与 reconstruction 确实是两个指标' : '❌ 未达成，需如实分析'}`);

  judge('Step 6 主判据', [
    ...(R0 === null || R1 === null || R2 === null ? ['存在 null 分数，对照不成立'] : []),
    ...(q0.score === null || q1.score === null || q2.score === null ? ['存在 null quality，对照不成立'] : []),
    ...(!e2Pass && !e3Pass
      ? [`主判据未达成：E2(ΔR=${dR_E2 ?? '—'},ΔQ=${dQ_E2 ?? '—'}) E3(ΔR=${dR_E3 ?? '—'},ΔQ=${dQ_E3 ?? '—'})`]
      : []),
  ]);

  // ---- 落盘 ----
  writeFileSync(
    join(OUT_DIR, 'step6-proof.json'),
    JSON.stringify(
      {
        targetUrl: TARGET_URL,
        crossUrl: CROSS_URL,
        heroPx,
        targetHeroPx,
        E1: { quality: q0.score, reconstruction: R0, dimensions: dims0, report: runA.score.report ?? null },
        E2: { quality: q1.score, reconstruction: R1, dimensions: dims1, report: run2.score.report ?? null },
        'E2-a': { reconstruction: null, dimensions: dimsByCase.a },
        'E2-b': { reconstruction: null, dimensions: dimsByCase.b },
        'E2-c': { reconstruction: null, dimensions: dimsByCase.c },
        E3: { quality: q2.score, reconstruction: R2, dimensions: dims3, report: run3.score.report ?? null },
        delta: { E2: { dR: dR_E2, dQ: dQ_E2 }, E3: { dR: dR_E3, dQ: dQ_E3 } },
        verdict: { e2Pass, e3Pass, pass: e2Pass || e3Pass },
      },
      null,
      2,
    ),
    'utf8',
  );
}

function readShot(name: string): string {
  const slug = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/-+$/, '');
  try {
    return readFileSync(join(OUT_DIR, `${slug}.png`)).toString('base64');
  } catch {
    return '';
  }
}

void main();
