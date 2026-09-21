/**
 * layout-cache — 单测
 *
 * 只测缓存行为，不真开浏览器：mock 掉 `openBrowserSession` 与 `probeLayout`。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { LayoutProbeResult } from './layout-probe';
import { openBrowserSession } from './browser-manager';
import { probeLayout } from './layout-probe';
import {
  getLayoutProbe,
  isLayoutProbeEnabled,
  layoutCacheSize,
  resetLayoutCache,
} from './layout-cache';

vi.mock('./browser-manager', () => ({
  openBrowserSession: vi.fn(),
}));
vi.mock('./layout-probe', () => ({
  probeLayout: vi.fn(),
}));

const mockedOpen = vi.mocked(openBrowserSession);
const mockedProbe = vi.mocked(probeLayout);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function okProbe(): LayoutProbeResult {
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
  };
}

let mockClose: ReturnType<typeof vi.fn>;

function openOk() {
  const session = { page: {}, close: mockClose };
  mockedOpen.mockResolvedValue({ session } as never);
}

// ---------------------------------------------------------------------------

describe('layout-cache', () => {
  beforeEach(() => {
    resetLayoutCache();
    mockedOpen.mockReset();
    mockedProbe.mockReset();
    mockClose = vi.fn(async () => {});
    vi.useFakeTimers();
    process.env.LAYOUT_PROBE = 'on';
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.LAYOUT_PROBE;
  });

  // -------------------------------------------------------------------------
  // 开关
  // -------------------------------------------------------------------------

  it('默认关闭：env 未设置时不启用', () => {
    delete process.env.LAYOUT_PROBE;
    expect(isLayoutProbeEnabled()).toBe(false);
  });

  it('开关 off 时零开销：不开浏览器、不采集', async () => {
    process.env.LAYOUT_PROBE = 'off';

    await expect(getLayoutProbe('https://apple.com')).resolves.toBeNull();

    expect(mockedOpen).not.toHaveBeenCalled();
    expect(mockedProbe).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 命中 / 去重
  // -------------------------------------------------------------------------

  it('★ 第二次调用命中缓存，不重复采集', async () => {
    openOk();
    mockedProbe.mockResolvedValue(okProbe());

    const first = await getLayoutProbe('https://apple.com');
    const second = await getLayoutProbe('https://apple.com');

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(mockedOpen).toHaveBeenCalledTimes(1);
  });

  it('★ 三个 Agent 各调一次，总共只开一次浏览器', async () => {
    openOk();
    mockedProbe.mockResolvedValue(okProbe());

    await getLayoutProbe('https://apple.com'); // planning
    await getLayoutProbe('https://apple.com'); // code
    await getLayoutProbe('https://apple.com'); // animation

    expect(mockedOpen).toHaveBeenCalledTimes(1);
  });

  it('并发同 key 只采一次（inflight 去重）', async () => {
    openOk();
    mockedProbe.mockResolvedValue(okProbe());

    const [a, b, c] = await Promise.all([
      getLayoutProbe('https://apple.com'),
      getLayoutProbe('https://apple.com'),
      getLayoutProbe('https://apple.com'),
    ]);

    expect(mockedOpen).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('★ 不同 device 不共用缓存（手机端不能污染桌面端）', async () => {
    openOk();
    mockedProbe.mockResolvedValue(okProbe());

    await getLayoutProbe('https://apple.com', { device: 'desktop' });
    await getLayoutProbe('https://apple.com', { device: 'mobile' });

    expect(mockedOpen).toHaveBeenCalledTimes(2);
  });

  it('★ 不同 viewport 不共用缓存', async () => {
    openOk();
    mockedProbe.mockResolvedValue(okProbe());

    await getLayoutProbe('https://apple.com', { viewport: { width: 1440, height: 900 } });
    await getLayoutProbe('https://apple.com', { viewport: { width: 390, height: 844 } });

    expect(mockedOpen).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // TTL
  // -------------------------------------------------------------------------

  it('★ 失败被负缓存：60s 内不重复撞墙', async () => {
    mockedOpen.mockResolvedValue({ session: null, degraded: 'browser-unavailable' } as never);

    await getLayoutProbe('https://apple.com');
    vi.advanceTimersByTime(30_000);
    await getLayoutProbe('https://apple.com');

    expect(mockedOpen).toHaveBeenCalledTimes(1);
  });

  it('负缓存 60s 过期后允许重试', async () => {
    mockedOpen.mockResolvedValue({ session: null, degraded: 'browser-unavailable' } as never);

    await getLayoutProbe('https://apple.com');
    vi.advanceTimersByTime(61_000);
    await getLayoutProbe('https://apple.com');

    expect(mockedOpen).toHaveBeenCalledTimes(2);
  });

  it('成功缓存 10 分钟后过期', async () => {
    openOk();
    mockedProbe.mockResolvedValue(okProbe());

    await getLayoutProbe('https://apple.com');
    expect(mockedOpen).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(11 * 60 * 1000);
    await getLayoutProbe('https://apple.com');

    expect(mockedOpen).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // 与 interaction-cache 的刻意差异
  // -------------------------------------------------------------------------

  it('flow 为空但采集成功 → 仍缓存成功态（其余字段也是实测值）', async () => {
    openOk();
    mockedProbe.mockResolvedValue({ ...okProbe(), flow: [] });

    const first = await getLayoutProbe('https://apple.com');
    vi.advanceTimersByTime(30_000);
    const second = await getLayoutProbe('https://apple.com');

    expect(first?.flow).toEqual([]);
    expect(second).toBe(first);
    // 60s 内不再重试 —— 说明缓存的是成功态而非负面缓存
    expect(mockedOpen).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 资源与异常
  // -------------------------------------------------------------------------

  it('采集结束后关闭会话（不泄漏浏览器）', async () => {
    openOk();
    mockedProbe.mockResolvedValue(okProbe());

    await getLayoutProbe('https://apple.com');

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('probeLayout 抛错 → 返回 null 且不向上抛（不阻断生成）', async () => {
    openOk();
    mockedProbe.mockRejectedValue(new Error('evaluate failed'));

    await expect(getLayoutProbe('https://apple.com')).resolves.toBeNull();
    expect(mockClose).toHaveBeenCalled();
  });

  it('openBrowserSession 抛错 → 返回 null', async () => {
    mockedOpen.mockRejectedValue(new Error('chrome missing'));

    await expect(getLayoutProbe('https://apple.com')).resolves.toBeNull();
  });

  it('LRU 上限 20：超出后淘汰最老的', async () => {
    openOk();
    mockedProbe.mockResolvedValue(okProbe());

    for (let i = 0; i < 25; i++) {
      await getLayoutProbe(`https://example.com/${i}`);
    }

    expect(layoutCacheSize()).toBe(20);
  });
});
