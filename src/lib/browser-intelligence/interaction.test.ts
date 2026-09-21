import { describe, it, expect } from 'vitest';
import {
  buildSelector,
  inferElementType,
  isStableId,
  normalizeElements,
  rankElements,
  type RawElement,
} from '@/lib/browser-intelligence/element-detector';
import {
  classifyElement,
  isClickable,
  selectClickTargets,
  suggestRecovery,
} from '@/lib/browser-intelligence/interaction-policy';
import {
  diffStates,
  extractAnimatedProperties,
  hasMeaningfulChange,
  summarizeChanges,
} from '@/lib/browser-intelligence/state-diff';
import {
  buildBasePackage,
  collectAnimatedProperties,
  mergeClicks,
  toInteractionExport,
} from '@/lib/browser-intelligence/interaction-recorder';
import { exploreClicks } from '@/lib/browser-intelligence/click-explorer';
import { buildStatesFromScrolls } from '@/lib/browser-intelligence/state-capture';
import type { PageController } from '@/lib/browser-intelligence/types';
import { createEmptyInteraction, RISK, type DetectedElement, type ElementSnapshot, type StateSnapshot } from '@/lib/browser-intelligence/types';

const VIEWPORT = { width: 1440, height: 900 };

function raw(over: Partial<RawElement> = {}): RawElement {
  return {
    tag: 'button', text: '', id: '', cls: '', href: '', role: '',
    ariaExpanded: null, ariaHaspopup: '', inHeaderNav: false, inFooter: false,
    isSubmit: false, x: 0, y: 0, dataAttrs: [], ...over,
  };
}

function snap(selector: string, over: Partial<ElementSnapshot> = {}): ElementSnapshot {
  return {
    selector, visible: true, opacity: '1', display: 'block', transform: 'none',
    rect: { x: 0, y: 0, width: 100, height: 40 }, ...over,
  };
}

// ===========================================================================
// element-detector
// ===========================================================================

describe('element-detector — 类型推断', () => {
  it('role=tab 优先判定为 tab', () => {
    expect(inferElementType(raw({ role: 'tab', tag: 'button' }))).toBe('tab');
  });

  it('aria-expanded 在导航内 → menu，否则 → accordion', () => {
    expect(inferElementType(raw({ ariaExpanded: false, inHeaderNav: true }))).toBe('menu');
    expect(inferElementType(raw({ ariaExpanded: false, inHeaderNav: false }))).toBe('accordion');
  });

  it('aria-haspopup → dropdown', () => {
    expect(inferElementType(raw({ ariaHaspopup: 'true' }))).toBe('dropdown');
  });

  it('summary → accordion，select → select', () => {
    expect(inferElementType(raw({ tag: 'summary' }))).toBe('accordion');
    expect(inferElementType(raw({ tag: 'select' }))).toBe('select');
  });

  it('导航内的 a → nav，其他 a → link', () => {
    expect(inferElementType(raw({ tag: 'a', inHeaderNav: true }))).toBe('nav');
    expect(inferElementType(raw({ tag: 'a' }))).toBe('link');
  });

  it('aria 信号强于 class 猜测', () => {
    // class 里有 menu 但 aria 明确是 tab —— 应以 aria 为准
    expect(inferElementType(raw({ role: 'tab', cls: 'menu-button', tag: 'button' }))).toBe('tab');
  });
});

describe('element-detector — selector 生成', () => {
  it('id 优先', () => {
    expect(buildSelector(raw({ id: 'menu-btn', cls: 'x y' }))).toBe('#menu-btn');
  });

  it('运行时生成的 id 被跳过（不可复现，退化到 tag.class）', () => {
    expect(isStableId('base-ui-_R_3apaki1lqiplei_')).toBe(false);
    expect(isStableId(':r0:')).toBe(false);
    expect(isStableId('globalnav-menubutton-link-store')).toBe(true);
    expect(buildSelector(raw({ id: 'base-ui-_R_abc_', tag: 'button', cls: 'nav' }))).toBe('button.nav');
  });

  it('无 id 时用 data-* 属性', () => {
    expect(buildSelector(raw({ tag: 'button', dataAttrs: ['data-testid'] }))).toBe('button[data-testid]');
  });

  it('退化到 tag.class，最多取 2 个 class', () => {
    expect(buildSelector(raw({ tag: 'a', cls: 'nav link extra' }))).toBe('a.nav.link');
  });

  it('什么都没有时退化到 tag', () => {
    expect(buildSelector(raw({ tag: 'button' }))).toBe('button');
  });
});

describe('element-detector — 归一化与排序', () => {
  it('同 selector + 同 text 去重', () => {
    const list = [raw({ tag: 'a', cls: 'n', text: 'Home' }), raw({ tag: 'a', cls: 'n', text: 'Home' })];
    expect(normalizeElements(list)).toHaveLength(1);
  });

  it('不同 text 的同 selector 元素保留', () => {
    const list = [raw({ tag: 'a', cls: 'n', text: 'Home' }), raw({ tag: 'a', cls: 'n', text: 'About' })];
    expect(normalizeElements(list)).toHaveLength(2);
  });

  it('区域判定：footer / header / main（selector 里看不出来，必须单独记）', () => {
    const els = normalizeElements([
      raw({ tag: 'a', id: 'legal', inFooter: true }),
      raw({ tag: 'a', id: 'navlink', inHeaderNav: true }),
      raw({ tag: 'a', id: 'body' }),
    ]);
    expect(els.map((e) => e.region)).toEqual(['footer', 'header', 'main']);
  });

  it('id 按出现顺序编号', () => {
    const els = normalizeElements([raw({ id: 'a' }), raw({ id: 'b' })]);
    expect(els.map((e) => e.id)).toEqual(['element-001', 'element-002']);
  });

  it('排序：菜单类排在普通按钮之前', () => {
    const els = normalizeElements([
      raw({ tag: 'button', cls: 'plain', id: 'p' }),
      raw({ ariaExpanded: false, inHeaderNav: true, id: 'm', text: 'Menu' }),
    ]);
    const ranked = rankElements(els);
    expect(ranked[0].type).toBe('menu');
  });

  it('同类型时首屏内优先', () => {
    const els = normalizeElements([
      raw({ tag: 'button', id: 'far', y: 3000 }),
      raw({ tag: 'button', id: 'near', y: 100 }),
    ]);
    expect(rankElements(els)[0].selector).toBe('#near');
  });
});

// ===========================================================================
// interaction-policy
// ===========================================================================

describe('interaction-policy — 风险分级', () => {
  const el = (over: Partial<DetectedElement> = {}): Omit<DetectedElement, 'risk'> => ({
    id: 'element-001', type: 'button', text: '', selector: 'button',
    position: { x: 0, y: 0 }, visible: true, ...over,
  });

  it('命中文本黑名单即 BLOCKED（删除/支付/注销/登录）', () => {
    for (const text of ['删除订单', 'Pay now', 'Logout', 'Sign in', '立即购买', 'Submit']) {
      expect(classifyElement(el({ text })).risk).toBe(RISK.BLOCKED);
    }
  });

  it('footer 内元素 BLOCKED', () => {
    expect(classifyElement(el({ selector: 'footer a.legal', type: 'link' })).risk).toBe(RISK.BLOCKED);
  });

  it('region=footer 即使 selector 不含 footer 也 BLOCKED', () => {
    // 真机坑：detector 用 #id / tag.class 生成 selector，'footer a' 规则永远匹配不到
    const r = classifyElement(el({ selector: '#legal-link', type: 'link', region: 'footer' }));
    expect(r.risk).toBe(RISK.BLOCKED);
    expect(r.riskReason).toBe('region:footer');
  });

  it('外链 target=_blank BLOCKED', () => {
    expect(classifyElement(el({ selector: 'a[target="_blank"]', type: 'link' })).risk).toBe(RISK.BLOCKED);
  });

  it('表单 submit BLOCKED', () => {
    expect(classifyElement(el({ selector: 'button[type="submit"]' })).risk).toBe(RISK.BLOCKED);
  });

  it('menu / tab / dropdown / accordion → SAFE', () => {
    for (const type of ['menu', 'tab', 'dropdown', 'accordion'] as const) {
      expect(classifyElement(el({ type, text: 'OK' })).risk).toBe(RISK.SAFE);
    }
  });

  it('外域链接 → CAUTION（不是 BLOCKED，但需恢复）', () => {
    const r = classifyElement(
      el({ type: 'link', href: 'https://other.com/x', text: 'Blog' }),
      undefined,
      { pageHost: 'apple.com' },
    );
    expect(r.risk).toBe(RISK.CAUTION);
    expect(r.riskReason).toContain('external-link');
  });

  it('同域链接不是 CAUTION-external', () => {
    const r = classifyElement(
      el({ type: 'nav', href: '/mac', text: 'Mac' }),
      undefined,
      { pageHost: 'apple.com' },
    );
    expect(r.risk).toBe(RISK.SAFE);
  });

  it('默认兜底 CAUTION —— 宁可不点', () => {
    expect(classifyElement(el({ type: 'button', text: 'Learn more' })).risk).toBe(RISK.CAUTION);
  });

  it('黑名单优先级高于白名单类型（菜单名叫"删除"也不点）', () => {
    expect(classifyElement(el({ type: 'menu', text: 'Delete' })).risk).toBe(RISK.BLOCKED);
  });

  it('isClickable 只排除 BLOCKED', () => {
    expect(isClickable(classifyElement(el({ type: 'tab' })))).toBe(true);
    expect(isClickable(classifyElement(el({ type: 'button', text: 'Go' })))).toBe(true);
    expect(isClickable(classifyElement(el({ text: 'Pay' })))).toBe(false);
  });

  it('selectClickTargets 受 maxClicks 限制', () => {
    const els = Array.from({ length: 20 }, (_, i) =>
      classifyElement(el({ id: `e${i}`, selector: `button.b${i}`, type: 'tab', text: `t${i}` })),
    );
    expect(selectClickTargets(els)).toHaveLength(6);
  });

  it('恢复策略：toggle 类 re-click，modal escape，nav history-back', () => {
    expect(suggestRecovery(classifyElement(el({ type: 'menu' }))).method).toBe('re-click');
    expect(suggestRecovery(classifyElement(el({ type: 'modal-trigger' }))).method).toBe('escape');
    expect(suggestRecovery(classifyElement(el({ type: 'nav' }))).method).toBe('history-back');
  });
});

// ===========================================================================
// state-diff
// ===========================================================================

describe('state-diff', () => {
  const before: StateSnapshot = { timestamp: 0, elements: [snap('.menu', { visible: false, opacity: '0', display: 'none' })] };

  it('识别 dom-added', () => {
    const after: StateSnapshot = { timestamp: 1, elements: [snap('.menu'), snap('.dropdown')] };
    const changes = diffStates(before, after);
    expect(changes.some((c) => c.type === 'dom-added' && c.target === '.dropdown')).toBe(true);
  });

  it('识别 hidden→visible', () => {
    const after: StateSnapshot = { timestamp: 1, elements: [snap('.menu', { visible: true, opacity: '1', display: 'block' })] };
    const changes = diffStates(before, after);
    const v = changes.find((c) => c.type === 'visibility');
    expect(v?.change).toBe('hidden→visible');
  });

  it('识别 opacity 渐变并带 detail', () => {
    const b: StateSnapshot = { timestamp: 0, elements: [snap('.x', { opacity: '0' })] };
    const a: StateSnapshot = { timestamp: 1, elements: [snap('.x', { opacity: '0.8' })] };
    const c = diffStates(b, a).find((x) => x.type === 'opacity');
    expect(c?.detail?.opacity).toBe('0→0.8');
  });

  it('opacity 微小抖动被阈值过滤（不记成动画）', () => {
    const b: StateSnapshot = { timestamp: 0, elements: [snap('.x', { opacity: '1' })] };
    const a: StateSnapshot = { timestamp: 1, elements: [snap('.x', { opacity: '0.99' })] };
    expect(diffStates(b, a)).toHaveLength(0);
  });

  it('识别 translateY 位移', () => {
    const b: StateSnapshot = { timestamp: 0, elements: [snap('.x', { transform: 'matrix(1, 0, 0, 1, 0, -8)' })] };
    const a: StateSnapshot = { timestamp: 1, elements: [snap('.x', { transform: 'none' })] };
    const c = diffStates(b, a).find((x) => x.type === 'transform');
    expect(c?.change).toContain('translateY');
  });

  it('位移小于 4px 忽略', () => {
    const b: StateSnapshot = { timestamp: 0, elements: [snap('.x', { transform: 'matrix(1, 0, 0, 1, 0, -2)' })] };
    const a: StateSnapshot = { timestamp: 1, elements: [snap('.x', { transform: 'none' })] };
    expect(diffStates(b, a)).toHaveLength(0);
  });

  it('识别位置移动', () => {
    const b: StateSnapshot = { timestamp: 0, elements: [snap('.x', { rect: { x: 0, y: 40, width: 10, height: 10 } })] };
    const a: StateSnapshot = { timestamp: 1, elements: [snap('.x', { rect: { x: 0, y: 72, width: 10, height: 10 } })] };
    expect(diffStates(b, a).some((c) => c.type === 'position')).toBe(true);
  });

  it('只 x 移动时 change 只写 x —— 不能输出 "y 708→708" 这种自相矛盾的串', () => {
    // 真机坑：stripe.com 上只变了 x，旧实现无条件输出 y，模型会以为有 y 方向动画
    const b: StateSnapshot = { timestamp: 0, elements: [snap('.x', { rect: { x: 0, y: 708, width: 10, height: 10 } })] };
    const a: StateSnapshot = { timestamp: 1, elements: [snap('.x', { rect: { x: 30, y: 708, width: 10, height: 10 } })] };
    const c = diffStates(b, a).find((x) => x.type === 'position');
    expect(c?.change).toContain('x 0→30');
    expect(c?.change).not.toContain('y');
  });

  it('两轴都动时两个都写', () => {
    const b: StateSnapshot = { timestamp: 0, elements: [snap('.x', { rect: { x: 0, y: 40, width: 10, height: 10 } })] };
    const a: StateSnapshot = { timestamp: 1, elements: [snap('.x', { rect: { x: 30, y: 72, width: 10, height: 10 } })] };
    const c = diffStates(b, a).find((x) => x.type === 'position');
    expect(c?.change).toContain('x 0→30');
    expect(c?.change).toContain('y 40→72');
  });

  it('完全无变化时返回空数组', () => {
    const s = snap('.x');
    expect(diffStates({ timestamp: 0, elements: [s] }, { timestamp: 1, elements: [s] })).toHaveLength(0);
  });

  it('hasMeaningfulChange 对空变化返回 false', () => {
    expect(hasMeaningfulChange([])).toBe(false);
  });

  it('summarizeChanges 提炼出 menu-visible', () => {
    const after: StateSnapshot = { timestamp: 1, elements: [snap('.menu')] };
    expect(summarizeChanges(diffStates(before, after))).toContain('menu-visible');
  });

  it('extractAnimatedProperties 只输出 transform/opacity/visibility', () => {
    const changes = [
      { type: 'opacity', target: '.a', change: '0→1' },
      { type: 'transform', target: '.b', change: 'x' },
      { type: 'visibility', target: '.c', change: 'hidden→visible' },
    ] as never;
    expect(extractAnimatedProperties(changes).sort()).toEqual(['opacity', 'transform', 'visibility']);
  });

  it('dom-added / dom-removed 映射为 visibility（否则 mega-menu 只产出 dom 事件，拿不到可动画属性）', () => {
    const changes = [
      { type: 'dom-added', target: '.menu', change: 'added (visible)' },
      { type: 'dom-removed', target: '.old', change: 'removed' },
    ] as never;
    expect(extractAnimatedProperties(changes)).toEqual(['visibility']);
  });
});

// ===========================================================================
// click-explorer — 用假 PageController 验「点击 → 恢复」整条链路
// ===========================================================================

/** 假页面：模拟一个「点一下菜单就展开、再点一下就收起」的站点。 */
class FakePage implements PageController {
  url: string;
  navigations: string[] = [];
  clicks: string[] = [];
  menuOpen = false;
  /** 让点击表现为「跳走」而非「展开菜单」。 */
  navigatesOnClick = false;

  constructor(home = 'https://apple.com') {
    this.url = home;
  }

  async goto(url: string): Promise<void> {
    this.url = url;
    this.navigations.push(url);
  }

  async evaluate<T>(fn: string | (() => T)): Promise<T> {
    const src = typeof fn === 'string' ? fn : fn.toString();

    // 状态快照脚本
    if (src.includes('getComputedStyle')) {
      return [
        {
          selector: '.menu',
          visible: this.menuOpen,
          opacity: this.menuOpen ? '1' : '0',
          display: 'block',
          transform: 'none',
          rect: { x: 0, y: 0, width: 100, height: 40 },
        },
      ] as unknown as T;
    }

    if (src.includes('querySelector')) {
      const m = src.match(/querySelector\("([^"]+)"\)/);
      this.clicks.push(m?.[1] ?? '?');
      if (this.navigatesOnClick) this.url = 'https://apple.com/mac';
      else this.menuOpen = !this.menuOpen;
      return undefined as unknown as T;
    }

    if (src.includes('location.reload')) {
      this.menuOpen = false;
      return undefined as unknown as T;
    }
    return undefined as unknown as T;
  }

  // 实现 PageController 时参数可省略 —— 假页面不需要真实的截图选项
  async screenshot(): Promise<string> {
    return 'aGVsbG8=';
  }

  async setViewport(): Promise<void> {
    /* no-op */
  }

  async close(): Promise<void> {
    /* no-op */
  }
}

describe('click-explorer', () => {
  const menu: Array<Omit<DetectedElement, 'risk'>> = [
    { id: 'element-001', type: 'menu', text: 'Menu', selector: 'button.menu',
      position: { x: 10, y: 10 }, visible: true, region: 'header' },
  ];

  it('点击 → 记录变化 → 恢复（页面回到未展开状态）', async () => {
    const page = new FakePage();
    const res = await exploreClicks(page, menu, { viewport: VIEWPORT, settleMs: 0 });

    expect(res.events).toHaveLength(1);
    expect(res.events[0].changed).toBe(true);
    expect(res.events[0].changes.some((c) => c.type === 'visibility')).toBe(true);
    // 恢复：点开后又点了一次，菜单应回到关闭
    expect(page.menuOpen).toBe(false);
    expect(page.clicks).toEqual(['button.menu', 'button.menu']);
  });

  it('before / after 状态都注册，导出时不出现悬空引用', async () => {
    const page = new FakePage();
    const res = await exploreClicks(page, menu, { viewport: VIEWPORT, settleMs: 0 });
    const ids = res.newStates.map((s) => s.stateId);
    expect(ids).toEqual(['state-001', 'state-002']);
    for (const id of [res.events[0].before.id, res.events[0].after?.id]) {
      expect(ids).toContain(id);
    }
  });

  it('点击导致跳走时恢复会回源到初始 URL', async () => {
    const page = new FakePage();
    page.navigatesOnClick = true;
    const nav: Array<Omit<DetectedElement, 'risk'>> = [
      { id: 'element-001', type: 'nav', text: 'Mac', selector: 'a.nav',
        position: { x: 10, y: 10 }, visible: true, region: 'header' },
    ];
    await exploreClicks(page, nav, { viewport: VIEWPORT, settleMs: 0 });
    expect(page.navigations).toContain('https://apple.com');
  });

  it('被 BLOCKED 的候选不计入点击，但计入 blockedCount', async () => {
    const page = new FakePage();
    const bad: Array<Omit<DetectedElement, 'risk'>> = [
      { id: 'element-001', type: 'button', text: 'Pay now', selector: 'button.pay',
        position: { x: 0, y: 0 }, visible: true, region: 'main' },
    ];
    const res = await exploreClicks(page, bad, { viewport: VIEWPORT, settleMs: 0 });
    expect(res.events).toHaveLength(0);
    expect(res.blockedCount).toBe(1);
    expect(page.clicks).toEqual([]);
  });

  it('单个元素挂起时超时降级，不拖垮整轮采集', async () => {
    const page = new FakePage();
    // 点击与快照脚本永远不 resolve（模拟执行上下文被导航销毁），
    // 但 reload 仍可用 —— 否则连兜底恢复都会挂住，测试要等满 10s
    page.evaluate = (<T,>(fn: string | (() => T)): Promise<T> => {
      const src = typeof fn === 'string' ? fn : fn.toString();
      if (src.includes('location.reload')) return Promise.resolve(undefined as unknown as T);
      return new Promise(() => undefined);
    }) as PageController['evaluate'];
    const res = await exploreClicks(page, menu, {
      viewport: VIEWPORT,
      settleMs: 0,
      clickTimeoutMs: 30,
    });
    expect(res.events).toHaveLength(1);
    expect(res.events[0].blocked).toContain('超时');
    expect(res.events[0].changed).toBe(false);
  });

  it('stateIndexStart 让 click 状态编号不与 scroll 状态冲突', async () => {
    const page = new FakePage();
    const res = await exploreClicks(page, menu, { viewport: VIEWPORT, settleMs: 0, stateIndexStart: 21 });
    expect(res.newStates[0].stateId).toBe('state-021');
  });
});

// ===========================================================================
// interaction-recorder
// ===========================================================================

describe('interaction-recorder', () => {
  const scrolls = [
    { type: 'scroll' as const, index: 0, position: 0, documentHeight: 3000, viewport: VIEWPORT,
      screenshot: { id: 'scroll-00', filename: 'scroll-00.png', width: 1440, height: 900 }, timestamp: 0 },
  ];

  it('buildBasePackage 产出含 scroll 状态的包', () => {
    const pkg = buildBasePackage(scrolls, VIEWPORT);
    expect(pkg.scrolls).toHaveLength(1);
    expect(pkg.states[0].stateId).toBe('scroll-00');
    expect(pkg.clicks).toEqual([]);
  });

  it('mergeClicks 合入点击与新增状态', () => {
    const pkg = buildBasePackage(scrolls, VIEWPORT);
    const click = {
      type: 'click' as const, id: 'click-001',
      target: { selector: 'button.menu', text: 'Menu', kind: 'dropdown' as const },
      before: { id: 'state-001', filename: 'state-001.png', width: 1440, height: 900 },
      after: { id: 'state-002', filename: 'state-002.png', width: 1440, height: 900 },
      changed: true, changes: [{ type: 'visibility' as const, target: '.dropdown', change: 'hidden→visible' }],
      timestamp: 100,
    };
    mergeClicks(pkg, [click], [{ stateId: 'state-002', label: 'menu-open', screenshot: click.after }]);
    expect(pkg.clicks).toHaveLength(1);
    expect(pkg.states.map((s) => s.stateId)).toEqual(['scroll-00', 'state-002']);
  });

  it('mergeClicks 不重复插入已存在的 state', () => {
    const pkg = buildBasePackage(scrolls, VIEWPORT);
    const shot = { id: 'scroll-00', filename: 'x.png', width: 1, height: 1 };
    mergeClicks(pkg, [], [{ stateId: 'scroll-00', label: 'dup', screenshot: shot }]);
    expect(pkg.states).toHaveLength(1);
  });

  it('toInteractionExport 用 stateId 引用替代内联截图', () => {
    const pkg = buildBasePackage(scrolls, VIEWPORT);
    const exp = toInteractionExport(pkg, 'https://apple.com');
    expect(exp.url).toBe('https://apple.com');
    expect(exp.events[0]).toMatchObject({ type: 'scroll', state: 'scroll-00' });
    // 关键：事件里不内联截图对象
    expect(JSON.stringify(exp.events)).not.toContain('dataUrl');
  });

  it('toInteractionExport 的 click 事件带 changes 摘要', () => {
    const pkg = buildBasePackage(scrolls, VIEWPORT);
    pkg.clicks = [{
      type: 'click', id: 'click-001',
      target: { selector: 'button.menu', text: 'Menu', kind: 'dropdown' },
      before: { id: 'state-001', filename: '', width: 1440, height: 900 },
      after: { id: 'state-002', filename: '', width: 1440, height: 900 },
      changed: true,
      changes: [{ type: 'visibility', target: '.dropdown', change: 'hidden→visible' }],
      timestamp: 50,
    }];
    const exp = toInteractionExport(pkg, 'https://apple.com');
    const click = exp.events.find((e) => e.type === 'click');
    expect(click).toBeDefined();
    if (click && click.type === 'click') {
      expect(click.before).toBe('state-001');
      expect(click.after).toBe('state-002');
      expect(click.changes).toContain('menu-visible');
    }
  });

  it('被拦截的点击记录 blocked 而非静默丢弃', () => {
    const pkg = buildBasePackage(scrolls, VIEWPORT);
    pkg.clicks = [{
      type: 'click', id: 'click-002',
      target: { selector: 'button.pay', text: 'Pay', kind: 'button' },
      before: { id: 'state-003', filename: '', width: 1440, height: 900 },
      changed: false, changes: [], timestamp: 60, blocked: 'text-blacklist:pay',
    }];
    const click = toInteractionExport(pkg, 'https://x.com').events.find((e) => e.type === 'click');
    if (click && click.type === 'click') expect(click.blocked).toContain('pay');
  });

  it('事件按时间排序', () => {
    const pkg = buildBasePackage(scrolls, VIEWPORT);
    pkg.scrolls = [
      { ...scrolls[0], index: 0, screenshot: { ...scrolls[0].screenshot, id: 'scroll-00' }, timestamp: 900 },
      { ...scrolls[0], index: 1, screenshot: { ...scrolls[0].screenshot, id: 'scroll-01' }, timestamp: 100 },
    ];
    pkg.states = buildStatesFromScrolls(pkg.scrolls);
    const exp = toInteractionExport(pkg, 'https://x.com');
    expect(exp.events[0].id).toBe('scroll-001');
    expect(exp.events[1].id).toBe('scroll-000');
  });

  it('collectAnimatedProperties 按 selector 汇总', () => {
    const pkg = createEmptyInteraction(VIEWPORT);
    pkg.clicks = [{
      type: 'click', id: 'c1',
      target: { selector: '.menu', kind: 'dropdown' },
      before: { id: 'a', filename: '', width: 1, height: 1 },
      changed: true,
      changes: [{ type: 'visibility', target: '.menu', change: 'hidden→visible' }],
      timestamp: 0,
    }];
    expect(collectAnimatedProperties(pkg.clicks)['.menu']).toContain('visibility');
  });

  it('整个导出可 JSON 序列化', () => {
    const pkg = buildBasePackage(scrolls, VIEWPORT);
    expect(() => JSON.stringify(toInteractionExport(pkg, 'https://apple.com'))).not.toThrow();
  });
});
