/**
 * interaction-cache — 带缓存的交互采集入口
 * ===================================================================
 * 存在理由：**一次网页生成会调用三次 `buildWebsitePackage()`**
 * （`planning` / `code` / `animation` 各一次，见 `api/mimo/route.ts`）。
 * 交互采集要开真实浏览器，实测 20-32s —— 不缓存就是三次采集、约 90s 白烧，
 * 而该路由的 `maxDuration` 只有 300s。
 *
 * 三条硬性约定：
 *   1. **key 必须含 url + viewport + device** —— 否则手机端的结果会污染桌面端
 *   2. **失败也要缓存**（短 TTL）—— Chrome 异常 / Cloudflare 拦截 / 超时这类
 *      失败不缓存的话，每个 step 都会再撞一次墙，把 90s 变成纯浪费
 *   3. **永不抛错** —— 采集层挂掉不该阻断生成流水线，失败返回 `null`
 */

import { explorePageInteraction } from './interaction-explorer';
import type { InteractionPackage, ScrollViewport } from './types';

// ---------------------------------------------------------------------------
// 缓存结构
// ---------------------------------------------------------------------------

interface InteractionCacheEntry {
  key: string;
  /** 采集结果；`null` 表示**已知失败**（负面缓存）。 */
  data: InteractionPackage | null;
  createdAt: number;
}

/** 成功结果的 TTL —— 与 scrapeCache 保持一致（10 分钟）。 */
const SUCCESS_TTL_MS = 10 * 60 * 1000;
/** 失败结果的 TTL —— 短得多：只为了不让同一轮生成反复撞墙。 */
const FAILURE_TTL_MS = 60 * 1000;
/** LRU 上限 —— 单条体积远大于 scraped data，比 scrapeCache 的 50 小。 */
const CACHE_MAX = 20;

const cache = new Map<string, InteractionCacheEntry>();
/** 进行中的采集 —— 并发请求同一个 key 时共用一次采集，而不是各采一遍。 */
const inflight = new Map<string, Promise<InteractionPackage | null>>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface InteractionCaptureOptions {
  viewport?: ScrollViewport;
  /** 设备类别（desktop / tablet / mobile）—— 参与缓存 key。 */
  device?: string;
  /** 单次采集最多点击次数。 */
  maxClicks?: number;
}

/**
 * 交互采集是否启用。
 *
 * **默认关闭**（`INTERACTION_CAPTURE=on` 才开启）：
 *   1. 一次生成最多 +30s，而路由 `maxDuration` 是 300s 硬约束；
 *   2. 采集依赖本机 Chrome（`CHROME_PATH`），线上环境未验证；
 *   3. 先灰度跑通再开默认。
 */
export function isInteractionCaptureEnabled(): boolean {
  return process.env.INTERACTION_CAPTURE === 'on';
}

/**
 * 取得某个 URL 的交互采集结果（带缓存）。
 *
 * @returns 采到的包；未启用 / 失败 / 无内容时返回 `null`。
 *          调用方拿到 `null` 应保持 `WebsitePackage.interaction` 为 `undefined`。
 */
export async function getInteractionPackage(
  url: string,
  options: InteractionCaptureOptions = {},
): Promise<InteractionPackage | null> {
  if (!isInteractionCaptureEnabled()) return null;

  const viewport = options.viewport ?? { width: 1440, height: 900 };
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
export function resetInteractionCache(): void {
  cache.clear();
  inflight.clear();
}

/** 仅供观测：当前缓存条目数。 */
export function interactionCacheSize(): number {
  return cache.size;
}

// ---------------------------------------------------------------------------
// 内部实现
// ---------------------------------------------------------------------------

async function capture(
  key: string,
  url: string,
  viewport: ScrollViewport,
  options: InteractionCaptureOptions,
): Promise<InteractionPackage | null> {
  try {
    const result = await explorePageInteraction(url, {
      viewport,
      headless: true,
      ...(options.maxClicks !== undefined ? { maxClicks: options.maxClicks } : {}),
    });

    // 「采到了但什么都没有」等同于没采到 —— 不写入缓存，
    // 免得下一次直接返回一个空包（也应保持 interaction 为 undefined）
    const useful =
      result.package.clicks.length > 0 || result.package.scrolls.length > 0;
    const value = useful ? result.package : null;

    writeCache(key, value);
    return value;
  } catch {
    // 永不抛错：采集失败只是让这一轮没有交互数据，不该阻断生成
    writeCache(key, null);
    return null;
  }
}

function cacheKey(url: string, viewport: ScrollViewport, device: string): string {
  return `${url}|${viewport.width}x${viewport.height}|${device}`;
}

/**
 * 读缓存。
 *
 * @returns 缓存值（含 `null` 负面结果）；未命中或已过期返回 `undefined`。
 *          刻意区分 `null`（已知失败）与 `undefined`（没查过）——
 *          弄混会让「已知失败」被当成「没查过」而反复重试。
 */
function readCache(key: string): InteractionPackage | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;

  const ttl = entry.data ? SUCCESS_TTL_MS : FAILURE_TTL_MS;
  if (Date.now() - entry.createdAt >= ttl) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function writeCache(key: string, data: InteractionPackage | null): void {
  cache.set(key, { key, data, createdAt: Date.now() });

  // LRU：Map 的迭代顺序即插入顺序，删最老的一条
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}
