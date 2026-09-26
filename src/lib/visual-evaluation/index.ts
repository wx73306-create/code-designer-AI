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

export { normalizeVisualScore, scoreProvenance } from './schema';
export type { ScoreProvenance } from './schema';

export { normalizeOptimizationPlan, formatOptimizationIssues } from './plan';

/**
 * QA 报告产物（P3-11 / P3-08）：可归档的 qa-report.json + 人读 Markdown。
 *
 * ⚠️ **这里只导出纯函数 —— 不要在这里加 `writeQaReport`。**
 * 本 barrel 被 `src/app/page.tsx`（Client Component）引入，而写盘依赖
 * `node:fs/promises`；一旦经此导出，客户端 chunk 会尝试打包它，
 * `next build` 会以 "does not support external modules" 失败（已踩过一次）。
 * 落盘入口在 `./report-write`，只允许服务端代码直接 import。
 */
export {
  buildQaReport,
  renderQaReportMarkdown,
  extractProblems,
} from './report';
export type {
  QaReport,
  QaReportProblem,
  QaReportDimension,
  BuildQaReportInput,
} from './report';
