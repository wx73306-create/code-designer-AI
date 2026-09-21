/**
 * diff/score — 还原度总分合成与 style_drift 标签
 * ===================================================================
 * Phase 2 / Sprint B Step 4。纯函数，不碰浏览器。
 *
 * ## 权重（冻结文档 §4.6，初始设定，有效性由 §8.3 对照实验检验）
 *
 *   第一层 布局结构 52%：roleSequence 22 + heightProfile 18 + blockGeometry 12
 *   第二层 视觉 token 38%：color 15 + typography 8 + spacing 7 + radius 5 + shadow 3
 *   第三层 asset      10%：mediaDensity 10
 *
 * ## style_drift 标签
 *
 * 结构化 diff 的价值不在那个总分，而在 notes：它能告诉 Code Agent
 * 「hero 高度 -23%」「feature columns 3→4」「+rounded」，可以反向驱动修复。
 * 标签里的数值一律用实测值填充，不写死文案。
 */

import type {
  AssetDiff,
  DiffReport,
  LayoutDiff,
  ReconstructionDimensions,
  StyleTokenDiff,
} from '@/types/reconstruction';

// ---------------------------------------------------------------------------
// 权重（合计 1.00）
// ---------------------------------------------------------------------------

export const RECONSTRUCTION_WEIGHTS: Record<keyof ReconstructionDimensions, number> = {
  roleSequence: 0.22,
  heightProfile: 0.18,
  blockGeometry: 0.12,
  colorTokens: 0.15,
  typography: 0.08,
  spacing: 0.07,
  radius: 0.05,
  shadow: 0.03,
  mediaDensity: 0.1,
};

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

export interface ReconstructionEvaluation {
  dimensions: ReconstructionDimensions;
  score: number;
  notes: string[];
}

/**
 * 三层 diff → 九维分数 + 总分 + 漂移标签。
 * 输入的三层 diff 已由 diffLayout / diffStyleTokens / diffAssets 产出。
 */
export function computeReconstructionScore(input: {
  layout: LayoutDiff;
  style: StyleTokenDiff;
  assets: AssetDiff;
}): ReconstructionEvaluation {
  const dimensions = computeDimensions(input.layout, input.style, input.assets);
  const score = round1(
    (Object.keys(RECONSTRUCTION_WEIGHTS) as Array<keyof ReconstructionDimensions>).reduce(
      (total, dim) => total + RECONSTRUCTION_WEIGHTS[dim] * dimensions[dim],
      0,
    ),
  );
  return {
    dimensions,
    score: Math.min(100, Math.max(0, Math.round(score))),
    notes: buildDiffNotes(input.layout, input.style, input.assets),
  };
}

/** 组装完整 DiffReport（score / dimensions / notes 一起算好放进去）。 */
export function buildDiffReport(input: {
  layout: LayoutDiff;
  style: StyleTokenDiff;
  assets: AssetDiff;
}): DiffReport {
  const evaluation = computeReconstructionScore(input);
  return {
    layout: input.layout,
    style: input.style,
    assets: input.assets,
    dimensions: evaluation.dimensions,
    notes: evaluation.notes,
  };
}

// ---------------------------------------------------------------------------
// 九维分数
// ---------------------------------------------------------------------------

function computeDimensions(
  layout: LayoutDiff,
  style: StyleTokenDiff,
  assets: AssetDiff,
): ReconstructionDimensions {
  return {
    roleSequence: round1(layout.roleSequenceCoverage * 100),

    heightProfile: round1((1 - Math.min(layout.heightProfileDistance, 1)) * 100),

    blockGeometry: computeBlockGeometry(layout),

    colorTokens: computeColorTokens(style),

    typography: computeTypography(style),

    spacing: computeSpacing(style),

    radius: computeRadius(style),

    shadow: computeShadow(style),

    mediaDensity: computeMediaDensity(assets),
  };
}

/** matched 区块中（列数 + 对齐 + 通栏）三项全中的比例 ×100。 */
function computeBlockGeometry(layout: LayoutDiff): number {
  const matched = layout.items.filter(
    (item) =>
      item.status === 'matched' &&
      item.columnDelta !== undefined &&
      item.alignmentMatch !== undefined &&
      item.fullBleedMatch !== undefined,
  );
  if (matched.length === 0) return 0;

  let hits = 0;
  for (const item of matched) {
    if (item.columnDelta === 0) hits++;
    if (item.alignmentMatch) hits++;
    if (item.fullBleedMatch) hits++;
  }
  return round1((hits / (matched.length * 3)) * 100);
}

function computeColorTokens(style: StyleTokenDiff): number {
  const deltas = [style.background, style.text, style.primary];
  let sum = 0;
  let count = 0;
  for (const delta of deltas) {
    if (!delta) continue; // 两边都没有 → 一致，不参与
    sum += delta.distance;
    count++;
  }
  if (count === 0) return 100;
  return round1((1 - sum / count) * 100);
}

function computeTypography(style: StyleTokenDiff): number {
  const ratioScore =
    style.fontSizeRatio !== undefined
      ? Math.min(style.fontSizeRatio, 1 / style.fontSizeRatio) // min(r, 1/r) ∈ (0, 1]
      : 1; // 字号缺失（两边都 0）→ 一致
  const overlap = style.fontFamilyOverlap ?? 1;
  return round1(50 * ratioScore + 50 * overlap);
}

function computeSpacing(style: StyleTokenDiff): number {
  const gapScore = style.sectionGap ? style.sectionGap.ratio : 1;
  const paddingScore = style.containerPadding ? style.containerPadding.ratio : 1;
  return round1(60 * gapScore + 40 * paddingScore);
}

/** 超过 24px 的圆角差异视为完全不一致（方形 ↔ 全圆角）。 */
function computeRadius(style: StyleTokenDiff): number {
  if (!style.radius) return 100;
  const delta = Math.abs(style.radius.clone - style.radius.original);
  return round1((1 - Math.min(delta / 24, 1)) * 100);
}

function computeShadow(style: StyleTokenDiff): number {
  if (!style.shadowCoverage) return 100;
  return round1((1 - Math.min(Math.abs(style.shadowCoverage.delta), 1)) * 100);
}

function computeMediaDensity(assets: AssetDiff): number {
  const ratioScore = assets.ratio;
  const heroMatch = assets.heroHasMediaOriginal === assets.heroHasMediaClone ? 1 : 0;
  return round1(60 * ratioScore + 40 * heroMatch);
}

// ---------------------------------------------------------------------------
// style_drift 标签（冻结文档 §4.4 规则表）
// ---------------------------------------------------------------------------

export function buildDiffNotes(layout: LayoutDiff, style: StyleTokenDiff, assets: AssetDiff): string[] {
  const notes: string[] = [];

  // ---- 布局层 ----
  for (const item of layout.items) {
    if (item.status === 'missing') {
      notes.push(`${item.role} missing`);
      continue;
    }
    if (item.status === 'extra') {
      notes.push(`${item.role} extra (原站没有此区块)`);
      continue;
    }
    if (item.heightPxRatio !== undefined && Math.abs(item.heightPxRatio - 1) > 0.2) {
      const pct = Math.round((item.heightPxRatio - 1) * 100);
      notes.push(`${item.role} height ${pct >= 0 ? '+' : ''}${pct}%`);
    }
    if (item.columnDelta !== undefined && item.columnDelta !== 0) {
      notes.push(`${item.role} columns ${item.originalColumns ?? '?'}→${item.cloneColumns ?? '?'}`);
    }
    if (item.alignmentMatch === false) {
      notes.push(`${item.role} alignment mismatch`);
    }
  }

  // ---- 视觉 token 层 ----
  if (style.radius) {
    if (style.radius.clone - style.radius.original >= 8) notes.push('+rounded');
    else if (style.radius.original - style.radius.clone >= 8) notes.push('-rounded');
  }
  if (style.shadowCoverage) {
    if (style.shadowCoverage.delta >= 0.15) notes.push('+shadow');
    else if (style.shadowCoverage.delta <= -0.15) notes.push('-shadow');
  }
  if (style.background && style.background.distance >= 0.15) notes.push('-color mismatch (background)');
  if (style.text && style.text.distance >= 0.15) notes.push('-color mismatch (text)');
  if (style.primary && style.primary.distance >= 0.15) notes.push('-color mismatch (primary)');

  if (style.sectionGap) {
    const ratio = style.sectionGap.ratio;
    if (ratio <= 0.7) notes.push('-spacing (section gap 更挤)');
    else if (ratio > 1 && style.sectionGap.clone / Math.max(style.sectionGap.original, 1) >= 1.3) {
      notes.push('+spacing (section gap 更松)');
    }
  }
  if (style.fontSizeRatio !== undefined && (style.fontSizeRatio <= 0.7 || style.fontSizeRatio >= 1.4)) {
    notes.push(`-font size (clone/original = ${style.fontSizeRatio.toFixed(2)})`);
  }

  // ---- 资源层 ----
  if (assets.heroHasMediaOriginal && !assets.heroHasMediaClone) {
    notes.push('-hero media missing');
  }
  if (assets.originalImageCount > 0 && assets.cloneImageCount === 0) {
    notes.push('-media missing (原站有图，生成页全无)');
  }

  return notes;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
