import { describe, it, expect } from 'vitest';
import { computeScrollSteps, exploreScroll } from '@/lib/browser-intelligence/scroll-explorer';
import { buildStatesFromScrolls, buildInteractionFromScrolls, appendState } from '@/lib/browser-intelligence/state-capture';
import { DEFAULT_CLICK_SAFETY, createEmptyInteraction } from '@/lib/browser-intelligence/types';
import type { PageController } from '@/lib/browser-intelligence/types';

const VIEWPORT = { width: 1440, height: 900 };

// ---------------------------------------------------------------------------
// 假 PageController —— 正是 PageController 这层抽象存在的理由：
// 真实 puppeteer Page 在 vitest(node) 里无法实例化。
// ---------------------------------------------------------------------------

interface FakePageOpts {
  documentHeight: number;
  /** 每次读高度时的增量 —— 模拟懒加载 / 无限滚动。 */
  growthPerRead?: number;
  hints?: Array<string | null>;
  screenshotFailAt?: number;
}

function createFakePage(opts: FakePageOpts) {
  const calls: string[] = [];
  let docHeight = opts.documentHeight;
  let readCount = 0;
  let hintIndex = 0;
  let shotIndex = 0;

  const page: PageController = {
    url: 'https://example.com',
    async goto(u) { calls.push(`goto:${u}`); },
    async evaluate(fn) {
      const script = String(fn);
      calls.push(script);
      if (script.includes('scrollHeight')) {
        const h = docHeight;
        docHeight += opts.growthPerRead ?? 0;
        readCount++;
        return h as never;
      }
      if (script.includes('scrollTo')) {
        return undefined as never;
      }
      // section hint
      const hint = opts.hints?.[hintIndex++] ?? null;
      return hint as never;
    },
    async screenshot() {
      if (opts.screenshotFailAt === shotIndex) throw new Error('screenshot boom');
      shotIndex++;
      return `base64-${shotIndex}`;
    },
    async setViewport(w, h) { calls.push(`viewport:${w}x${h}`); },
    async close() { calls.push('close'); },
  };

  return { page, calls, stats: () => ({ readCount, shotIndex }) };
}

// ---------------------------------------------------------------------------

describe('computeScrollSteps', () => {
  it('页面不足一屏时只采首屏', () => {
    expect(computeScrollSteps(800, 900)).toEqual([{ index: 0, position: 0 }]);
  });

  it('按视口切分，默认 10% 重叠', () => {
    // maxScroll = 3000 - 900 = 2100；stride = floor(900 * 0.9) = 810
    // 0, 810, 1620 → 未到底 → 补 2100
    const steps = computeScrollSteps(3000, 900);
    expect(steps.map((s) => s.position)).toEqual([0, 810, 1620, 2100]);
  });

  it('最后一段强制落在底部，页脚不会被漏掉', () => {
    const steps = computeScrollSteps(5000, 900);
    expect(steps[steps.length - 1].position).toBe(4100); // 5000 - 900
  });

  it('受 maxSteps 限制', () => {
    expect(computeScrollSteps(20000, 900, { maxSteps: 3 })).toHaveLength(3);
  });

  it('maxSteps 为 1 时只有首屏', () => {
    expect(computeScrollSteps(20000, 900, { maxSteps: 1 })).toEqual([{ index: 0, position: 0 }]);
  });

  it('overlapRatio 越大步长越小、采样越密', () => {
    const dense = computeScrollSteps(3000, 900, { overlapRatio: 0.5 });
    const sparse = computeScrollSteps(3000, 900, { overlapRatio: 0 });
    expect(dense.length).toBeGreaterThan(sparse.length);
  });

  it('overlapRatio 被夹在 0-0.5，非法值不会导致步长为 0', () => {
    // 若不做 clamp，overlapRatio=0.9 会让 stride 变成 90，采样数暴涨
    const steps = computeScrollSteps(3000, 900, { overlapRatio: 0.9, maxSteps: 50 });
    expect(steps.length).toBeLessThanOrEqual(50);
    for (const s of steps) expect(Number.isFinite(s.position)).toBe(true);
  });

  it('index 从 0 连续递增', () => {
    const steps = computeScrollSteps(5000, 900);
    expect(steps.map((s) => s.index)).toEqual(steps.map((_, i) => i));
  });

  it('documentHeight 为 0 的异常输入不产生 NaN', () => {
    const steps = computeScrollSteps(0, 900);
    expect(steps).toEqual([{ index: 0, position: 0 }]);
    for (const s of steps) expect(Number.isNaN(s.position)).toBe(false);
  });
});

describe('exploreScroll', () => {
  it('产出与计划等数量的采样事件', async () => {
    const { page } = createFakePage({ documentHeight: 3000, hints: ['section.hero', 'section.feature', null, 'footer.site'] });
    const res = await exploreScroll(page, { viewport: VIEWPORT, settleMs: 0 });
    expect(res.events).toHaveLength(4);
    expect(res.events.map((e) => e.position)).toEqual([0, 810, 1620, 2100]);
  });

  it('默认只存截图引用，不内联 base64（避免撑爆 token 预算）', async () => {
    const { page, stats } = createFakePage({ documentHeight: 3000 });
    const res = await exploreScroll(page, { viewport: VIEWPORT, settleMs: 0 });
    expect(res.events.every((e) => e.screenshot.dataUrl === undefined)).toBe(true);
    // 关键：默认模式下一张图都不截，零浏览器开销
    expect(stats().shotIndex).toBe(0);
  });

  it('inlineScreenshots=true 时才真正截图', async () => {
    const { page } = createFakePage({ documentHeight: 3000 });
    const res = await exploreScroll(page, { viewport: VIEWPORT, settleMs: 0, inlineScreenshots: true });
    expect(res.events.every((e) => typeof e.screenshot.dataUrl === 'string')).toBe(true);
  });

  it('单张截图失败退化成纯引用，不丢弃整段采样', async () => {
    const { page } = createFakePage({ documentHeight: 3000, screenshotFailAt: 1 });
    const res = await exploreScroll(page, { viewport: VIEWPORT, settleMs: 0, inlineScreenshots: true });
    expect(res.events).toHaveLength(4);
    expect(res.events[1].screenshot.dataUrl).toBeUndefined();
    expect(res.events[0].screenshot.dataUrl).toBe('base64-1');
  });

  it('sectionHint 缺失时省略字段而不是填 unknown 占位', async () => {
    const { page } = createFakePage({ documentHeight: 3000, hints: [null, null, null, null] });
    const res = await exploreScroll(page, { viewport: VIEWPORT, settleMs: 0 });
    expect(res.events.every((e) => e.sectionHint === undefined)).toBe(true);
  });

  it('无限滚动：高度暴涨时提前停止并标记 degraded', async () => {
    const { page } = createFakePage({ documentHeight: 2000, growthPerRead: 2000 });
    const res = await exploreScroll(page, { viewport: VIEWPORT, settleMs: 0 });
    expect(res.degraded).toBe('infinite-scroll');
    expect(res.events.length).toBeLessThan(computeScrollSteps(2000, 900).length);
  });

  it('timestamp 单调递增且从 0 起步', async () => {
    const { page } = createFakePage({ documentHeight: 3000 });
    const res = await exploreScroll(page, { viewport: VIEWPORT, settleMs: 0 });
    const ts = res.events.map((e) => e.timestamp);
    expect(ts[0]).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThanOrEqual(ts[i - 1]);
  });
});

describe('state-capture', () => {
  const scrolls = [
    { type: 'scroll' as const, index: 0, position: 0, documentHeight: 3000, viewport: VIEWPORT, screenshot: { id: 'scroll-00', filename: 'scroll-00.png', width: 1440, height: 900 }, timestamp: 0 },
    { type: 'scroll' as const, index: 1, position: 810, documentHeight: 3000, viewport: VIEWPORT, sectionHint: 'section.feature', screenshot: { id: 'scroll-01', filename: 'scroll-01.png', width: 1440, height: 900 }, timestamp: 12 },
  ];

  it('首个采样标记为 initial 触发', () => {
    const states = buildStatesFromScrolls(scrolls);
    expect(states[0].trigger).toEqual({ type: 'initial' });
    expect(states[0].stateId).toBe('scroll-00');
  });

  it('后续采样标记 scroll 触发并带上位置', () => {
    const states = buildStatesFromScrolls(scrolls);
    expect(states[1].trigger).toEqual({ type: 'scroll', position: 810 });
  });

  it('label 含区块提示时更易读', () => {
    const states = buildStatesFromScrolls(scrolls);
    expect(states[1].label).toContain('section.feature');
  });

  it('buildInteractionFromScrolls 产出字段齐全、可 JSON 序列化的包', () => {
    const pkg = buildInteractionFromScrolls(scrolls, VIEWPORT, { documentHeight: 3000 });
    expect(pkg.scrolls).toHaveLength(2);
    expect(pkg.states).toHaveLength(2);
    expect(pkg.clicks).toEqual([]);
    expect(pkg.animations).toEqual([]);
    expect(pkg.meta.screenshotCount).toBe(2);
    expect(() => JSON.stringify(pkg)).not.toThrow();
  });

  it('degraded 只在有值时写入', () => {
    const ok = buildInteractionFromScrolls(scrolls, VIEWPORT);
    expect(ok.meta.degraded).toBeUndefined();
    const bad = buildInteractionFromScrolls(scrolls, VIEWPORT, { degraded: 'infinite-scroll' });
    expect(bad.meta.degraded).toBe('infinite-scroll');
  });

  it('appendState 保证 stateId 唯一（Sprint 2 click 复用）', () => {
    const states = buildStatesFromScrolls(scrolls);
    const first = appendState(states, { stateId: 'menu-open', label: 'x', trigger: { type: 'initial' }, screenshot: scrolls[0].screenshot });
    const second = appendState(states, { stateId: 'menu-open', label: 'y', trigger: { type: 'initial' }, screenshot: scrolls[0].screenshot });
    expect(first.stateId).toBe('menu-open');
    expect(second.stateId).toBe('menu-open-2');
  });
});

describe('types — 冻结契约的回归保护', () => {
  it('createEmptyInteraction 字段齐全', () => {
    const pkg = createEmptyInteraction(VIEWPORT);
    expect(pkg).toHaveProperty('scrolls');
    expect(pkg).toHaveProperty('clicks');
    expect(pkg).toHaveProperty('states');
    expect(pkg).toHaveProperty('animations');
    expect(pkg).toHaveProperty('meta');
    expect(pkg.meta.viewport).toEqual(VIEWPORT);
  });

  it('默认安全策略必须包含删除/支付/注销类黑名单', () => {
    const patterns = DEFAULT_CLICK_SAFETY.excludeTextPatterns;
    for (const w of ['delete', 'pay', 'logout', '删除', '支付', '注销']) {
      expect(patterns.some((p) => p.toLowerCase().includes(w))).toBe(true);
    }
  });

  it('安全策略排除 footer / 外链 / 表单提交', () => {
    const ex = DEFAULT_CLICK_SAFETY.excludeSelectors;
    expect(ex).toContain('footer a');
    expect(ex).toContain('a[target="_blank"]');
    expect(ex).toContain('button[type="submit"]');
  });

  it('安全策略全部可 JSON 序列化（不得出现 RegExp）', () => {
    expect(() => JSON.stringify(DEFAULT_CLICK_SAFETY)).not.toThrow();
    expect(DEFAULT_CLICK_SAFETY.excludeTextPatterns.every((p) => typeof p === 'string')).toBe(true);
  });
});
