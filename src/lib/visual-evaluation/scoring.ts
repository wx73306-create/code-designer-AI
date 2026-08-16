/**
 * Visual Evaluation — Scoring Model
 * 六维视觉评分模型（总分 100）。
 *
 * 权重（来自开发规范 V1.0）：
 *   layout_score:     20%
 *   visual_balance:   15%
 *   spacing_score:    15%
 *   color_score:      15%
 *   typography_score: 15%
 *   premium_score:    20%  ⭐ 最重要
 */

import type { VisualScoreDimensions } from '@/types/agent';

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

export const DIMENSION_WEIGHTS: Record<keyof VisualScoreDimensions, number> = {
  layout_score: 0.20,
  visual_balance: 0.15,
  spacing_score: 0.15,
  color_score: 0.15,
  typography_score: 0.15,
  premium_score: 0.20,
};

/** 维度中文标签（用于 UI 与日志） */
export const DIMENSION_LABELS: Record<keyof VisualScoreDimensions, string> = {
  layout_score: '布局',
  visual_balance: '视觉平衡',
  spacing_score: '空间留白',
  color_score: '色彩',
  typography_score: '字体',
  premium_score: '高级感',
};

// ---------------------------------------------------------------------------
// Overall Score
// ---------------------------------------------------------------------------

/** 加权合成总分（0-100） */
export function computeOverallScore(scores: VisualScoreDimensions): number {
  let total = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    const value = scores[dim as keyof VisualScoreDimensions] ?? 0;
    total += value * weight;
  }
  return Math.round(total * 10) / 10;
}

// ---------------------------------------------------------------------------
// Optimization Thresholds（自动优化判断逻辑）
// ---------------------------------------------------------------------------

/** 触发优化的总分阈值：overall_score >= 90 则通过 */
export const OVERALL_PASS_THRESHOLD = 90;

/** 各维度触发优化的阈值（来自规范第七节） */
export const DIMENSION_THRESHOLDS: Partial<Record<keyof VisualScoreDimensions, number>> = {
  premium_score: 80,    // premium_score < 80 → startOptimization()
  layout_score: 75,     // layout_score < 75 → fixLayout()
  color_score: 75,      // color_score < 75 → fixColor()
  typography_score: 80, // typography_score < 80 → fixTypography()
};

/** 最多自动循环优化次数 */
export const MAX_OPTIMIZATION_ROUNDS = 3;

export interface OptimizationDecision {
  needsOptimization: boolean;
  reasons: string[];
}

/**
 * 判断是否需要自动优化。
 * 规则：overall_score < 90，或任一关键维度低于阈值。
 */
export function shouldOptimize(scores: VisualScoreDimensions, overall: number): OptimizationDecision {
  const reasons: string[] = [];

  if (overall < OVERALL_PASS_THRESHOLD) {
    reasons.push(`总分 ${overall} < ${OVERALL_PASS_THRESHOLD}`);
  }

  for (const [dim, threshold] of Object.entries(DIMENSION_THRESHOLDS)) {
    const value = scores[dim as keyof VisualScoreDimensions] ?? 0;
    if (value < (threshold as number)) {
      reasons.push(`${DIMENSION_LABELS[dim as keyof VisualScoreDimensions]} ${value} < ${threshold}`);
    }
  }

  return {
    needsOptimization: reasons.length > 0,
    reasons,
  };
}
