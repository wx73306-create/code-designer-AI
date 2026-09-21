/**
 * Reconstruction — 配置开关
 * ===================================================================
 * 与 `LAYOUT_PROBE` / `INTERACTION_CAPTURE` 同构：环境变量 `= 'on'` 才开启。
 *
 * **默认关闭**的理由（与 Sprint A 一致）：
 *   1. 需要本机 Chrome，线上环境（腾讯云 Lighthouse）尚未验证；
 *   2. 开启后每次生成会多一次渲染（~3s）与一次模型调用，成本语义变化；
 *   3. 开启后 `QAResult` 多出 `reconstructionScore`，属于产物语义变化，先灰度。
 *
 * 刻意**不做成自动开启**：还原度度量是显式决策，不是静默加餐。
 */

/** 还原度度量是否启用（`RECONSTRUCTION_DIFF=on`）。 */
export function isReconstructionDiffEnabled(): boolean {
  return process.env.RECONSTRUCTION_DIFF === 'on';
}
