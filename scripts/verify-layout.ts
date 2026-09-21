/**
 * Layout Truth Test — 三站点真机验收
 * ===================================================================
 * Phase 2 / Sprint A。用法：
 *
 *   npm run verify:layout                       # 跑默认三站点
 *   npm run verify:layout -- https://apple.com  # 只跑指定站点
 *
 * ## 判据（Step 0 补充的验收指标）
 *
 * | 站点   | 修复前        | 验收要求                          |
 * |--------|---------------|-----------------------------------|
 * | apple  | `[]`          | hero 必须存在且 `heightPx > 500`  |
 * | stripe | `hero 57%`    | 不得出现 57%（硬编码常量算出来的）|
 * | linear | `nav 100%`    | 不得出现单个区块独占 100%         |
 *
 * 通用判据（三站都适用）：
 *   - 无采集时 `flow` 必须为空数组（unknown，不是 guess）
 *   - 采集后 `flow` 非空
 *   - `heightWeight` 之和 ≤ 100（曾因容器嵌套重复计算达到 200%）
 *
 * 产物落在 `.verify-layout/`（已 gitignore）。
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import { buildWebsitePackage, formatPackageContext } from '@/lib/website-package';
import { scrapeWebsite } from '@/lib/website-scraper';
import {
  getLayoutProbe,
  isLayoutProbeEnabled,
  layoutCacheSize,
  resetLayoutCache,
} from '@/lib/browser-intelligence/layout-cache';
import type { LayoutProbeResult } from '@/lib/browser-intelligence/layout-probe';

const OUT_DIR = '.verify-layout';

interface Target {
  url: string;
  /** 站点专属判据。返回 null 表示通过，返回字符串表示失败原因。 */
  check: (flow: LayoutProbeResult['flow'], probe: LayoutProbeResult) => string | null;
}

const TARGETS: Target[] = [
  {
    url: 'https://apple.com',
    check: (flow) => {
      const hero = flow.find((b) => b.role === 'hero');
      if (!hero) return '未识别到 hero（修复前这里是空数组）';
      if ((hero.heightPx ?? 0) <= 500) {
        return `hero 高度 ${hero.heightPx}px ≤ 500，不像真实 hero`;
      }
      return null;
    },
  },
  {
    url: 'https://stripe.com',
    check: (flow) => {
      // 57% 是 canonical 常量表 26/(4+26+16) 算出来的，出现即说明又回到了猜
      const bogus = flow.find((b) => b.heightWeight === 57);
      if (bogus) return `出现硬编码常量值 57%（${bogus.role}）`;
      return null;
    },
  },
  {
    url: 'https://linear.app',
    check: (flow) => {
      const solo = flow.find((b) => b.heightWeight === 100);
      if (solo) return `单个区块 ${solo.role} 独占 100%`;
      return null;
    },
  },
];

// ---------------------------------------------------------------------------

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/[^a-z0-9.-]/gi, '_');
  }
}

async function run(url: string, check: Target['check'], log: string[]) {
  const say = (s: string) => {
    console.log(s);
    log.push(s);
  };

  say(`\n======================================================================`);
  say(`=== ${url} ===`);
  say(`======================================================================`);

  let scraped;
  try {
    scraped = await scrapeWebsite(url);
  } catch (e) {
    say(`  ✗ scrape 失败: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }

  // ---- BEFORE：未采集 ----
  const before = buildWebsitePackage({ scraped });
  const beforeOk = before.layout.flow.length === 0;
  say(`  [BEFORE 无采集] flow=${JSON.stringify(before.layout.flow)} ${beforeOk ? '✅ unknown' : '❌ 应为 []'}`);

  // ---- AFTER：实测 ----
  process.env.LAYOUT_PROBE = 'on';
  if (!isLayoutProbeEnabled()) {
    say('  ✗ LAYOUT_PROBE 开关未生效');
    return false;
  }

  const t0 = Date.now();
  const probe = await getLayoutProbe(url);
  const ms = Date.now() - t0;

  if (!probe) {
    say('  ✗ 采集失败（返回 null）');
    return false;
  }

  const after = buildWebsitePackage({ scraped, layout: probe });
  const flow = after.layout.flow;

  say(
    `  [AFTER 实测 ${ms}ms] docHeight=${probe.docHeight} ` +
      `viewport=${probe.viewport.width}x${probe.viewport.height}`,
  );

  const sum = flow.reduce((acc, b) => acc + b.heightWeight, 0);
  for (const b of flow) {
    say(
      `   - ${b.role}: ${b.heightWeight}% (${b.heightPx}px) · ` +
        `${b.columns}列 · ${b.alignment}${b.fullBleed ? ' · 通栏' : ''}`,
    );
  }
  say(
    `  gridColumns=${after.layout.gridColumns} ` +
      `sticky=${after.layout.stickyHeader} centered=${after.layout.centered}`,
  );

  // ---- 判定 ----
  const problems: string[] = [];
  if (!beforeOk) problems.push('未采集时 flow 不为空（应为 unknown）');
  if (flow.length === 0) problems.push('实测后 flow 仍为空');
  if (sum > 100) problems.push(`heightWeight 之和 ${sum} > 100（容器嵌套重复计算）`);

  const siteProblem = check(flow, probe);
  if (siteProblem) problems.push(siteProblem);

  if (problems.length === 0) {
    say(`  ✅ PASS（占比之和 ${sum}）`);
  } else {
    for (const p of problems) say(`  ❌ ${p}`);
  }

  // ---- 落档：实际喂给模型的内容 ----
  const ctx = formatPackageContext(after);
  const idx = ctx.indexOf('页面纵向构成');
  const snippet = idx >= 0 ? ctx.slice(idx, idx + 600) : '(未生成页面结构段)';

  mkdirSync(join(OUT_DIR, host(url)), { recursive: true });
  writeFileSync(
    join(OUT_DIR, host(url), 'layout-context.md'),
    `# ${url}\n\n## 实际喂给模型的布局段\n\n\`\`\`\n${snippet}\n\`\`\`\n\n` +
      `## 实测数据\n\n\`\`\`json\n${JSON.stringify(after.layout, null, 2)}\n\`\`\`\n`,
    'utf8',
  );

  return problems.length === 0;
}

/**
 * 开关与缓存行为（Step 4 的真机验收）。
 *
 * 这三个性质决定了「三个 Agent 各调一次 buildWebsitePackage」到底开几次浏览器：
 *   - 默认关闭时必须零开销，否则线上白白多开一次浏览器
 *   - 命中缓存时必须是毫秒级，否则一次生成要付三次 2s
 *   - device 必须参与 key，否则手机端结果会污染桌面端
 */
async function verifySwitchAndCache(log: string[]) {
  const say = (s: string) => {
    console.log(s);
    log.push(s);
  };

  say('\n======================================================================');
  say('=== 开关与缓存（apple.com）===');
  say('======================================================================');

  delete process.env.LAYOUT_PROBE;
  const offEnabled = isLayoutProbeEnabled();
  const offResult = await getLayoutProbe('https://apple.com');
  say(
    `  [默认] enabled=${offEnabled} → ` +
      `${offResult === null ? 'null（零开销）✅' : '有值 ❌'}`,
  );

  // 清掉前面三站点留下的缓存，确保「第一次」真的是冷启动
  resetLayoutCache();
  process.env.LAYOUT_PROBE = 'on';

  const t1 = Date.now();
  const first = await getLayoutProbe('https://apple.com');
  const d1 = Date.now() - t1;

  const t2 = Date.now();
  const second = await getLayoutProbe('https://apple.com');
  const d2 = Date.now() - t2;

  say(`  第一次 ${d1}ms · flow=${first?.flow.length ?? 'null'}`);
  say(`  第二次 ${d2}ms · 命中缓存=${first === second} ${first === second ? '✅' : '❌'}`);
  say(`  缓存条目=${layoutCacheSize()}`);

  const mobile = await getLayoutProbe('https://apple.com', { device: 'mobile' });
  say(
    `  device=mobile → ` +
      `${mobile === first ? '共用缓存 ❌（手机端污染桌面端）' : '独立采集 ✅'}`,
  );
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const targets = args.length
    ? args.map((url) => TARGETS.find((t) => t.url === url) ?? { url, check: () => null })
    : TARGETS;

  mkdirSync(OUT_DIR, { recursive: true });
  const log: string[] = [];
  const results: boolean[] = [];

  for (const t of targets) {
    results.push(await run(t.url, t.check, log));
  }

  await verifySwitchAndCache(log);

  const passed = results.filter(Boolean).length;
  console.log(`\n产物目录：${join(process.cwd(), OUT_DIR)}`);
  console.log(`\n======================================================================`);
  console.log(`Layout Truth Test: ${passed}/${results.length} 通过`);
  console.log(`======================================================================`);

  writeFileSync(join(OUT_DIR, 'report.txt'), log.join('\n'), 'utf8');

  if (passed !== results.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('验收脚本失败:', e);
    process.exitCode = 1;
  })
  .finally(() => process.exit(0));
