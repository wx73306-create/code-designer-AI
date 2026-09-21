/**
 * 真机验收脚本 — Sprint 2 Interaction Explorer Layer
 * ===================================================================
 * 用法：
 *   npm run verify:interaction -- https://apple.com
 *   npm run verify:interaction -- https://apple.com https://linear.app
 *
 * 产物落在 `.verify/<host>/`：
 *   interaction.json      —— 交付格式（stateId 引用，不含内联 base64）
 *   states/*.png          —— 点击前后状态截图
 *   screenshots/*.png     —— 滚动分段截图
 *   summary.json          —— 一眼可看的验收摘要
 *
 * 为什么单独一个脚本而不是单测：这里必须连真实浏览器、访问真实站点，
 * 单测里注入的假 PageController 无法暴露「采样点落在 sticky header 上」
 * 这类只有真机才出现的问题（Sprint 1 已踩过一次）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { explorePageInteraction } from '@/lib/browser-intelligence/interaction-explorer';
import { serializeInteraction } from '@/lib/browser-intelligence/interaction-recorder';

const VIEWPORT = { width: 1440, height: 900 };
const OUT_ROOT = path.resolve(process.cwd(), '.verify');

async function run(url: string): Promise<void> {
  const started = Date.now();
  console.log(`\n=== ${url} ===`);

  const result = await explorePageInteraction(url, {
    viewport: VIEWPORT,
    headless: true,
    timeoutMs: 30000,
    // 验收脚本要落盘 screenshots/，所以滚动阶段也内联 base64
    // （生产链路默认不内联 —— 8 张图会撑爆 Vision Agent 的 token 预算）
    inlineScreenshots: true,
  });

  const pkg = result.package;
  const host = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '_');
  const outDir = path.join(OUT_ROOT, host);
  const statesDir = path.join(outDir, 'states');
  const shotsDir = path.join(outDir, 'screenshots');
  fs.mkdirSync(statesDir, { recursive: true });
  fs.mkdirSync(shotsDir, { recursive: true });

  // ---- 落盘截图 ----
  let writtenShots = 0;
  for (const state of pkg.states) {
    const dataUrl = state.screenshot.dataUrl;
    if (!dataUrl) continue;
    const file = path.join(statesDir, `${state.stateId}.png`);
    fs.writeFileSync(file, Buffer.from(dataUrl, 'base64'));
    writtenShots++;
  }
  for (const s of pkg.scrolls) {
    if (!s.screenshot.dataUrl) continue;
    fs.writeFileSync(
      path.join(shotsDir, `${s.screenshot.id}.png`),
      Buffer.from(s.screenshot.dataUrl, 'base64'),
    );
  }

  // ---- interaction.json（不内联 base64）----
  const exportJson = serializeInteraction(pkg, url);
  fs.writeFileSync(path.join(outDir, 'interaction.json'), exportJson);

  const parsed = JSON.parse(exportJson);
  const clicks = parsed.events.filter((e: { type: string }) => e.type === 'click');
  const changed = clicks.filter((c: { changes?: string[] }) => (c.changes?.length ?? 0) > 0);

  // ---- 摘要 ----
  const summary = {
    url,
    elapsedMs: Date.now() - started,
    degraded: result.degraded ?? null,
    candidateCount: result.candidateCount,
    blockedCount: result.blockedCount,
    scrollCount: pkg.scrolls.length,
    clickCount: clicks.length,
    effectiveInteractions: changed.length,
    animationCount: pkg.animations.length,
    stateCount: pkg.states.length,
    screenshotsWritten: writtenShots,
    documentHeight: pkg.meta.documentHeight,
    sectionHints: pkg.scrolls.map((s) => s.sectionHint).filter(Boolean),
    interactions: clicks.map((c: { target?: { selector: string; text?: string }; changes?: string[]; blocked?: string }) => ({
      selector: c.target?.selector ?? '',
      text: (c.target?.text ?? '').slice(0, 40),
      changes: c.changes ?? [],
      blocked: c.blocked ?? null,
    })),
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary, null, 2));
  console.log(`\n产物目录：${outDir}`);
}

const urls = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (urls.length === 0) {
  console.error('用法: npm run verify:interaction -- <url> [<url>...]');
  process.exit(1);
}

for (const u of urls) {
  try {
    await run(u);
  } catch (err) {
    console.error(`[FAIL] ${u}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
