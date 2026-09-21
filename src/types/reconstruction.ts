/**
 * Reconstruction Diff — 还原度度量契约
 * ===================================================================
 * Phase 2 / Sprint B。设计冻结文档：docs/phase2-sprintB-reconstruction-diff-design.md
 *
 * 这个文件回答一个之前系统答不上来的问题：
 *   **生成的页面「像不像」原站？**
 *
 * 注意它与「质量分」的区别（这是 Sprint B 存在的原因）：
 *
 *   qualityScore        → 这个网页设计得好吗？（六维加权，visual-evaluation/scoring.ts）
 *   reconstructionScore → AI 做出来的像不像原网页？（本文件）
 *
 * 一个重新设计的 Apple 风页面：quality 95 / reconstruction 40 —— 合理。
 * 一个 95% 复制但设计普通的页面：quality 75 / reconstruction 95 —— 也合理。
 *
 * 三条硬约定（违反即视为 bug）：
 *   1. **unknown 不是 guess。** 无法度量时 score 必须是 null，不能填 0，更不能填 20。
 *   2. **渲染降级不算低分。** Tailwind CDN 没加载出来时，低分是「渲染失败的分」，
 *      不是「还原度的分」——拿它去驱动 Optimize 会让人去修一个不存在的问题。
 *   3. **不做部分计分。** 任一输入不可用（原站真值缺失 / clone 渲染降级）→ 整分 null。
 *
 * 本文件只放类型，不放实现。实现在：
 *   src/lib/render-preview/  渲染（renderHtmlScreenshot）
 *   src/lib/diff/            结构化 diff（纯函数）
 *   src/lib/reconstruction/  编排层 + 浏览器侧采集器
 */

import type { SectionRole } from '@/types/website-package';

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

/**
 * 渲染状态。
 *
 * - `success`：页面渲染完成且样式生效，截图与结构都可以用。
 * - `degraded`：页面渲染了，但样式没生效（典型：Tailwind CDN 不可达）。
 *               —— 截图**不可用**，因为它是裸 HTML，与原站比毫无意义。
 * - `failed`：  根本没渲染出来（setContent 抛错 / 空文档）。
 */
export type RenderStatus = 'success' | 'degraded' | 'failed';

/** 渲染原因码。status !== 'success' 时给出机器可读的原因。 */
export type RenderReason =
  | 'tailwind-cdn-unavailable' // 等 CDN 超时，或样式生效探针未通过
  | 'render-error' // setContent 抛错
  | 'empty-document' // 页面无可见内容
  | 'original-layout-unavailable'; // 原站真值缺失 —— 不是渲染问题，但同样是「无法度量」

export interface RenderResult {
  /**
   * Base64 PNG 截图（**不含** data URI 前缀）。
   * status !== 'success' 时可能为空字符串 —— 调用方必须先看 status 再用。
   */
  screenshot: string;
  status: RenderStatus;
  /** status !== 'success' 时的原因码。 */
  reason?: RenderReason;
}

// ---------------------------------------------------------------------------
// 结构化 diff — 公共原子类型
// ---------------------------------------------------------------------------

/** 色差。distance 为归一化距离：0 = 完全相同，1 = 最远。 */
export interface ColorDelta {
  /** "rgb(r, g, b)" 形式，便于直接比对与展示。 */
  original: string;
  clone: string;
  /** 加权欧氏距离 / 441.67，clamp 到 0-1。 */
  distance: number;
}

/** 数值差。ratio = min/max，两者皆为 0 时记 1（不是 0 —— 都是 0 表示一致）。 */
export interface NumericDelta {
  original: number;
  clone: number;
  ratio: number;
}

// ---------------------------------------------------------------------------
// 第一层：布局结构 diff
// ---------------------------------------------------------------------------

/**
 * 单个区块的对比结果。
 *
 * 对齐策略是 **按 role 序列做 LCS**，不是按 index —— 生成页很容易多一个/少一个
 * section，按 index 对齐会把后面所有区块全部错配。
 */
export interface LayoutDiffItem {
  role: SectionRole;
  status: 'matched' | 'missing' | 'extra';
  /** 仅在 matched / missing 时有值。 */
  originalIndex?: number;
  /** 仅在 matched / extra 时有值。 */
  cloneIndex?: number;
  /** clone.heightWeight - original.heightWeight，单位为百分点（不是百分比）。 */
  heightWeightDelta?: number;
  /** clone.heightPx / original.heightPx。 */
  heightPxRatio?: number;
  /** clone.columns - original.columns。 */
  columnDelta?: number;
  /** 原站列数（供漂移标签直接引用，如 "feature columns 3→4"）。 */
  originalColumns?: number;
  cloneColumns?: number;
  alignmentMatch?: boolean;
  fullBleedMatch?: boolean;
}

export interface LayoutDiff {
  /** role 序列覆盖率：2 * LCS(A, B) / (lenA + lenB)，0-1。 */
  roleSequenceCoverage: number;
  items: LayoutDiffItem[];
  /** 已匹配区块的高度占比 L1 距离 / 原站占比和，0-1。 */
  heightProfileDistance: number;
}

// ---------------------------------------------------------------------------
// 第二层：视觉 token diff（color / font / spacing / radius / shadow 五组）
// ---------------------------------------------------------------------------

/**
 * 视觉 token 对比。
 *
 * 五组全部覆盖：color、font、spacing、radius、shadow。
 * 浏览器侧只采集计算值，不做语义判断（「主色是什么」这类判断在 Node 侧）。
 */
export interface StyleTokenDiff {
  // —— color ——
  background?: ColorDelta;
  text?: ColorDelta;
  primary?: ColorDelta;

  // —— font ——
  /** clone 主字号 / original 主字号。 */
  fontSizeRatio?: number;
  /** 字体族集合的 Jaccard 重叠，0-1。 */
  fontFamilyOverlap?: number;

  // —— spacing ——
  /** 相邻可见区块之间垂直间距的中位数（px）。 */
  sectionGap?: NumericDelta;
  /** 顶层容器内边距的中位数（px）。 */
  containerPadding?: NumericDelta;

  // —— radius ——
  /** 可见元素 border-radius 的中位数（px）。 */
  radius?: NumericDelta;

  // —— shadow ——
  /** 带非 none box-shadow 的可见元素占比。delta = clone - original。 */
  shadowCoverage?: { original: number; clone: number; delta: number };
}

// ---------------------------------------------------------------------------
// 第三层：asset diff
// ---------------------------------------------------------------------------

export interface AssetDiff {
  originalImageCount: number;
  cloneImageCount: number;
  /** min/max，0-1；两者皆为 0 时记 1。 */
  ratio: number;
  /** 首屏（900px 内）是否含媒体（img / background-image / video）。 */
  heroHasMediaOriginal: boolean;
  heroHasMediaClone: boolean;
}

// ---------------------------------------------------------------------------
// 评分
// ---------------------------------------------------------------------------

/** 九个维度，各 0-100。权重见 computeReconstructionScore（合计 100%）。 */
export interface ReconstructionDimensions {
  /** role 序列覆盖 22% */
  roleSequence: number;
  /** 高度分布吻合 18% */
  heightProfile: number;
  /** 区块几何（列数/对齐/通栏）12% */
  blockGeometry: number;
  /** 配色 15% */
  colorTokens: number;
  /** 字体 8% */
  typography: number;
  /** 间距 7% */
  spacing: number;
  /** 圆角 5% */
  radius: number;
  /** 阴影 3% */
  shadow: number;
  /** 图片密度 10% */
  mediaDensity: number;
}

export interface DiffReport {
  layout: LayoutDiff;
  style: StyleTokenDiff;
  assets: AssetDiff;
  dimensions: ReconstructionDimensions;
  /**
   * 人话 / Code Agent 可读的漂移标签，例如：
   *   "+rounded"  "+shadow"  "-color mismatch (primary)"
   *   "hero height -23%"  "feature columns 3→4"  "cta missing"
   *
   * 结构化 diff 的价值就在这里：它不只是一个数字，而是能反向驱动 Code Agent 的清单。
   * 数值一律用实测值填充，不写死文案。
   */
  notes?: string[];
}

export interface ReconstructionScore {
  /**
   * 还原度 0-100。
   *
   * **null = 无法度量。** 这是合法且常见的结果，不是失败：
   * 渲染降级、原站布局真值缺失、采集异常 —— 一律 null。
   * 消费方必须处理 null（UI 显示「—」而不是 0）。
   */
  score: number | null;
  /** score 为 null 时也为 null。 */
  dimensions: ReconstructionDimensions | null;
  renderStatus: RenderStatus;
  reason?: RenderReason;
  /** score 为 null 时可能缺失（例如渲染就没成功，没有可对比的报告）。 */
  report?: DiffReport;
  evaluatedAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// 统一视图
// ---------------------------------------------------------------------------

/**
 * 质量分与还原度的统一视图。
 *
 * 这是**派生视图**，不是新的存储位置：由 `toVisualEvaluation()` 从 QAResult 生成。
 * 完整明细仍在 `QAResult.reconstructionScore`，避免同一份数据两处存储。
 */
export interface VisualEvaluation {
  /** 兼容字段：等于 quality_score。保留是为了不炸历史消费方。 */
  overall_score: number;
  /** 质量分（0-100）：「这个页面设计得好吗」 */
  quality_score: number;
  /** 还原度（0-100）：「像不像原站」。null = 无法度量。 */
  reconstruction_score: number | null;
  /** 还原度明细：维度分、降级原因、可解释报告。 */
  reconstruction?: ReconstructionScore | null;
}

// ---------------------------------------------------------------------------
// 待落地类型（Step 4 在 src/lib/reconstruction/collect.ts 定义）
// ---------------------------------------------------------------------------

/**
 * 浏览器侧采集的原始视觉 token。
 *
 * 约定：只采集**计算值**，不做任何语义判断。
 * 「哪个是主色」属于语义判断，留在 Node 侧的 diffStyleTokens() 里做。
 *
 * export interface RawStyleTokens {
 *   bodyBackground: string;
 *   bodyColor: string;
 *   colorHistogram: Array<{ color: string; area: number }>;
 *   bodyFontSizePx: number;
 *   bodyFontFamily: string;
 *   headingFontSizePx?: number;
 *   sectionGaps: number[];
 *   containerPaddings: number[];
 *   radii: number[];
 *   visibleElementCount: number;
 *   shadowedElementCount: number;
 * }
 *
 * export interface RawAssets {
 *   imgCount: number;
 *   bgImageCount: number;
 *   svgCount: number;
 *   videoCount: number;
 *   heroMediaCount: number;
 * }
 */
