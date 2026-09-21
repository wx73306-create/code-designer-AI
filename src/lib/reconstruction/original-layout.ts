/**
 * Reconstruction — 原站真值采集（layout / tokens / assets，带缓存）
 * ===================================================================
 * Phase 2 / Sprint B Step 5。
 *
 * ## 为什么这里有一份自己的缓存（而不是复用 layout-cache）
 *
 * 还原度度量开启（`RECONSTRUCTION_DIFF=on`）时，需要**强制**采集原站真值，
 * 而 `getLayoutProbe()` 写死了 `if (!isLayoutProbeEnabled()) return null`。
 * 两条路里选了「不动 Sprint A 文件」：在 reconstruction 内自建采集与缓存。
 *
 * 缓存语义与 layout-cache **刻意保持一致**（成功 10min / 失败 60s / LRU 20 /
 * inflight 去重 / 永不抛错）。这是一份已知的重复：若将来批准给
 * layout-cache 加 `force` 选项，应删掉本文件、改走统一入口。
 *
 * ## 为什么把 tokens / assets 跟 layout 放进同一次会话
 *
 * 打开一次原站浏览器 ~2s。布局、视觉 token、资源计数都要在原站页面上量，
 * 分三次开就是三次 2s —— 一次全量采完，缓存一份。
 */

import { openBrowserSession } from '@/lib/browser-intelligence';
import { probeLayout } from '@/lib/browser-intelligence/layout-probe';
import type { LayoutProbeResult } from '@/lib/browser-intelligence/layout-probe';
import type { RawAssets } from '@/lib/diff/asset-diff';
import type { RawStyleTokens } from '@/lib/diff/style-diff';

import { readAssets, readStyleTokens } from './collect';

// ---------------------------------------------------------------------------
// 缓存（语义与 layout-cache 一致，见文件头说明）
// ---------------------------------------------------------------------------

const SUCCESS_TTL_MS = 10 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 1000;
const CACHE_MAX = 20;
const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

export interface OriginalFingerprints {
  layout: LayoutProbeResult;
  tokens: RawStyleTokens;
  assets: RawAssets;
}

interface CacheEntry {
  data: OriginalFingerprints | null;
  createdAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<OriginalFingerprints | null>>();

/**
 * 采集原站真值（带缓存）。
 *
 * @returns 真值；失败时 `null`（还原度将因缺真值而无法计算 —— 合法结果）。
 */
export async function getOriginalFingerprints(
  url: string,
  options: { viewport?: { width: number; height: number }; timeoutMs?: number } = {},
): Promise<OriginalFingerprints | null> {
  const viewport = options.viewport ?? DEFAULT_VIEWPORT;
  const key = `${url}|${viewport.width}x${viewport.height}`;

  const hit = readCache(key);
  if (hit !== undefined) return hit;

  const pending = inflight.get(key);
  if (pending) return pending;

  const task = capture(key, url, viewport, options.timeoutMs).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, task);
  return task;
}

/** 仅供测试：清空缓存与进行中的任务。 */
export function resetOriginalFingerprintsCache(): void {
  cache.clear();
  inflight.clear();
}

// ---------------------------------------------------------------------------
// 内部实现
// ---------------------------------------------------------------------------

async function capture(
  key: string,
  url: string,
  viewport: { width: number; height: number },
  timeoutMs?: number,
): Promise<OriginalFingerprints | null> {
  let session: Awaited<ReturnType<typeof openBrowserSession>>['session'] = null;

  try {
    const opened = await openBrowserSession(url, {
      viewport,
      headless: true,
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    });
    if (!opened.session) {
      writeCache(key, null);
      return null;
    }
    session = opened.session;

    // 同一次会话内顺序采集：布局 → token → assets
    const layout = await probeLayout(session.page);
    const tokens = await readStyleTokens(session.page);
    const assets = await readAssets(session.page);
    const data: OriginalFingerprints = { layout, tokens, assets };
    writeCache(key, data);
    return data;
  } catch {
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

function readCache(key: string): OriginalFingerprints | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  const ttl = entry.data ? SUCCESS_TTL_MS : FAILURE_TTL_MS;
  if (Date.now() - entry.createdAt >= ttl) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function writeCache(key: string, data: OriginalFingerprints | null): void {
  cache.set(key, { data, createdAt: Date.now() });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
}
