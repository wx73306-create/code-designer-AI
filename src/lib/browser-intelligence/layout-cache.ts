/**
 * layout-cache — 带缓存的布局实测入口
 * ===================================================================
 * 存在理由：**一次网页生成会调用三次 `buildWebsitePackage()`**
 * （`planning` / `code` / `animation` 各一次，见 `api/mimo/route.ts`）。
 * 布局实测要开真实浏览器 —— 不缓存就是开三次。
 *
 * 三条硬性约定（与 `interaction-cache` 一致）：
 *   1. **key 必须含 url + viewport + device** —— 否则手机端的结果会污染桌面端
 *   2. **失败也要缓存**（短 TTL）—— Chrome 异常 / Cloudflare 拦截 / 超时这类
 *      失败不缓存的话，每个 step 都会再撞一次墙
 *   3. **永不抛错** —— 采集层挂掉不该阻断生成流水线，失败返回 `null`
 *
 * ## 与 interaction-cache 的一处刻意差异
 *
 * `interaction-cache` 遇到「采到了但内容为空」会写入**负面缓存**（`null`），
 * 因为空的交互包确实毫无价值。
 *
 * 这里**不这么做**：布局实测除了 `flow` 还产出 `stickyHeader` / `centered` /
 * `gridColumns` / `docHeight`，**即使 `flow` 为空，其余字段仍是实测值**，
 * 比 CSS 正则兜底可靠。所以只要采集没抛错就缓存成功态。
 *
 * ## 为什么不抽象公共基类
 *
 * 只有 interaction 与 layout 两处使用，且两者的「空值语义」都不同（见上）。
 * 过早抽象会把两个语义不同的缓存耦在一起。若未来出现第三处再考虑。
 */

import { openBrowserSession } from './browser-manager';
import { probeLayout } from './layout-probe';
import type { LayoutProbeOptions, LayoutProbeResult } from './layout-probe';

// ---------------------------------------------------------------------------
// 缓存结构
// ---------------------------------------------------------------------------

interface LayoutCacheEntry {
  key: string;
  /** 实测结果；`null` 表示**已知失败**（负面缓存）。 */
  data: LayoutProbeResult | null;
  createdAt: number;
}

/** 成功结果的 TTL —— 与 scrapeCache / interactionCache 保持一致（10 分钟）。 */
const SUCCESS_TTL_MS = 10 * 60 * 1000;
/** 失败结果的 TTL —— 短得多：只为了不让同一轮生成反复撞墙。 */
const FAILURE_TTL_MS = 60 * 1000;
/** LRU 上限。 */
const CACHE_MAX = 20;

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

const cache = new Map<string, LayoutCacheEntry>();
/** 进行中的采集 —— 并发请求同一个 key 时共用一次采集，而不是各采一遍。 */
const inflight = new Map<string, Promise<LayoutProbeResult | null>>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LayoutCaptureOptions extends LayoutProbeOptions {
  viewport?: { width: number; height: number };
  /** 设备类别（desktop / tablet / mobile）—— 参与缓存 key。 */
  device?: string;
  /** 打开页面的超时（ms）。 */
  timeoutMs?: number;
}

/**
 * 布局实测是否启用。
 *
 * **默认关闭**（`LAYOUT_PROBE=on` 才开启）：
 *   1. 需要本机 Chrome（`CHROME_PATH`），线上环境未验证；
 *   2. 开启后 `layout.flow` 从空数组变成有值，会**改变喂给模型的内容**，
 *      属于产物语义变化，先灰度跑通再谈默认。
 */
export function isLayoutProbeEnabled(): boolean {
  return process.env.LAYOUT_PROBE === 'on';
}

/**
 * 取得某个 URL 的布局实测结果（带缓存）。
 *
 * @returns 实测结果；未启用 / 失败时返回 `null`。
 *          调用方拿到 `null` 时不应传 `layout`，让 `flow` 保持空数组（unknown）。
 */
export async function getLayoutProbe(
  url: string,
  options: LayoutCaptureOptions = {},
): Promise<LayoutProbeResult | null> {
  if (!isLayoutProbeEnabled()) return null;

  const viewport = options.viewport ?? DEFAULT_VIEWPORT;
  const key = cacheKey(url, viewport, options.device ?? 'desktop');

  const hit = readCache(key);
  if (hit !== undefined) return hit;

  // 并发去重：同一个 key 只采一次，其余请求搭便车
  const pending = inflight.get(key);
  if (pending) return pending;

  const task = capture(key, url, viewport, options).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, task);
  return task;
}

/** 仅供测试：清空缓存与进行中的任务。 */
export function resetLayoutCache(): void {
  cache.clear();
  inflight.clear();
}

/** 仅供观测：当前缓存条目数。 */
export function layoutCacheSize(): number {
  return cache.size;
}

// ---------------------------------------------------------------------------
// 内部实现
// ---------------------------------------------------------------------------

async function capture(
  key: string,
  url: string,
  viewport: { width: number; height: number },
  options: LayoutCaptureOptions,
): Promise<LayoutProbeResult | null> {
  let session: Awaited<ReturnType<typeof openBrowserSession>>['session'] = null;

  try {
    const opened = await openBrowserSession(url, {
      viewport,
      headless: true,
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    });

    // 浏览器不可用 / URL 被 SSRF 拦截 —— 记负面缓存，别让下一步再撞一次
    if (!opened.session) {
      writeCache(key, null);
      return null;
    }
    session = opened.session;

    const result = await probeLayout(session.page, {
      ...(options.maxSections !== undefined ? { maxSections: options.maxSections } : {}),
      ...(options.minSectionHeight !== undefined
        ? { minSectionHeight: options.minSectionHeight }
        : {}),
      ...(options.fullBleedRatio !== undefined ? { fullBleedRatio: options.fullBleedRatio } : {}),
      ...(options.rowTolerance !== undefined ? { rowTolerance: options.rowTolerance } : {}),
    });

    // 采集成功就缓存成功态 —— 见文件头「与 interaction-cache 的一处刻意差异」
    writeCache(key, result);
    return result;
  } catch {
    // 永不抛错：采集失败只是让这一轮没有布局实测数据，不该阻断生成
    writeCache(key, null);
    return null;
  } finally {
    if (session) {
      await session.close().catch(() => {
        // 关闭失败无所谓，进程退出时浏览器会一起收掉
      });
    }
  }
}

function cacheKey(url: string, viewport: { width: number; height: number }, device: string): string {
  return `${url}|${viewport.width}x${viewport.height}|${device}`;
}

/**
 * 读缓存。
 *
 * @returns 缓存值（含 `null` 负面结果）；未命中或已过期返回 `undefined`。
 *          刻意区分 `null`（已知失败）与 `undefined`（没查过）——
 *          弄混会让「已知失败」被当成「没查过」而反复重试。
 */
function readCache(key: string): LayoutProbeResult | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;

  const ttl = entry.data ? SUCCESS_TTL_MS : FAILURE_TTL_MS;
  if (Date.now() - entry.createdAt >= ttl) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function writeCache(key: string, data: LayoutProbeResult | null): void {
  cache.set(key, { key, data, createdAt: Date.now() });

  // LRU：Map 的迭代顺序即插入顺序，删最老的一条
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}
