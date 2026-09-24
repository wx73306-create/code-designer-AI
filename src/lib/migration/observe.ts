// =====================================================================
// Migration Phase 3 · Observe — 迁移观察（B.2 契约 §6 第三阶段）
//
// Phase 1 Add / Phase 2 Dual write 已经上线，但「双写到底有没有生效」
// 目前只能靠人肉翻记录。这一阶段把这件事变成可观测的数字：
//
//   1. 新字段覆盖率       —— 有多少记录真的在生产 qualityScore / reconstructionScore
//   2. null（不可得）比例 —— 通道通了但这次算不出来的占比
//   3. 漂移检测           —— similarity 与 qualityScore 是否还一致
//
// 第 3 条是 Phase 4（停止生产 similarity）的前置闸门：双写期两者应当
// 恒等（都取自 visualScore.overall_score），一旦出现漂移，说明有消费方
// 或生产链路被改坏了，此时绝不能进入 Phase 4。
//
// 本模块是纯函数：不读 store、不 fetch、不写日志，方便单测锁口径。
// =====================================================================

import type { ScoreSource } from '@/lib/score-display';

/**
 * 漂移容差。双写期两个字段来自同一个数值，理应完全相等；
 * 留 0.01 是为了吸收 JSON 往返 / toFixed 之类的浮点噪声，
 * 超过这个量级就不是噪声，而是真漂移。
 */
export const DRIFT_TOLERANCE = 0.01;

/**
 * Phase 4 准入要求的最小观察样本数。
 *
 * 为什么不能只判 `total > 0`：那样**跑过一次生成就能让闸门放行**。
 * 而 Phase 4（停止生产 `similarity`）是不可逆的对外行为变化 —— 若还有老客户端
 * 或某条代码路径只依赖 `similarity`，停产后才会在线上暴露，代价是数据缺失。
 * n=1 时的「覆盖率 100%、漂移 0」不具代表性，所以给一个样本下限。
 *
 * 取值 20 是工程判断（不是统计推导）：够覆盖「不同目标站点 / 两种模式 /
 * 还原度开关开与关」的常见组合，又不会让观察期无限拖长。可按实际需要调整。
 */
export const MIN_READINESS_SAMPLES = 20;

export interface MigrationSummary {
  /** 样本总数（由调用方决定口径，通常是「已完成」的生成记录） */
  total: number;

  quality: {
    /** qualityScore 是有限数字 —— 新字段已生产且有值 */
    measured: number;
    /** qualityScore === null —— 新字段在生产，但这次算不出来 */
    unavailable: number;
    /** 新字段 absent，只有老 similarity —— 尚未迁移的历史数据 */
    legacyOnly: number;
    /** 连 similarity 都没有 —— 这次压根没评分 */
    none: number;
    /**
     * 新字段覆盖率 = (measured + unavailable) / total。
     *
     * 注意把 null 计入分子：null 证明新字段**在生产**（通道已通），
     * 只是这次不可得 —— 这正是我们要观测的「迁移是否生效」。
     * total 为 0 时返回 null 而不是 0：0 会被误读成「迁移完全没生效」。
     */
    coverage: number | null;
  };

  reconstruction: {
    measured: number;
    unavailable: number;
    /** 新字段 absent（老客户端 / 开关未开） */
    missing: number;
    coverage: number | null;
  };

  drift: {
    /** qualityScore 与 similarity 同时为数字、可以互相校验的记录数 */
    comparable: number;
    /** 差值超过容差的记录数 —— 双写期应恒为 0 */
    mismatch: number;
    /** 观测到的最大差值；一条都不可比时为 null */
    maxDelta: number | null;
  };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * 汇总一批记录的迁移状态。
 *
 * 「缺失」一律不进分子而不是当作 0 计入 —— 与 B.2.4 `averageMeasured` 同一原则：
 * unknown 不是 guess，拿不到的东西不能假装成测到了。
 */
export function summarizeMigration(records: readonly ScoreSource[]): MigrationSummary {
  let qMeasured = 0;
  let qUnavailable = 0;
  let qLegacyOnly = 0;
  let qNone = 0;

  let rMeasured = 0;
  let rUnavailable = 0;
  let rMissing = 0;

  let comparable = 0;
  let mismatch = 0;
  let maxDelta: number | null = null;

  for (const record of records) {
    // ---- 质量分：新字段优先，null 单独计，只有老字段才算 legacy ----
    if (isFiniteNumber(record.qualityScore)) {
      qMeasured += 1;
    } else if (record.qualityScore === null) {
      qUnavailable += 1;
    } else if (isFiniteNumber(record.similarity)) {
      qLegacyOnly += 1;
    } else {
      qNone += 1;
    }

    // ---- 还原度：不存在「历史兜底」，只有老字段时一律算 missing ----
    if (isFiniteNumber(record.reconstructionScore)) {
      rMeasured += 1;
    } else if (record.reconstructionScore === null) {
      rUnavailable += 1;
    } else {
      rMissing += 1;
    }

    // ---- 漂移：仅当两个字段都有数字时才可比 ----
    if (isFiniteNumber(record.qualityScore) && isFiniteNumber(record.similarity)) {
      comparable += 1;
      const delta = Math.abs(record.qualityScore - record.similarity);
      if (delta > DRIFT_TOLERANCE) mismatch += 1;
      if (maxDelta === null || delta > maxDelta) maxDelta = delta;
    }
  }

  const total = records.length;
  const ratio = (n: number): number | null => (total === 0 ? null : n / total);

  return {
    total,
    quality: {
      measured: qMeasured,
      unavailable: qUnavailable,
      legacyOnly: qLegacyOnly,
      none: qNone,
      coverage: ratio(qMeasured + qUnavailable),
    },
    reconstruction: {
      measured: rMeasured,
      unavailable: rUnavailable,
      missing: rMissing,
      coverage: ratio(rMeasured + rUnavailable),
    },
    drift: { comparable, mismatch, maxDelta },
  };
}

/**
 * Phase 4 的准入建议 —— 只给判断，不替人做决定。
 *
 * 停机理由（任一成立即 blocked）：没有样本 / 存在漂移 / 覆盖率不满 /
 * **样本数少于 {@link MIN_READINESS_SAMPLES}**。
 * 停止生产 similarity 是不可逆的对外行为变化，所以闸门宁紧勿松：
 * 「跑过一次且数据好看」不足以放行，那只是证据不足，不是证据充分。
 */
export type DeprecateReadiness =
  | { kind: 'ready' }
  | { kind: 'blocked'; reason: string };

export function deprecateReadiness(summary: MigrationSummary): DeprecateReadiness {
  if (summary.total === 0) {
    return { kind: 'blocked', reason: '没有任何可观测样本，无从判断迁移是否生效' };
  }
  if (summary.drift.mismatch > 0) {
    return {
      kind: 'blocked',
      reason: `similarity 与 qualityScore 出现 ${summary.drift.mismatch} 条漂移，先查生产链路`,
    };
  }
  if (summary.quality.coverage !== null && summary.quality.coverage < 1) {
    return {
      kind: 'blocked',
      reason: `新字段覆盖率 ${(summary.quality.coverage * 100).toFixed(1)}%，仍有记录未迁移`,
    };
  }
  // 真问题（漂移 / 覆盖率）优先报；到这里说明数据本身没问题，但可能**证据不够**。
  if (summary.total < MIN_READINESS_SAMPLES) {
    return {
      kind: 'blocked',
      reason: `观察样本仅 ${summary.total} 条，少于准入要求的 ${MIN_READINESS_SAMPLES} 条；样本不足时「全覆盖、零漂移」不具代表性`,
    };
  }
  return { kind: 'ready' };
}
