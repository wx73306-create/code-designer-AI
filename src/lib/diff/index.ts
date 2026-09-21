/**
 * diff — Public API
 *
 * Phase 2 / Sprint B Step 4：结构化还原度 diff（纯函数层）。
 * 浏览器侧采集器（RawStyleTokens / RawAssets 的产出方）在 Step 5 的
 * src/lib/reconstruction/collect.ts 实现。
 */

export { diffLayout } from './layout-diff';
export { diffStyleTokens } from './style-diff';
export { diffAssets } from './asset-diff';
export {
  computeReconstructionScore,
  buildDiffReport,
  buildDiffNotes,
  RECONSTRUCTION_WEIGHTS,
} from './score';
export type { ReconstructionEvaluation } from './score';
export { colorDistance, median, pairwiseRatio, parseRgb, pickPrimaryColor } from './style-diff';
export type { RawStyleTokens } from './style-diff';
export type { RawAssets } from './asset-diff';
