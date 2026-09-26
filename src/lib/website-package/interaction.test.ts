/**
 * Sprint 3 — interaction 进入 WebsitePackage 的测试
 * ===================================================================
 * 重点三项（用户点名）：
 *   1. 空 interaction 时提示词里**不能出现** interaction 痕迹
 *   2. 缓存命中 —— 第二次不重复开浏览器
 *   3. Animation Agent 能读到「触发条件 + 状态变化」
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildWebsitePackage } from '@/lib/website-package/adapter';
import {
  buildInteractionPackage,
  RESTORED_FROM_EXPORT,
} from '@/lib/website-package/interaction-adapter';
import {
  formatInteractionContext,
  formatPackageContext,
} from '@/lib/website-package/formatter';
import { formatAnimationContext } from '@/lib/animation/gsap-rules';
import {
  getInteractionPackage,
  isInteractionCaptureEnabled,
  resetInteractionCache,
} from '@/lib/browser-intelligence/interaction-cache';
import {
  createEmptyPackage,
  WEBSITE_PACKAGE_VERSION,
} from '@/types/website-package';
import {
  createEmptyInteraction,
  type ClickEvent,
  type InteractionExport,
  type InteractionPackage,
} from '@/lib/browser-intelligence/types';

// 采集层必须被 mock —— 单测里不能真的开浏览器
vi.mock('@/lib/browser-intelligence/interaction-explorer', () => ({
  explorePageInteraction: vi.fn(),
}));

import { explorePageInteraction } from '@/lib/browser-intelligence/interaction-explorer';

const VIEWPORT = { width: 1440, height: 900 };
const mockedExplore = vi.mocked(explorePageInteraction);

/** 造一个含 1 次有效点击 + 1 次无效点击的交互包。 */
function samplePackage(): InteractionPackage {
  const pkg = createEmptyInteraction(VIEWPORT);
  pkg.scrolls = [
    {
      type: 'scroll',
      index: 0,
      position: 0,
      documentHeight: 9000,
      viewport: VIEWPORT,
      screenshot: { id: 'scroll-00', filename: 'scroll-00.png', width: 1440, height: 900 },
      timestamp: 0,
    },
  ];
  const menuClick: ClickEvent = {
    type: 'click',
    id: 'click-001',
    target: { selector: '#globalnav-menubutton-link-store', text: 'Store menu', kind: 'dropdown' },
    before: { id: 'state-001', filename: 'state-001.png', width: 1440, height: 900 },
    after: { id: 'state-002', filename: 'state-002.png', width: 1440, height: 900 },
    changed: true,
    changes: [
      { type: 'visibility', target: '.dropdown', change: 'hidden→visible' },
      { type: 'transform', target: '.dropdown', change: 'translateY -8→0' },
    ],
    timestamp: 100,
  };
  const deadClick: ClickEvent = {
    type: 'click',
    id: 'click-002',
    target: { selector: 'button[data-base-ui-navigation-menu-trigger]', text: 'Product', kind: 'button' },
    before: { id: 'state-003', filename: 'state-003.png', width: 1440, height: 900 },
    changed: false,
    changes: [],
    timestamp: 200,
  };
  pkg.clicks = [menuClick, deadClick];
  pkg.states = [
    { stateId: 'state-001', label: '点击前', trigger: { type: 'click', selector: '#a' }, screenshot: menuClick.before },
    { stateId: 'state-002', label: '点击后', trigger: { type: 'click', selector: '#a' }, screenshot: menuClick.after! },
  ];
  return pkg;
}

// ===========================================================================
// 1. 协议层
// ===========================================================================

describe('WebsitePackage 协议版本', () => {
  // 1.1.0 = Sprint 3 加 interaction；1.2.0 = Sprint A 加 LayoutBlock.heightPx
  // 1.3.0 = 加 LayoutBlock.zIndex（实测层叠层级，auto ⇒ 缺失）
  it('版本已 bump 到 1.3.0', () => {
    expect(WEBSITE_PACKAGE_VERSION).toBe('1.3.0');
  });

  it('createEmptyPackage 的 interaction 必须是 undefined，不是空对象', () => {
    const pkg = createEmptyPackage('https://apple.com');
    expect(pkg.interaction).toBeUndefined();
    // 关键：不能出现 "interaction" 这个 key 本身
    expect(Object.keys(pkg)).not.toContain('interaction');
  });
});

// ===========================================================================
// 2. adapter 写入
// ===========================================================================

describe('buildWebsitePackage — interaction 写入', () => {
  const scraped = { url: 'https://apple.com', htmlStructure: '<div></div>' } as never;

  it('传入有内容的 interaction 时写入', () => {
    const pkg = buildWebsitePackage({ scraped, interaction: samplePackage() });
    expect(pkg.interaction).toBeDefined();
    expect(pkg.interaction?.clicks).toHaveLength(2);
  });

  it('不传时保持 undefined（不是空对象）', () => {
    const pkg = buildWebsitePackage({ scraped });
    expect(pkg.interaction).toBeUndefined();
  });

  it('传入**全空**的 interaction 也不写入 —— 「采过但没采到」等价于「没采过」', () => {
    const pkg = buildWebsitePackage({ scraped, interaction: createEmptyInteraction(VIEWPORT) });
    expect(pkg.interaction).toBeUndefined();
  });
});

// ===========================================================================
// 3. buildInteractionPackage —— Agent 不直接读 interaction.json
// ===========================================================================

describe('buildInteractionPackage', () => {
  it('非法输入返回 null', () => {
    expect(buildInteractionPackage(null)).toBeNull();
    expect(buildInteractionPackage('x')).toBeNull();
    expect(buildInteractionPackage({})).toBeNull();
  });

  it('InteractionPackage 形态：无损透传', () => {
    const src = samplePackage();
    const out = buildInteractionPackage(src);
    expect(out).not.toBeNull();
    expect(out?.clicks).toHaveLength(2);
    expect(out?.meta.degraded).toBeUndefined();
  });

  it('InteractionExport 形态（interaction.json）：可恢复并标注有损', () => {
    const exp: InteractionExport = {
      url: 'https://apple.com',
      capturedAt: '2026-09-20T00:00:00.000Z',
      states: [
        {
          stateId: 'state-001',
          label: '点击前',
          trigger: { type: 'click', selector: '#menu' },
          screenshot: { id: 'state-001', filename: 'state-001.png', width: 1440, height: 900 },
        },
        {
          stateId: 'state-002',
          label: '点击后',
          trigger: { type: 'click', selector: '#menu' },
          screenshot: { id: 'state-002', filename: 'state-002.png', width: 1440, height: 900 },
        },
      ],
      events: [
        {
          id: 'click-001',
          type: 'click',
          target: { text: 'Store menu', selector: '#globalnav-menubutton-link-store', kind: 'dropdown' },
          before: 'state-001',
          after: 'state-002',
          changes: ['menu-visible', 'slide'],
        },
      ],
      meta: {
        capturedAt: '2026-09-20T00:00:00.000Z',
        viewport: VIEWPORT,
        documentHeight: 11917,
        screenshotCount: 2,
      },
    };

    const out = buildInteractionPackage(exp);
    expect(out).not.toBeNull();
    // 摘要被逆映射回 ChangeType
    expect(out?.clicks[0].changed).toBe(true);
    expect(out?.clicks[0].changes.map((c) => c.type).sort()).toEqual(['transform', 'visibility']);
    // 有损恢复必须被标注
    expect(out?.meta.degraded).toBe(RESTORED_FROM_EXPORT);
    expect(out?.meta.documentHeight).toBe(11917);
  });
});

// ===========================================================================
// 4. formatter —— ★ 重点 1：空 interaction 不能留痕迹
// ===========================================================================

describe('formatInteractionContext — 空值处理', () => {
  it('★ interaction 为 undefined 时返回空串', () => {
    expect(formatInteractionContext(createEmptyPackage('https://a.com'))).toBe('');
  });

  it('★ 空 interaction 时 formatPackageContext 里不出现「交互」二字', () => {
    const pkg = buildWebsitePackage({
      scraped: { url: 'https://apple.com', htmlStructure: '<div></div>' } as never,
    });
    const text = formatPackageContext(pkg);
    expect(text).not.toMatch(/交互/);
    expect(text).not.toMatch(/interaction/i);
  });

  it('全空的 interaction 包也不产生输出', () => {
    expect(formatInteractionContext({ interaction: createEmptyInteraction(VIEWPORT) })).toBe('');
  });
});

describe('formatInteractionContext — 三档粒度', () => {
  const pkg = { interaction: samplePackage() };

  it('full（animation）：含触发条件、变化、可补间属性', () => {
    const text = formatInteractionContext(pkg, 'full');
    expect(text).toContain('#globalnav-menubutton-link-store');
    expect(text).toContain('visibility');
    expect(text).toContain('transform');
  });

  it('full 必须列出「点击无变化」的元素，防止模型编造动效', () => {
    const text = formatInteractionContext(pkg, 'full');
    expect(text).toContain('不要为它们编造动效');
    expect(text).toContain('button[data-base-ui-navigation-menu-trigger]');
  });

  it('event（code）：event / target / result，且不含截图信息', () => {
    const text = formatInteractionContext(pkg, 'event');
    expect(text).toContain('event: click');
    expect(text).toContain('target:');
    expect(text).toContain('result:');
    expect(text).not.toContain('stateId');
    expect(text).not.toMatch(/\.png/);
  });

  it('states（planning）：组件名 + states 列表', () => {
    const text = formatInteractionContext(pkg, 'states');
    expect(text).toContain('states:');
    expect(text).toContain('default');
    expect(text).toContain('open');
    // selector 含 nav → 推断为 Navbar
    expect(text).toContain('Navbar');
  });

  it('三档互不相同（确实分级了，不是同一份文本）', () => {
    const full = formatInteractionContext(pkg, 'full');
    const event = formatInteractionContext(pkg, 'event');
    const states = formatInteractionContext(pkg, 'states');
    expect(new Set([full, event, states]).size).toBe(3);
  });

  it('超长 textContent 被截断 —— 整张卡片的文本不该占满 token', () => {
    const long = '支持任何计费模式Pro 计划按月计费TokenHK$0.08 / 1,000 单位用量计量过去 30 天 Token 用量2,010,569,010';
    const withLong = { interaction: samplePackage() };
    withLong.interaction.clicks[0].target.text = long;

    const text = formatInteractionContext(withLong, 'full');
    expect(text).not.toContain(long);
    expect(text).toContain('…');
  });
});

// ===========================================================================
// 5. Animation Agent —— ★ 重点 3：读到 trigger + state change
// ===========================================================================

describe('formatAnimationContext — 双来源', () => {
  const cssAnimations = [
    {
      name: 'nav-menu',
      type: 'transition' as const,
      duration: '0.3s',
      easing: 'ease',
      target: '#globalnav-menubutton-link-store',
      properties: ['opacity'],
    },
    {
      name: 'dead-product-menu',
      type: 'transition' as const,
      duration: '0.3s',
      easing: 'ease',
      target: 'button[data-base-ui-navigation-menu-trigger]',
      properties: ['opacity'],
    },
  ];

  it('★ 输出同时含 CSS 检测与交互触发，且**两段并存不合并**', () => {
    const text = formatAnimationContext({
      animations: cssAnimations,
      interaction: samplePackage(),
    });
    expect(text).toContain('CSS 静态解析');
    expect(text).toContain('交互采集');
    // 交互段要能看出「点击 → 变化」
    expect(text).toMatch(/click\s+#globalnav-menubutton-link-store/);
    expect(text).toContain('hidden→visible');
  });

  it('★ CSS 动画为空时仍输出交互段（不能被提前 return 吞掉）', () => {
    const text = formatAnimationContext({ animations: [], interaction: samplePackage() });
    expect(text).toContain('未检测到动画');
    expect(text).toContain('#globalnav-menubutton-link-store');
  });

  it('★ 冲突信号：CSS 声明了动画但点击无变化 → 提示不要生成', () => {
    const text = formatAnimationContext({
      animations: cssAnimations,
      interaction: samplePackage(),
    });
    expect(text).toContain('冲突信号');
    expect(text).toContain('button[data-base-ui-navigation-menu-trigger]');
  });

  it('两者都为空时给出保守提示，不报错', () => {
    const text = formatAnimationContext({});
    expect(text).toContain('未检测到动画');
    expect(text).not.toContain('交互');
  });
});

// ===========================================================================
// 6. 缓存 —— ★ 重点 2：不重复开浏览器
// ===========================================================================

describe('interaction-cache', () => {
  beforeEach(() => {
    resetInteractionCache();
    mockedExplore.mockReset();
    vi.useFakeTimers();
    process.env.INTERACTION_CAPTURE = 'on';
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.INTERACTION_CAPTURE;
  });

  const okResult = (pkg: InteractionPackage) => ({
    package: pkg,
    candidateCount: 10,
    blockedCount: 2,
  });

  it('开关 off 时零开销：不调用采集', async () => {
    process.env.INTERACTION_CAPTURE = 'off';
    expect(isInteractionCaptureEnabled()).toBe(false);
    await expect(getInteractionPackage('https://apple.com')).resolves.toBeNull();
    expect(mockedExplore).not.toHaveBeenCalled();
  });

  it('★ 第二次调用命中缓存，不重复采集', async () => {
    mockedExplore.mockResolvedValue(okResult(samplePackage()) as never);

    const first = await getInteractionPackage('https://apple.com');
    const second = await getInteractionPackage('https://apple.com');

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(mockedExplore).toHaveBeenCalledTimes(1);
  });

  it('★ 三个 Agent 各调一次，总共只采一次（90s → 30s）', async () => {
    mockedExplore.mockResolvedValue(okResult(samplePackage()) as never);

    await getInteractionPackage('https://apple.com'); // planning
    await getInteractionPackage('https://apple.com'); // code
    await getInteractionPackage('https://apple.com'); // animation

    expect(mockedExplore).toHaveBeenCalledTimes(1);
  });

  it('★ 不同 device 不共用缓存（手机端不能污染桌面端）', async () => {
    mockedExplore.mockResolvedValue(okResult(samplePackage()) as never);

    await getInteractionPackage('https://apple.com', { device: 'desktop' });
    await getInteractionPackage('https://apple.com', { device: 'mobile' });

    expect(mockedExplore).toHaveBeenCalledTimes(2);
  });

  it('★ 不同 viewport 不共用缓存', async () => {
    mockedExplore.mockResolvedValue(okResult(samplePackage()) as never);

    await getInteractionPackage('https://apple.com', { viewport: { width: 1440, height: 900 } });
    await getInteractionPackage('https://apple.com', { viewport: { width: 390, height: 844 } });

    expect(mockedExplore).toHaveBeenCalledTimes(2);
  });

  it('★ 失败被负缓存：60s 内不重复撞墙', async () => {
    mockedExplore.mockRejectedValue(new Error('Chrome unavailable'));

    await expect(getInteractionPackage('https://blocked.com')).resolves.toBeNull();
    vi.advanceTimersByTime(30_000);
    await expect(getInteractionPackage('https://blocked.com')).resolves.toBeNull();

    expect(mockedExplore).toHaveBeenCalledTimes(1);
  });

  it('负缓存 60s 过期后允许重试', async () => {
    mockedExplore.mockRejectedValue(new Error('Chrome unavailable'));
    await getInteractionPackage('https://blocked.com');

    vi.advanceTimersByTime(61_000);
    mockedExplore.mockResolvedValue(okResult(samplePackage()) as never);
    await expect(getInteractionPackage('https://blocked.com')).resolves.not.toBeNull();

    expect(mockedExplore).toHaveBeenCalledTimes(2);
  });

  it('成功缓存 10 分钟后过期', async () => {
    mockedExplore.mockResolvedValue(okResult(samplePackage()) as never);
    await getInteractionPackage('https://apple.com');

    vi.advanceTimersByTime(11 * 60 * 1000);
    await getInteractionPackage('https://apple.com');

    expect(mockedExplore).toHaveBeenCalledTimes(2);
  });

  it('采到了但内容为空 → 返回 null 且不缓存成功态', async () => {
    mockedExplore.mockResolvedValue(okResult(createEmptyInteraction(VIEWPORT)) as never);

    await expect(getInteractionPackage('https://empty.com')).resolves.toBeNull();
    // 第二次仍会重试（缓存的是 null，但 60s 内被视为已知失败）
    await expect(getInteractionPackage('https://empty.com')).resolves.toBeNull();
    expect(mockedExplore).toHaveBeenCalledTimes(1);
  });

  it('并发请求同一个 URL 只采一次', async () => {
    mockedExplore.mockResolvedValue(okResult(samplePackage()) as never);

    const [a, b] = await Promise.all([
      getInteractionPackage('https://apple.com'),
      getInteractionPackage('https://apple.com'),
    ]);

    expect(a).toBe(b);
    expect(mockedExplore).toHaveBeenCalledTimes(1);
  });
});
