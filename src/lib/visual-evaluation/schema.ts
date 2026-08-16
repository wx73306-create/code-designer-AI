/**
 * Visual Evaluation — Schema Normalization
 * 将 AI 返回的原始对象规范化为 VisualScore，保证每个字段可用。
 */

import type { VisualScore, VisualScoreDimensions, VisualProblem } from '@/types/agent';
import { computeOverallScore } from './scoring';

const DEFAULT_DIMENSIONS: VisualScoreDimensions = {
  layout_score: 80,
  visual_balance: 78,
  spacing_score: 76,
  color_score: 82,
  typography_score: 80,
  premium_score: 70,
};

const VALID_PROBLEM_TYPES = new Set([
  'layout', 'balance', 'spacing', 'color', 'typography', 'premium',
]);

function clampScore(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(100, Math.max(0, Math.round(num)));
}

/**
 * 规范化 AI 返回的视觉评分对象。
 * 兼容 { scores: {...}, problems: [...] } 与扁平结构。
 */
export function normalizeVisualScore(raw: unknown, round?: number): VisualScore {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  // scores 可能在 obj.scores 里，也可能扁平地挂在 obj 上
  const scoresSrc = (obj.scores && typeof obj.scores === 'object'
    ? obj.scores
    : obj) as Record<string, unknown>;

  const scores: VisualScoreDimensions = {
    layout_score: clampScore(scoresSrc.layout_score, DEFAULT_DIMENSIONS.layout_score),
    visual_balance: clampScore(scoresSrc.visual_balance, DEFAULT_DIMENSIONS.visual_balance),
    spacing_score: clampScore(scoresSrc.spacing_score, DEFAULT_DIMENSIONS.spacing_score),
    color_score: clampScore(scoresSrc.color_score, DEFAULT_DIMENSIONS.color_score),
    typography_score: clampScore(scoresSrc.typography_score, DEFAULT_DIMENSIONS.typography_score),
    premium_score: clampScore(scoresSrc.premium_score, DEFAULT_DIMENSIONS.premium_score),
  };

  // problems 数组
  const rawProblems = Array.isArray(obj.problems) ? obj.problems : [];
  const problems: VisualProblem[] = rawProblems
    .map((p) => {
      const prob = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      const type = typeof prob.type === 'string' && VALID_PROBLEM_TYPES.has(prob.type)
        ? (prob.type as VisualProblem['type'])
        : 'premium';
      const description = typeof prob.description === 'string' && prob.description.trim()
        ? prob.description.trim()
        : '';
      return description ? { type, description } : null;
    })
    .filter((p): p is VisualProblem => p !== null)
    .slice(0, 12);

  // overall：优先用加权计算，保证与权重模型一致
  const overall = typeof obj.overall_score === 'number'
    ? Math.min(100, Math.max(0, Math.round(obj.overall_score)))
    : computeOverallScore(scores);

  return {
    overall_score: overall,
    scores,
    problems,
    round: round ?? 1,
  };
}
