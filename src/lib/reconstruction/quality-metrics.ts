import type { QualityMetrics, ReconstructionMeta } from '@/types/agent';
import type { ReconstructionScore } from '@/types/reconstruction';

/**
 * B.2.2 — 从 ReconstructionScore 派生 reconstructionMeta。
 *
 * 四态语义在这里落地（docs/B2-CONTRACT-DESIGN-FREEZE.md §4）：
 * - 输入是 `undefined` / `null`（开关未开、重构服务没产出对象）→ 返回 `undefined`，
 *   即**字段不产生**，而不是产出 `{}`、也不是产出带 `0` 的对象。
 * - 有对象但 `score === null` → 这是一次**已执行但不可得**的测量，
 *   必须带上 `degradedReason`（UI 显示「—」而不是 0）。
 *
 * 本函数是纯函数：不 fetch、不读 store、不写日志，方便单测锁语义。
 */
export function deriveReconstructionMeta(
  score: ReconstructionScore | null | undefined,
): ReconstructionMeta | undefined {
  if (!score) return undefined;

  // 参与了对比的区块：与原站真值形成配对的才算「已测量」。
  // extra（克隆页独有）没有可比对的原站区块，不计入。
  const measured = score.report?.layout?.items
    ?.filter((item) => item.status !== 'extra')
    .map((item) => item.role);

  const measuredSections =
    measured && measured.length > 0 ? Array.from(new Set(measured)) : undefined;

  // score 为 null = 有流程但不可得；reason 优先，其次 renderStatus，最后兜底 unknown。
  const degradedReason =
    score.score == null ? score.reason ?? score.renderStatus ?? 'unknown' : undefined;

  const meta: ReconstructionMeta = {
    ...(measuredSections ? { measuredSections } : {}),
    ...(score.report?.layout ? { structuralDiff: score.report.layout } : {}),
    ...(score.report?.style ? { visualDiff: score.report.style } : {}),
    ...(degradedReason ? { degradedReason } : {}),
  };

  // 宁可整个字段不出现，也不产出一个空对象 —— 空对象无法与「未测量」区分。
  return Object.keys(meta).length > 0 ? meta : undefined;
}

/**
 * QAResult → QualityMetrics 的**单向投影**（供 Export / Admin / UI 等新消费方使用）。
 *
 * 三条硬性规则（冻结契约 §3 读取优先级 + §4 状态语义）：
 * 1. 读取优先级 `qualityScore > similarity`：迁移期双字段共存时一律取 `qualityScore`；
 *    仅当 `qualityScore` 缺失（undefined）时才回落到 `similarity` 做历史兜底。
 * 2. `null` 与 `undefined` 不得互换，也**绝不能塌成 0**（`score ?? 0` 是明确禁止的写法）。
 * 3. `reconstructionScore` 从**对象形态**投影为标量 `number | null`：
 *    有对象取 `obj.score`（可能已是 null），没对象时保持 `undefined`。
 *
 * @param qa 生成链路产出的 QA 结果；`undefined` 时返回空对象（未评分 = 无分数字段）
 */
export function toQualityMetrics(qa: {
  similarity?: number;
  qualityScore?: number;
  reconstructionScore?: ReconstructionScore | null;
  reconstructionMeta?: ReconstructionMeta;
}): QualityMetrics {
  const metrics: QualityMetrics = {
    ...(qa.similarity !== undefined ? { similarity: qa.similarity } : {}),
    ...(qa.qualityScore !== undefined ? { qualityScore: qa.qualityScore } : {}),
  };

  const hasReconstructionObject = qa.reconstructionScore !== undefined;
  if (hasReconstructionObject) {
    // 对象存在 → 投影为标量；obj.score 本身可能是 null（不可得），原样保留。
    metrics.reconstructionScore = qa.reconstructionScore?.score ?? null;
  }

  const meta = qa.reconstructionMeta ?? deriveReconstructionMeta(qa.reconstructionScore);
  if (meta) {
    metrics.reconstructionMeta = meta;
  }

  return metrics;
}
