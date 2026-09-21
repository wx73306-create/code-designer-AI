/**
 * interaction-explorer — Sprint 2 的高层编排
 * ===================================================================
 * 把「滚动采集」与「点击探索」串成一次完整采集，产出
 * {@link InteractionPackage}（Sprint 3 会把它写进 WebsitePackage.interaction）。
 *
 * 与 Sprint 1 的 page-explorer 的关系：
 *   - `explorePageScroll` 只做滚动，仍然保留（部分场景只要分段截图）；
 *   - 本文件是**完整版**，scroll + click 都做。
 *
 * 降级原则与 page-explorer 一致：**永不抛出**。采集层挂掉不应阻断
 * 整条生成流水线，失败时返回带 `meta.degraded` 的包。
 */

import { openBrowserSession } from './browser-manager';
import { exploreScroll } from './scroll-explorer';
import { ELEMENT_SCAN_SCRIPT, normalizeElements, rankElements } from './element-detector';
import { exploreClicks } from './click-explorer';
import { buildAnimations, buildBasePackage, mergeClicks } from './interaction-recorder';
import type { InteractionPackage, ScrollExplorerOptions } from './types';
import { createEmptyInteraction, DEFAULT_CLICK_SAFETY } from './types';
import type { RawElement } from './element-detector';

export interface ExploreInteractionOptions extends ScrollExplorerOptions {
  userAgent?: string;
  headless?: boolean;
  timeoutMs?: number;
  /** 是否执行点击探索。默认 true。关掉可退回 Sprint 1 的纯滚动采集。 */
  enableClicks?: boolean;
  /** 单次采集最多点击次数，覆盖安全策略默认值。 */
  maxClicks?: number;
}

export interface InteractionExplorationResult {
  package: InteractionPackage;
  /** 扫描到的候选元素数（分级前）。 */
  candidateCount: number;
  /** 被安全策略拦截的元素数。 */
  blockedCount: number;
  /** 降级原因，正常为 undefined。 */
  degraded?: string;
}

/** 把页面滚回顶部 —— 滚动采集结束时页面停在底部，直接扫描会拿到错误区域的元素。 */
const SCROLL_TO_TOP = `(() => { window.scrollTo(0, 0); return true; })()`;

/**
 * 完整采集一个 URL：滚动分段 + 交互探索。
 *
 * 执行顺序刻意固定：
 *   1. 滚动分段（先拿到页面全貌与 section 提示）
 *   2. **回到顶部**
 *   3. 扫描候选元素 → 风险分级 → 逐个点击并恢复
 *   4. 汇总成 InteractionPackage
 */
export async function explorePageInteraction(
  url: string,
  options: ExploreInteractionOptions,
): Promise<InteractionExplorationResult> {
  const viewport = options.viewport;
  const enableClicks = options.enableClicks ?? true;

  const { session, degraded } = await openBrowserSession(url, {
    viewport,
    ...(options.userAgent ? { userAgent: options.userAgent } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.headless !== undefined ? { headless: options.headless } : {}),
  });

  if (!session) {
    const pkg = createEmptyInteraction(viewport);
    pkg.meta.degraded = degraded ?? 'browser-unavailable';
    return { package: pkg, candidateCount: 0, blockedCount: 0, degraded: pkg.meta.degraded };
  }

  try {
    // ---- 1. 滚动分段 ----
    const scrollResult = await exploreScroll(session.page, options);
    const pkg = buildBasePackage(scrollResult.events, viewport, {
      documentHeight: scrollResult.documentHeight,
      ...(scrollResult.degraded ? { degraded: scrollResult.degraded } : {}),
    });

    if (!enableClicks) {
      return { package: pkg, candidateCount: 0, blockedCount: 0, degraded: scrollResult.degraded };
    }

    // ---- 2. 回到顶部（滚动采集后页面停在底部）----
    await session.page.evaluate(SCROLL_TO_TOP).catch(() => undefined);

    // ---- 3. 扫描候选元素 ----
    const raws = await session.page.evaluate<RawElement[]>(ELEMENT_SCAN_SCRIPT).catch(() => []);
    const candidates = rankElements(normalizeElements(Array.isArray(raws) ? raws : []), {
      viewportHeight: viewport.height,
    });

    if (candidates.length === 0) {
      return { package: pkg, candidateCount: 0, blockedCount: 0, degraded: scrollResult.degraded };
    }

    // ---- 4. 逐个点击并恢复 ----
    const host = safeHost(url);
    const clickResult = await exploreClicks(session.page, candidates, {
      viewport,
      ...(host ? { pageHost: host } : {}),
      // 覆盖 maxClicks 时必须带上完整的默认策略，不能只传一个字段
      ...(options.maxClicks !== undefined
        ? { policy: { ...DEFAULT_CLICK_SAFETY, maxClicks: options.maxClicks } }
        : {}),
    });

    mergeClicks(pkg, clickResult.events, clickResult.newStates);
    pkg.animations = buildAnimations(clickResult.events);

    return {
      package: pkg,
      candidateCount: candidates.length,
      blockedCount: clickResult.blockedCount,
      degraded: pkg.meta.degraded,
    };
  } catch (err) {
    const pkg = createEmptyInteraction(viewport);
    pkg.meta.degraded = `interaction-failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      package: pkg,
      candidateCount: 0,
      blockedCount: 0,
      degraded: pkg.meta.degraded,
    };
  } finally {
    await session.close().catch(() => undefined);
  }
}

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
