/**
 * 真机验收脚本 — Sprint 3 Animation Interaction Recovery
 * ===================================================================
 * 用法：
 *   npm run verify:sprint3 -- https://apple.com
 *   npm run verify:sprint3 -- https://apple.com https://linear.app https://stripe.com
 *   npm run verify:sprint3 -- https://apple.com --with-llm   # 额外真实调用一次模型
 *
 * 验的是「交互数据有没有真的进入 Agent 的输入」：
 *   1. 采集 → WebsitePackage.interaction
 *   2. 三个 Agent 各自的 prompt 片段（states / event / full）
 *   3. 回归：不采集时 prompt 里不能出现任何「交互」痕迹
 *
 * `--with-llm` 会真的调一次 animation step，看生成的 GSAP 代码里有没有
 * 「点击 → 菜单展开」这类行为（而不只是入场动画）。这需要 MIMO_API_KEY。
 *
 * 为什么单测不够：单测的 interaction 是手造的，真机上 Apple 的菜单按钮
 * 没有 textContent、Linear 的菜单是 hover 触发 —— 这些只有真跑才知道。
 */

import fs from 'node:fs';
import path from 'node:path';

const VIEWPORT = { width: 1440, height: 900 };
const OUT_ROOT = path.resolve(process.cwd(), '.verify-sprint3');

/** 采集开关必须在 import 采集模块之前设好（模块内会读 process.env）。 */
process.env.INTERACTION_CAPTURE = 'on';

/**
 * 载入 `.env`。
 *
 * 本脚本是裸 node 跑的，不像 Next.js 那样自动加载 .env —— 不加这段，
 * `--with-llm` 会因为读不到 MIMO_API_KEY 而静默跳过（第一次跑就踩了）。
 */
function loadEnv(): void {
  if (process.env.MIMO_API_KEY) return;
  try {
    const file = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
      if (!m || m[1].startsWith('#')) continue;
      if (process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* 读不到就走跳过分支 */
  }
}

async function main(): Promise<void> {
  loadEnv();

  const { getInteractionPackage } = await import('@/lib/browser-intelligence/interaction-cache');
  const { buildWebsitePackage, formatPackageContext } = await import('@/lib/website-package');
  const { buildAnimationUserMessage } = await import('@/lib/animation');
  const { scrapeWebsite } = await import('@/lib/website-scraper');

  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const withLlm = process.argv.includes('--with-llm');
  /** 对照组：**不采集** interaction，用于对比「以前 vs 现在」生成差异。 */
  const baseline = process.argv.includes('--baseline');
  const urls = args.length > 0 ? args : ['https://apple.com'];
  const suffix = baseline ? '.baseline' : '';

  fs.mkdirSync(OUT_ROOT, { recursive: true });

  for (const url of urls) {
    console.log(`\n${'='.repeat(70)}\n=== ${url} ===\n${'='.repeat(70)}`);
    const started = Date.now();

    let scraped = null;
    try {
      scraped = await scrapeWebsite(url);
    } catch (err) {
      console.warn(`  [warn] scrape 失败: ${err instanceof Error ? err.message : err}`);
    }

    const interaction = baseline ? null : await getInteractionPackage(url, { viewport: VIEWPORT });
    const captureMs = Date.now() - started;

    if (!interaction && !baseline) {
      console.log('  ❌ 未采到 interaction（开关未开 / 浏览器不可用 / 站点拦截）');
      continue;
    }

    const pkg = buildWebsitePackage({ scraped, interaction: interaction ?? undefined });
    // 对照组：**不传** interaction，用于验证「未采集时链路行为完全一致」
    const pkgOff = buildWebsitePackage({ scraped });

    if (baseline) {
      console.log('  [baseline 模式] 不采集 interaction —— 用于对比「以前 vs 现在」');
    } else {
      console.log(`  采集耗时 ${captureMs}ms · clicks=${interaction!.clicks.length}` +
        ` · 有效=${interaction!.clicks.filter((c) => c.changed).length}` +
        ` · states=${interaction!.states.length} · degraded=${interaction!.meta.degraded ?? 'none'}`);
    }

    // ---- 三个 Agent 的 prompt ----
    const planning = formatPackageContext(pkg, { interactionLevel: 'states' });
    const code = formatPackageContext(pkg, { interactionLevel: 'event' });
    const animation = buildAnimationUserMessage({ pkg, mode: 'clone' });

    // 对照组：同一份 scraped，但不带 interaction
    const planningOff = formatPackageContext(pkgOff, { interactionLevel: 'states' });
    const codeOff = formatPackageContext(pkgOff, { interactionLevel: 'event' });
    const animationOff = buildAnimationUserMessage({ pkg: pkgOff, mode: 'clone' });

    // baseline 模式下这三段本就不该出现，只做回归校验
    if (!baseline) {
      report('planning (states)', planning, ['需要多状态的组件']);
      report('code (event)', code, ['交互行为', 'event: click']);
      report('animation (full)', animation, ['交互采集', 'click ']);
    }

    // ---- 回归：不采集时不能有交互痕迹 ----
    // ⚠️ 必须拿**对照组**比（pkgOff）。拿带采集的 planning 比是恒真的废检查。
    const leftovers = [
      animationOff.includes('交互采集') ? 'animation' : '',
      planningOff.includes('需要多状态的组件') ? 'planning' : '',
      codeOff.includes('交互行为') ? 'code' : '',
    ].filter(Boolean);
    console.log(
      `\n  回归（未采集时无交互痕迹）: ${leftovers.length === 0 ? '✅ 干净' : `❌ ${leftovers.join('/')} 有残留`}`,
    );

    // ---- 可选：真实调用一次模型 ----
    if (withLlm) {
      await runLlm(url, animation, suffix);
    }

    const host = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '_');
      fs.writeFileSync(
        path.join(OUT_ROOT, `${host}${suffix}.prompts.md`),
      [
        `# ${url}`,
        '',
        '## planning (states)',
        '```',
        extractInteractionSection(planning),
        '```',
        '',
        '## code (event)',
        '```',
        extractInteractionSection(code),
        '```',
        '',
        '## animation (full) — 交互段',
        '```',
        extractInteractionSection(animation),
        '```',
      ].join('\n'),
    );
  }

  console.log(`\n产物目录：${OUT_ROOT}`);
}

function report(label: string, text: string, needles: string[]): void {
  const hit = needles.filter((n) => text.includes(n));
  const ok = hit.length === needles.length;
  console.log(`\n  [${ok ? '✅' : '❌'}] ${label} — 命中 ${hit.length}/${needles.length}`);
  if (!ok) {
    console.log(`      缺少: ${needles.filter((n) => !hit.includes(n)).join(', ')}`);
  }
  const section = extractInteractionSection(text);
  if (section) {
    console.log('      --- 交互段 ---');
    for (const line of section.split('\n').slice(0, 12)) console.log(`      ${line}`);
  }
}

/**
 * 从完整 prompt 里截出**交互相关**段落，便于人工核对。
 *
 * ⚠️ 不要把「原站动效检测结果」也算进来 —— 那是 CSS 静态解析段，
 * 截它会让人误以为交互数据没进去（第一次跑就踩了这个展示坑）。
 */
function extractInteractionSection(text: string): string {
  const lines = text.split('\n');
  const isHeading = (l: string): boolean => /^#{2,3} /.test(l);
  const isInteractionHeading = (l: string): boolean =>
    isHeading(l) && /(交互|冲突信号|需要多状态)/.test(l);

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isInteractionHeading(lines[i])) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (isHeading(lines[j])) {
        end = j;
        break;
      }
    }
    out.push(lines.slice(i, end).join('\n').trim());
    i = end - 1;
  }
  return out.length > 0 ? out.join('\n\n') : '(无交互段)';
}

/** 真实调用一次 animation step，看生成的 GSAP 里有没有交互行为。 */
async function runLlm(url: string, prompt: string, suffix = ''): Promise<void> {
  const apiUrl = process.env.MIMO_API_URL;
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiUrl || !apiKey) {
    console.log('\n  [skip] --with-llm：缺少 MIMO_API_URL / MIMO_API_KEY');
    return;
  }

  console.log('\n  --- 真实调用 animation step ---');
  try {
    const res = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.MIMO_MODEL || 'mimo-v2.5',
        messages: [
          { role: 'system', content: 'You are a GSAP animation engineer. Return ONLY a fenced JavaScript block.' },
          { role: 'user', content: prompt },
        ],
        // ⚠️ 必须给足：该模型会先输出 reasoning_content，token 预算被思考过程
        // 吃掉后 content 就是空串（第一次用 4096 跑，返回 200 但 0 字符）。
        max_tokens: 16384,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      console.log(`  ❌ 调用失败 ${res.status}`);
      return;
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? '';
    const host = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '_');
    fs.writeFileSync(path.join(OUT_ROOT, `${host}${suffix}.gsap.js`), content);

    const hasClick = /click|onClick|addEventListener/.test(content);
    const hasEntrance = /from\(|fromTo\(/.test(content);
    console.log(`  生成 ${content.length} 字符 → ${path.join(OUT_ROOT, `${host}.gsap.js`)}`);
    console.log(`  含点击/事件绑定: ${hasClick ? '✅' : '❌'} · 含入场动画: ${hasEntrance ? '✅' : '❌'}`);
  } catch (err) {
    console.log(`  ❌ 调用异常: ${err instanceof Error ? err.message : err}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
