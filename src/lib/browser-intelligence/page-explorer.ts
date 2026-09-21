/**
 * page-explorer — Sprint 1 的高层编排
 * ===================================================================
 * 把 browser-manager / scroll-explorer / state-capture 串成一次完整采集，
 * 并统一处理降级：任何失败都返回带 `meta.degraded` 的空包，
 * **绝不抛出**——采集层挂掉不应该阻断整条生成流水线。
 */

import { openBrowserSession } from './browser-manager';
import { exploreScroll } from './scroll-explorer';
import { buildInteractionFromScrolls } from './state-capture';
import type { InteractionPackage, ScrollExplorerOptions } from './types';
import { createEmptyInteraction } from './types';

export interface ExplorePageOptions extends ScrollExplorerOptions {
  /** 传给 browser-manager 的可选项。 */
  userAgent?: string;
  headless?: boolean;
  timeoutMs?: number;
}

/**
 * 采集一个 URL 的滚动状态序列。
 *
 * @returns 永远返回完整的 {@link InteractionPackage}；失败时字段为空且
 *          `meta.degraded` 记录原因，下游 Agent 据此降低对该字段的信任度。
 */
export async function explorePageScroll(
  url: string,
  options: ExplorePageOptions,
): Promise<InteractionPackage> {
  const viewport = options.viewport;

  const { session, degraded } = await openBrowserSession(url, {
    viewport,
    ...(options.userAgent ? { userAgent: options.userAgent } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.headless !== undefined ? { headless: options.headless } : {}),
  });

  if (!session) {
    const pkg = createEmptyInteraction(viewport);
    pkg.meta.degraded = degraded ?? 'browser-unavailable';
    return pkg;
  }

  try {
    const result = await exploreScroll(session.page, options);
    return buildInteractionFromScrolls(result.events, viewport, {
      documentHeight: result.documentHeight,
      ...(result.degraded ? { degraded: result.degraded } : {}),
    });
  } catch (err) {
    const pkg = createEmptyInteraction(viewport);
    pkg.meta.degraded = `scroll-failed: ${err instanceof Error ? err.message : String(err)}`;
    return pkg;
  } finally {
    await session.close().catch(() => undefined);
  }
}
