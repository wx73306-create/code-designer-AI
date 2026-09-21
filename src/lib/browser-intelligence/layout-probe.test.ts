/**
 * Layout Probe — 单测
 *
 * 测的是 Node 侧纯函数（`buildLayoutResult` / `inferSectionRole` / `countColumns` /
 * `filterSections`），不需要真实浏览器 —— 这正是「语义判断不藏在 evaluate 里」
 * 这一分层原则换来的可测性。
 */

import { describe, it, expect } from 'vitest';

import type { PageController } from './types';
import type { RawLayoutProbe, RawSection } from './layout-probe';
import {
  DEFAULT_MIN_SECTION_HEIGHT,
  buildLayoutResult,
  countColumns,
  filterSections,
  inferSectionRole,
  normalizeAlignment,
  probeLayout,
} from './layout-probe';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VIEWPORT = { width: 1440, height: 900 };

function section(over: Partial<RawSection> = {}): RawSection {
  return {
    selector: 'section',
    tag: 'section',
    className: '',
    id: '',
    top: 0,
    left: 0,
    height: 100,
    width: 1440,
    textAlign: 'left',
    childCount: 0,
    childTops: [],
    ...over,
  };
}

function raw(sections: RawSection[], over: Partial<RawLayoutProbe> = {}): RawLayoutProbe {
  return {
    sections,
    docHeight: 1000,
    viewport: VIEWPORT,
    stickyHeader: false,
    ...over,
  };
}

/**
 * 假页面：`evaluate` 直接吐出预置几何。
 *
 * 识别采集脚本的方式与既有 FakePage 一致（看 `fn.toString()` 里的特征串）——
 * 这里用 `scrollHeight`，因为它是浏览器侧采集独有的。
 */
class FakePage implements PageController {
  url: string;

  constructor(private readonly probe: RawLayoutProbe, home = 'https://apple.com') {
    this.url = home;
  }

  async goto(url: string): Promise<void> {
    this.url = url;
  }

  async evaluate<T>(fn: string | (() => T)): Promise<T> {
    const src = typeof fn === 'string' ? fn : fn.toString();
    if (src.includes('scrollHeight')) return this.probe as unknown as T;
    return undefined as unknown as T;
  }

  async screenshot(): Promise<string> {
    return '';
  }

  async setViewport(): Promise<void> {
    // no-op
  }

  async close(): Promise<void> {
    // no-op
  }
}

// ---------------------------------------------------------------------------
// 1. 高度占比与像素高度
// ---------------------------------------------------------------------------

describe('heightWeight / heightPx', () => {
  it('按文档总高换算占比，并同时给出像素高度', () => {
    const result = buildLayoutResult(
      raw([
        section({ top: 0, height: 300 }),
        section({ top: 300, height: 600 }),
        section({ top: 900, height: 100 }),
      ]),
    );

    expect(result.flow.map((b) => b.heightWeight)).toEqual([30, 60, 10]);
    expect(result.flow.map((b) => b.heightPx)).toEqual([300, 600, 100]);
  });

  it('docHeight 为 0 时占比全部归零，不抛错', () => {
    const result = buildLayoutResult(
      raw([section({ height: 300 })], { docHeight: 0 }),
    );

    expect(result.flow[0].heightWeight).toBe(0);
    // 像素高度是实测值，不受 docHeight 影响
    expect(result.flow[0].heightPx).toBe(300);
  });

  it('长页面上百分比会退化，但 heightPx 仍然可用（这正是加该字段的理由）', () => {
    const result = buildLayoutResult(
      raw([section({ height: 900 })], { docHeight: 9000 }),
    );

    expect(result.flow[0].heightWeight).toBe(10);
    expect(result.flow[0].heightPx).toBe(900);
  });
});

// ---------------------------------------------------------------------------
// 2. 列数
// ---------------------------------------------------------------------------

describe('countColumns', () => {
  it('三个子元素 top 相同 → 3 列', () => {
    expect(countColumns([100, 100, 100], 8)).toBe(3);
  });

  it('子元素 top 相差 200px → 1 列', () => {
    expect(countColumns([100, 300, 500], 8)).toBe(1);
  });

  it('两行各两个 → 2 列', () => {
    expect(countColumns([100, 100, 300, 300], 8)).toBe(2);
  });

  it('无子元素 → 1 列', () => {
    expect(countColumns([], 8)).toBe(1);
  });

  it('容差内的小抖动仍算同一行', () => {
    expect(countColumns([100, 103, 106], 8)).toBe(3);
  });

  it('超出容差则不算同一行', () => {
    expect(countColumns([100, 120], 8)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. 过滤与去嵌套
// ---------------------------------------------------------------------------

describe('filterSections', () => {
  it('低于 minSectionHeight 的区块被丢弃', () => {
    const result = buildLayoutResult(
      raw([section({ height: 30 }), section({ top: 100, height: 200 })]),
      { minSectionHeight: DEFAULT_MIN_SECTION_HEIGHT },
    );

    expect(result.flow).toHaveLength(1);
    expect(result.flow[0].heightPx).toBe(200);
  });

  it('嵌套在内部的区块被跳过（不管高度差多大）', () => {
    const outer = section({ top: 0, height: 500 });
    const inner = section({ top: 100, height: 200 });

    expect(filterSections([outer, inner], DEFAULT_MIN_SECTION_HEIGHT)).toEqual([outer]);
  });

  it('main 这类纯容器被排除，避免与内部区块重复计算', () => {
    const main = section({ tag: 'main', top: 0, height: 5000 });
    const hero = section({ top: 200, height: 800, className: 'hero' });

    expect(filterSections([main, hero], DEFAULT_MIN_SECTION_HEIGHT)).toEqual([hero]);
  });

  it('同 top 同高视为重复，只保留一个', () => {
    const a = section({ top: 0, height: 500 });
    const b = section({ top: 0, height: 500 });

    expect(filterSections([a, b], DEFAULT_MIN_SECTION_HEIGHT)).toHaveLength(1);
  });

  it('真机回归：占比之和不得超过 100（Apple 曾达 200%）', () => {
    // 复刻 Apple 的真实结构：<main> 容器包住 hero / product，尾部还有 footer
    const result = buildLayoutResult(
      raw(
        [
          section({ tag: 'main', top: 0, height: 9000 }),
          section({ top: 0, height: 1000, className: 'hero' }),
          section({ top: 1000, height: 2000, className: 'feature' }),
          section({ top: 3000, height: 1000, className: 'product' }),
          section({ top: 9000, height: 1000, tag: 'footer' }),
        ],
        { docHeight: 10000 },
      ),
    );

    const sum = result.flow.reduce((acc, b) => acc + b.heightWeight, 0);

    // 容器被排除、区块互不重叠 → 总和必然 ≤ 100
    expect(sum).toBeLessThanOrEqual(100);
    expect(result.flow.map((b) => b.role)).toEqual(['hero', 'feature', 'product', 'footer']);
  });
});

// ---------------------------------------------------------------------------
// 4. 通栏 / 对齐 / 顺序 / 截断
// ---------------------------------------------------------------------------

describe('布局属性', () => {
  it('宽度等于视口宽 → 通栏', () => {
    const result = buildLayoutResult(raw([section({ width: 1440 })]));
    expect(result.flow[0].fullBleed).toBe(true);
  });

  it('宽度明显小于视口宽 → 非通栏', () => {
    const result = buildLayoutResult(raw([section({ width: 1200 })]));
    expect(result.flow[0].fullBleed).toBe(false);
  });

  it('textAlign 归一化：start / justify 落到 left，end 落到 right', () => {
    expect(normalizeAlignment('start')).toBe('left');
    expect(normalizeAlignment('justify')).toBe('left');
    expect(normalizeAlignment('end')).toBe('right');
    expect(normalizeAlignment('center')).toBe('center');
    expect(normalizeAlignment('')).toBe('left');
  });

  it('按文档顺序（top 升序）输出', () => {
    const result = buildLayoutResult(
      raw([
        section({ top: 900, height: 100, className: 'c' }),
        section({ top: 0, height: 100, className: 'a' }),
        section({ top: 300, height: 100, className: 'b' }),
      ]),
    );

    expect(result.flow.map((b) => b.heightPx)).toEqual([100, 100, 100]);
    expect(result.flow[0].role).toBe('other');
  });

  it('超出 maxSections 的部分被截断', () => {
    const many = Array.from({ length: 20 }, (_, i) => section({ top: i * 100, height: 100 }));
    const result = buildLayoutResult(raw(many), { maxSections: 5 });

    expect(result.flow).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// 5. 角色推断
// ---------------------------------------------------------------------------

describe('inferSectionRole', () => {
  it('识别 hero', () => {
    expect(inferSectionRole('section', 'hero-banner', '')).toBe('hero');
  });

  it('识别 nav', () => {
    expect(inferSectionRole('nav', 'globalnav', '')).toBe('nav');
  });

  it('header 标签落到 nav', () => {
    expect(inferSectionRole('header', '', '')).toBe('nav');
  });

  it('footer 优先于 nav —— 页脚里常有 nav 字样', () => {
    expect(inferSectionRole('footer', 'footer-nav', '')).toBe('footer');
  });

  it('id 也能参与判定', () => {
    expect(inferSectionRole('section', '', 'pricing')).toBe('pricing');
  });

  it('认不出来 → other（不猜）', () => {
    expect(inferSectionRole('div', 'asdkjh', '')).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// 6. 派生字段
// ---------------------------------------------------------------------------

describe('gridColumns / centered / stickyHeader', () => {
  it('gridColumns 取主内容区（跳过 nav 与 footer）的列数', () => {
    const result = buildLayoutResult(
      raw([
        section({ top: 0, height: 80, tag: 'nav', className: 'nav' }),
        section({ top: 80, height: 500, className: 'features', childTops: [100, 100, 100, 100] }),
        section({ top: 580, height: 200, tag: 'footer', className: 'footer' }),
      ]),
    );

    expect(result.gridColumns).toBe(4);
  });

  it('左右余量相等 → centered', () => {
    const result = buildLayoutResult(
      raw([section({ top: 0, height: 500, left: 120, width: 1200 })], { viewport: VIEWPORT }),
    );

    expect(result.centered).toBe(true);
  });

  it('左右余量不等 → 不居中', () => {
    const result = buildLayoutResult(
      raw([section({ top: 0, height: 500, left: 0, width: 1200 })], { viewport: VIEWPORT }),
    );

    expect(result.centered).toBe(false);
  });

  it('stickyHeader 原样透传', () => {
    const result = buildLayoutResult(raw([section()], { stickyHeader: true }));
    expect(result.stickyHeader).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. 端到端：probeLayout + FakePage
// ---------------------------------------------------------------------------

describe('probeLayout（FakePage 端到端）', () => {
  it('从假页面读出几何并组装成 flow', async () => {
    const page = new FakePage(
      raw(
        [
          section({ top: 0, height: 72, tag: 'nav', className: 'globalnav' }),
          // hero 有 2 个子元素 —— 它是「第一个非 nav/footer」，即主内容区，
          // 所以 gridColumns 取的是它，而不是后面的 features
          section({ top: 72, height: 920, className: 'hero', childTops: [100, 100] }),
          section({ top: 992, height: 400, className: 'features', childTops: [1000, 1000, 1000] }),
        ],
        { docHeight: 1392 },
      ),
    );

    const result = await probeLayout(page);

    expect(result.flow).toHaveLength(3);
    expect(result.flow[0].role).toBe('nav');
    expect(result.flow[1].role).toBe('hero');
    expect(result.flow[1].heightPx).toBe(920);
    expect(result.flow[1].columns).toBe(2);
    expect(result.flow[2].columns).toBe(3);
    // 主内容区 = hero
    expect(result.gridColumns).toBe(2);
    expect(result.docHeight).toBe(1392);
  });

  it('浏览器未返回任何 section → flow 为空数组（unknown，不猜）', async () => {
    const page = new FakePage(raw([]));

    const result = await probeLayout(page);

    expect(result.flow).toEqual([]);
    expect(result.gridColumns).toBe(0);
  });
});
