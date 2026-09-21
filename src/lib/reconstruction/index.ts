/**
 * Reconstruction — Public API
 *
 * Phase 2 / Sprint B：还原度度量（「生成的页面像不像原站」）。
 * 类型契约见 src/types/reconstruction.ts，设计冻结文档见
 * docs/phase2-sprintB-reconstruction-diff-design.md。
 */

export { isReconstructionDiffEnabled } from './config';
export { captureScreenshotPair } from './capture-pair';
export type { CapturePairInput, CapturePairResult, OriginalSource } from './capture-pair';
export {
  evaluateReconstruction,
  composeReconstructionScore,
  runReconstruction,
} from './evaluate';
export type {
  EvaluateReconstructionInput,
  SideFingerprints,
  ReconstructionRunResult,
} from './evaluate';
export { getOriginalFingerprints, resetOriginalFingerprintsCache } from './original-layout';
export type { OriginalFingerprints } from './original-layout';
