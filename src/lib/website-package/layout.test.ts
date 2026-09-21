/**
 * Layout Ground Truth — adapter 行为测试（Phase 2 / Sprint A）
 *
 * ## 历史基线（Step 3.1 固化，Step 3.2 删除）
 *
 * 删除前，`buildFlow()` 对输入
 * `<nav class="globalnav">` + `<section class="hero">` + `<section class="feature">`
 * 的确切输出是：
 *
 * ```json
 * [{"role":"nav","heightWeight":8,"columns":1,"alignment":"left","fullBleed":false},
 *  {"role":"hero","heightWeight":52,"columns":1,"alignment":"center","fullBleed":true},
 *  {"role":"feature","heightWeight":40,"columns":3,"alignment":"left","fullBleed":false}]
 * ```
 *
 * 这三个数字来自硬编码常量表 `nav:4 / hero:26 / feature:20`，归一化后
 * `4/50=8%`、`26/50=52%`、`20/50=40%`，**与真实页面几何毫无关系**——
 * 无论 hero 实际是 200px 还是 2000px，输出都是 52%。
 *
 * 现在这段逻辑已删除，同样的输入必须产出 `flow: []`（unknown）。
 */

import { describe, it, expect } from 'vitest';

import type { ScrapedDesignData } from '@/lib/website-scraper';
import type { LayoutProbeResult } from '@/lib/browser-intelligence/layout-probe';
import { WEBSITE_PACKAGE_VERSION } from '@/types/website-package';
import { buildWebsitePackage } from './adapter';

const SCRAPED: Partial<ScrapedDesignData> = {
  url: 'https://example.com',
  htmlStructure:
    '<nav class="globalnav"></nav><section class="hero"></section><section class="feature"></section>',
  layoutHints: ['hero'],
};

function probe(over: Partial<LayoutProbeResult> = {}): LayoutProbeResult {
  return {
    flow: [
      {
        role: 'hero',
        heightWeight: 12,
        heightPx: 920,
        columns: 2,
        alignment: 'center',
        fullBleed: true,
      },
    ],
    gridColumns: 2,
    stickyHeader: true,
    centered: true,
    viewport: { width: 1440, height: 900 },
    docHeight: 7600,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// 1. 没测过 → unknown（空数组），绝不猜
// ---------------------------------------------------------------------------

describe('未采集时的行为', () => {
  it('flow 必须是空数组，而不是硬编码猜测值', () => {
    const pkg = buildWebsitePackage({ scraped: SCRAPED });

    expect(pkg.layout.flow).toEqual([]);
  });

  it('不再出现历史基线里的假百分比（8 / 52 / 40）', () => {
    const pkg = buildWebsitePackage({ scraped: SCRAPED });
    const weights = pkg.layout.flow.map((b) => b.heightWeight);

    expect(weights).not.toContain(8);
    expect(weights).not.toContain(52);
    expect(weights).not.toContain(40);
  });

  it('flow 中不得出现任何没有实测依据的 heightPx', () => {
    const pkg = buildWebsitePackage({ scraped: SCRAPED });

    for (const block of pkg.layout.flow) {
      expect(block.heightPx).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. 采集过 → 原样写入实测值
// ---------------------------------------------------------------------------

describe('传入实测 layout 时', () => {
  it('flow 与 heightPx 原样写入', () => {
    const pkg = buildWebsitePackage({ scraped: SCRAPED, layout: probe() });

    expect(pkg.layout.flow).toHaveLength(1);
    expect(pkg.layout.flow[0]).toMatchObject({
      role: 'hero',
      heightPx: 920,
      heightWeight: 12,
      columns: 2,
    });
  });

  it('gridColumns / stickyHeader / centered 用实测值', () => {
    const pkg = buildWebsitePackage({ scraped: SCRAPED, layout: probe() });

    expect(pkg.layout.gridColumns).toBe(2);
    expect(pkg.layout.stickyHeader).toBe(true);
    expect(pkg.layout.centered).toBe(true);
  });

  it('实测出的「负结果」必须保留，不能被正则兜底覆盖', () => {
    const pkg = buildWebsitePackage({
      scraped: SCRAPED,
      layout: probe({ gridColumns: 0, stickyHeader: false, centered: false }),
    });

    // 0 列 / 非吸顶 / 非居中 都是有效的实测结论
    expect(pkg.layout.gridColumns).toBe(0);
    expect(pkg.layout.stickyHeader).toBe(false);
    expect(pkg.layout.centered).toBe(false);
  });

  it('空 flow 的实测结果也原样保留（测了但没识别到）', () => {
    const pkg = buildWebsitePackage({
      scraped: SCRAPED,
      layout: probe({ flow: [] }),
    });

    expect(pkg.layout.flow).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. 协议兼容性
// ---------------------------------------------------------------------------

describe('协议', () => {
  it('版本为 1.2.0', () => {
    expect(WEBSITE_PACKAGE_VERSION).toBe('1.2.0');
  });

  it('老数据无 heightPx 字段时不受影响（向后兼容）', () => {
    // 模拟一份按 1.1.0 序列化的老数据反序列化后喂进来
    const legacy = {
      role: 'hero' as const,
      heightWeight: 30,
      columns: 1,
      alignment: 'left' as const,
      fullBleed: true,
    };

    const pkg = buildWebsitePackage({
      scraped: SCRAPED,
      layout: probe({ flow: [legacy] }),
    });

    expect(pkg.layout.flow[0].heightPx).toBeUndefined();
    expect(pkg.layout.flow[0].heightWeight).toBe(30);
  });

  it('不传 layout 时其余字段仍走正则兜底，不受影响', () => {
    const pkg = buildWebsitePackage({ scraped: SCRAPED });

    expect(pkg.layout.breakpoints).toEqual([]);
    expect(typeof pkg.layout.stickyHeader).toBe('boolean');
    expect(typeof pkg.layout.centered).toBe('boolean');
  });
});
