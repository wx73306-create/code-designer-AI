/**
 * Reconstruction — 编排层：渲染 → 采集 → diff → 评分
 * ===================================================================
 * Phase 2 / Sprint B Step 5。设计冻结文档：
 * docs/phase2-sprintB-reconstruction-diff-design.md §4 / §5.1
 *
 * ## 三条硬约定（types/reconstruction.ts 文件头的落地处）
 *
 * 1. **unknown 不是 guess。** 任何一环不可用 → score = null，不填 0，不填 20。
 * 2. **渲染降级不算低分。** clone 渲染 degraded（典型：Tailwind CDN 没加载）时，
 *    低分是「渲染失败的分」，不是「还原度的分」。
 * 3. **不做部分计分。** 原站真值缺失 → 整分 null，不拿 style diff 单独凑一个数。
 *
 * composeReconstructionScore 是纯函数（可单测），evaluateReconstruction
 * 负责浏览器编排（真机验证）。
 */

import type { Page } from 'puppeteer-core';

import { renderHtmlPage } from '@/lib/render-preview';
import {
  computeReconstructionScore,
  diffAssets,
  diffLayout,
  diffStyleTokens,
} from '@/lib/diff';
import type { RawAssets } from '@/lib/diff/asset-diff';
import type { RawStyleTokens } from '@/lib/diff/style-diff';
import type { LayoutProbeResult } from '@/lib/browser-intelligence/layout-probe';
import type {
  ReconstructionScore,
  RenderReason,
  RenderResult,
  RenderStatus,
} from '@/types/reconstruction';

import { captureWebsiteScreenshots, isBlockedUrl } from '@/lib/screenshot';
import { readAssets, readCloneLayout, readStyleTokens } from './collect';
import type { OriginalSource } from './capture-pair';
import { getOriginalFingerprints, type OriginalFingerprints } from './original-layout';

// ---------------------------------------------------------------------------
// 纯函数：由两侧指纹合成 ReconstructionScore（可单测）
// ---------------------------------------------------------------------------

export interface SideFingerprints {
  layout: LayoutProbeResult;
  tokens: RawStyleTokens;
  assets: RawAssets;
}

/**
 * 由渲染状态与两侧指纹合成最终分数。
 *
 * null 的三种原因（顺序即优先级）：
 *   1. clone 渲染非 success（degraded / failed）→ 沿用渲染原因
 *   2. clone 指纹采不到 → render-error
 *   3. 原站真值缺失 → original-layout-unavailable
 */
export function composeReconstructionScore(input: {
  renderStatus: RenderStatus;
  renderReason?: RenderReason;
  original: SideFingerprints | null;
  clone: SideFingerprints | null;
  /** 传入可覆盖默认的 evaluatedAt（测试用），缺省取当前时间。 */
  evaluatedAt?: string;
}): ReconstructionScore {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();

  // ---- 1. 渲染没成功：没有「分」可言 ----
  if (input.renderStatus !== 'success') {
    return {
      score: null,
      dimensions: null,
      renderStatus: input.renderStatus,
      reason: input.renderReason,
      evaluatedAt,
    };
  }

  // ---- 2. clone 指纹采不到 ----
  if (!input.clone) {
    return {
      score: null,
      dimensions: null,
      renderStatus: input.renderStatus,
      reason: 'render-error',
      evaluatedAt,
    };
  }

  // ---- 3. 原站真值缺失：不做部分计分 ----
  if (!input.original) {
    return {
      score: null,
      dimensions: null,
      renderStatus: input.renderStatus,
      reason: 'original-layout-unavailable',
      evaluatedAt,
    };
  }

  const layout = diffLayout(input.original.layout, input.clone.layout);
  const style = diffStyleTokens(input.original.tokens, input.clone.tokens);
  const assets = diffAssets(input.original.assets, input.clone.assets);

  const { dimensions, score, notes } = computeReconstructionScore({ layout, style, assets });

  return {
    score,
    dimensions,
    renderStatus: 'success',
    report: { layout, style, assets, dimensions, notes },
    evaluatedAt,
  };
}

// ---------------------------------------------------------------------------
// 编排：真机执行
// ---------------------------------------------------------------------------

export interface EvaluateReconstructionInput {
  /** 生成页 HTML（previewHtml）。必填。 */
  html: string;
  /** 原站 URL —— 原站真值按它采集与缓存。缺省时还原度无法计算。 */
  url?: string;
  /** 客户端已有的原站 hero 截图（只用于链路复用，不参与结构 diff）。 */
  originalScreenshot?: string;
}

/**
 * 完整还原度评估：渲染 clone → 采 clone 指纹 → 取原站指纹 → diff → 评分。
 *
 * **永不抛错**；任何失败都折叠成 `score: null` + 原因。
 * 端到端预算：clone 渲染 ~3s + 原站会话 ~2-4s（命中缓存 ≈0）。
 */
export async function evaluateReconstruction(
  input: EvaluateReconstructionInput,
): Promise<ReconstructionScore> {
  const rendered = await renderHtmlPage(input.html ?? '');
  try {
    if (rendered.render.status !== 'success' || !rendered.page) {
      return composeReconstructionScore({
        renderStatus: rendered.render.status,
        renderReason: rendered.render.reason,
        original: null,
        clone: null,
      });
    }

    const page: Page = rendered.page;

    // clone 指纹：布局 / token / assets 并行采（同一页面，只读操作）
    let clone: SideFingerprints | null = null;
    try {
      const [layout, tokens, assets] = await Promise.all([
        readCloneLayout(page),
        readStyleTokens(page),
        readAssets(page),
      ]);
      clone = { layout, tokens, assets };
    } catch {
      clone = null;
    }

    // 原站真值（带缓存；url 缺失或采集失败 → null）
    let original: OriginalFingerprints | null = null;
    if (input.url) {
      original = await getOriginalFingerprints(input.url);
    }

    return composeReconstructionScore({
      renderStatus: rendered.render.status,
      original,
      clone,
    });
  } finally {
    await rendered.close();
  }
}

// ---------------------------------------------------------------------------
// 完整编排：一次渲染 → 截图 + 指纹 + 评分（/api/reconstruction 的入口）
// ---------------------------------------------------------------------------

export interface ReconstructionRunResult {
  /** 原站截图（base64）。拿不到时为空字符串。 */
  original: string;
  originalSource: OriginalSource;
  /** 生成页截图（base64）。**必须先看 render.status 再决定能不能用。** */
  clone: string;
  render: RenderResult;
  score: ReconstructionScore;
  timings: {
    cloneMs: number;
    originalMs: number;
    totalMs: number;
  };
}

/**
 * 单次渲染完成全部工作：clone 截图 + clone 指纹 + 原站截图 + 原站真值 + 评分。
 *
 * 刻意**不复用** captureScreenshotPair + evaluateReconstruction 的组合 ——
 * 那会把 clone 渲染两次（~3s 白付）。captureScreenshotPair 保留给
 * 「只要截图不要分数」的场景与 Step 3 验收脚本。
 *
 * 永不抛错；失败折叠进 render.status / score.reason。
 */
export async function runReconstruction(
  input: EvaluateReconstructionInput,
): Promise<ReconstructionRunResult> {
  const startedAt = Date.now();

  const rendered = await renderHtmlPage(input.html ?? '');
  const cloneMs = Date.now() - startedAt;

  try {
    const render = rendered.render;

    // ---- clone 指纹（仅 success 时，同一页面只读采集）----
    let clone: SideFingerprints | null = null;
    if (rendered.page) {
      try {
        const [layout, tokens, assets] = await Promise.all([
          readCloneLayout(rendered.page),
          readStyleTokens(rendered.page),
          readAssets(rendered.page),
        ]);
        clone = { layout, tokens, assets };
      } catch {
        clone = null;
      }
    }

    // ---- original：截图（UI/报告用）与真值（diff 用）相互独立，并行取 ----
    const originalStartedAt = Date.now();
    const [originalShot, fingerprints] = await Promise.all([
      resolveOriginalScreenshot(input),
      input.url ? getOriginalFingerprints(input.url) : Promise.resolve(null),
    ]);
    const originalMs = Date.now() - originalStartedAt;

    const score = composeReconstructionScore({
      renderStatus: render.status,
      renderReason: render.reason,
      original: fingerprints,
      clone,
    });

    return {
      original: originalShot.base64,
      originalSource: originalShot.source,
      clone: render.screenshot,
      render,
      score,
      timings: { cloneMs, originalMs, totalMs: Date.now() - startedAt },
    };
  } finally {
    await rendered.close();
  }
}

/** 原站截图：优先复用客户端带来的，缺失时服务端兜底（不抛错）。 */
async function resolveOriginalScreenshot(
  input: EvaluateReconstructionInput,
): Promise<{ base64: string; source: OriginalSource }> {
  const provided = input.originalScreenshot?.trim() ?? '';
  if (provided.length > 100) {
    return { base64: provided, source: 'client' };
  }
  if (input.url && !isBlockedUrl(input.url)) {
    try {
      const shot = await captureWebsiteScreenshots(input.url);
      if (shot.heroBase64) {
        return { base64: shot.heroBase64, source: 'server' };
      }
    } catch {
      // 原站截图失败不阻断 —— score 由真值缺失与否决定
    }
  }
  return { base64: '', source: 'unavailable' };
}
