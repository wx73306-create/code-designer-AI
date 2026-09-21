/**
 * Reconstruction — Original / Clone 双截图链路
 * ===================================================================
 * Phase 2 / Sprint B Step 3。设计冻结文档：
 * docs/phase2-sprintB-reconstruction-diff-design.md §5.1
 *
 * ## 这一步在做什么
 *
 * 还原度需要**两张真实截图**：
 *
 *   original —— 原站截图。客户端在 vision 阶段已经截过（`/api/screenshot` 的
 *               `heroBase64`），能复用就复用，不要为 diff 再截一次原站。
 *   clone    —— 生成页截图。`renderHtmlScreenshot()` 现渲。
 *
 * ## 三条约定
 *
 * 1. **永不抛错。** 这个函数跑在生成链路的 QA 段，任何失败都必须
 *    降级为「某个字段缺失」，而不是打断整个工作流。
 * 2. **原站截图优先复用客户端的。** 服务端兜底采集是 fallback，不是主路径 ——
 *    它意味着原站要重新开一次浏览器（~2-4s），能省则省。
 * 3. **clone 的截图即使 degraded 也照常返回。** 调用方必须看 `render.status`
 *    决定能不能用 —— 本模块不代为丢弃，因为人排查问题时需要看到那张裸 HTML。
 */

import { renderHtmlScreenshot } from '@/lib/render-preview';
import { captureWebsiteScreenshots, isBlockedUrl } from '@/lib/screenshot';
import type { RenderResult } from '@/types/reconstruction';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface CapturePairInput {
  /** 生成页 HTML（previewHtml）。必填。 */
  html: string;
  /** 原站 URL，仅在需要服务端兜底采集原站截图时使用。 */
  url?: string;
  /** 客户端已有的原站 hero 截图（base64，无 data URI 前缀）。 */
  originalScreenshot?: string;
}

export type OriginalSource =
  | 'client' // 复用了请求里带的原站截图（主路径，0ms）
  | 'server' // 服务端现截（fallback，~2-4s）
  | 'unavailable'; // 拿不到 —— 还原度度量将无法进行

export interface CapturePairResult {
  /** 原站截图（base64）。拿不到时为空字符串。 */
  original: string;
  originalSource: OriginalSource;
  /** 生成页截图（base64）。**必须先看 render.status 再决定能不能用。** */
  clone: string;
  /** 生成页渲染结果（含降级原因）。 */
  render: RenderResult;
  timings: {
    /** 生成页渲染耗时。 */
    cloneMs: number;
    /** 原站截图获取耗时（client 来源时 ≈ 0）。 */
    originalMs: number;
    totalMs: number;
  };
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/** 一次调用拿到 original + clone 两张截图。永不抛错。 */
export async function captureScreenshotPair(input: CapturePairInput): Promise<CapturePairResult> {
  const startedAt = Date.now();

  // ---- clone：渲染生成页（这是本函数的主产物）----
  const cloneStartedAt = Date.now();
  const render = await renderHtmlScreenshot(input.html ?? '');
  const cloneMs = Date.now() - cloneStartedAt;

  // ---- original：优先复用客户端带过来的，缺失时服务端兜底 ----
  const originalStartedAt = Date.now();
  let original = '';
  let originalSource: OriginalSource = 'unavailable';

  const provided = input.originalScreenshot?.trim() ?? '';
  if (provided.length > 100) {
    original = provided;
    originalSource = 'client';
  } else if (input.url && !isBlockedUrl(input.url)) {
    try {
      const shot = await captureWebsiteScreenshots(input.url);
      if (shot.heroBase64) {
        original = shot.heroBase64;
        originalSource = 'server';
      }
    } catch {
      // 原站截图失败不阻断 —— 还原度会因缺真值而无法计算，这是合法结果
      originalSource = 'unavailable';
    }
  }
  const originalMs = Date.now() - originalStartedAt;

  return {
    original,
    originalSource,
    clone: render.screenshot,
    render,
    timings: {
      cloneMs,
      originalMs,
      totalMs: Date.now() - startedAt,
    },
  };
}
