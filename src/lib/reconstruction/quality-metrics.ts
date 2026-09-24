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
 * B.2.3.1 — 把「还原度这次到底有没有产生」编码进结果字段（四态语义的最后一环）。
 *
 * 冻结契约 §2/§3 要求：**开关关闭时 `reconstructionScore` 根本不产生**（`undefined`），
 * 而不是产出一个 `null` —— `null` 的语义专指「已尝试度量但不可得」。
 * 修复前 `use-workflow.ts` 无条件写入 `reconstructionScore: null`，
 * 于是「未开启」被读成「不可得」：迁移观察页把它记进 `unavailable`，
 * 而覆盖率口径把 `null` 计入分子 → **会让人误判「还原度迁移已生效」**。
 *
 * - `ran === false`（服务端未开启度量）→ 不含该键
 * - `ran === true` + `score === null`  → `null`（不可得，由 degradedReason 说明原因）
 * - `ran === true` + 有效对象          → 原样保留（其 `score` 本身仍可能是 `null`）
 *
 * 传输层失败（请求抛错 / 中断）时拿不到「服务端是否开启」的证据，
 * 因此**保守地不产生字段**，而不是伪造一个 `null` 状态。
 */
export function reconstructionFields(
  ran: boolean,
  score: ReconstructionScore | null,
): { reconstructionScore?: ReconstructionScore | null } {
  return ran ? { reconstructionScore: score } : {};
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
