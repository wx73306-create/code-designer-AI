/**
 * Visual Evaluation & Auto Optimization System — Public API
 * 统一导出评分模型、Prompt 构建器与规范化工具。
 */

export {
  DIMENSION_WEIGHTS,
  DIMENSION_LABELS,
  DIMENSION_THRESHOLDS,
  OVERALL_PASS_THRESHOLD,
  MAX_OPTIMIZATION_ROUNDS,
  computeOverallScore,
  shouldOptimize,
} from './scoring';
export type { OptimizationDecision } from './scoring';

export {
  buildVisualEvaluationSystemPrompt,
  buildVisualEvaluationUserMessage,
  buildOptimizationPlanSystemPrompt,
  buildOptimizationPlanUserMessage,
} from './prompt';

export { normalizeVisualScore } from './schema';
