// =====================================================================
// B.2.4 — 分数展示映射（Admin / UI 的单一事实来源）
//
// 契约：docs/B2-CONTRACT-DESIGN-FREEZE.md §7（UI Mapping）
//
// 为什么要有这个文件：四态语义（undefined / null / 0 / missing）如果被四个
// admin 页面各写一遍，一定会各自漂移 —— 尤其是 `score ?? 0` 这种写法，会
// 把「没采集」和「算不出来」都变成 0 分显示在看板上。这里定死读法，页面只负责排版。
// =====================================================================

import type { ReconstructionMeta } from '@/types/agent';

/**
 * 展示态。刻意只有三种 —— 与 §4 的四态一一对应，但 `undefined` 与「历史数据不存在」
 * 在 UI 上都是「这一项拿不出来」，合并为 missing。
 */
export type ScoreView =
  /** 有效测量结果（**含 0** —— 0 分是测出来的，不是缺的） */
  | { kind: 'measured'; value: number }
  /** 流程在、但算不出来（null）。reason 来自 reconstructionMeta.degradedReason */
  | { kind: 'unavailable'; reason?: string }
  /** 从没采集过（undefined）/ 历史数据里根本没有这个字段 */
  | { kind: 'missing' };

/** 展示侧只需要这几个字段，避免把整个 GenerationRecord 类型拖进来。 */
export interface ScoreSource {
  /** @deprecated 历史字段，装的一直是质量分；仅在 qualityScore 缺失时兜底 */
  similarity?: number;
  qualityScore?: number | null;
  reconstructionScore?: number | null;
  reconstructionMeta?: ReconstructionMeta;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * 质量分：这个网页设计得好吗？
 *
 * 读取优先级 `qualityScore > similarity`（契约 §3）。
 * `similarity` 是同一指标的历史载体，所以它单独存在时按**质量分**口径展示 ——
 * 绝不能因为字段名叫 similarity 就把它标成「还原度」。
 */
export function readQualityView(source: ScoreSource): ScoreView {
  if (isFiniteNumber(source.qualityScore)) {
    return { kind: 'measured', value: source.qualityScore };
  }
  // null 是「流程在、但算不出来」的明确声明：不回落到 similarity，也不补 0。
  // 与 B.2.2 toQualityMetrics 同口径 —— 只有 undefined（缺失）才回落到历史字段。
  if (source.qualityScore === null) return { kind: 'unavailable' };
  // 历史兜底：老数据只有 similarity，它装的是质量分，按质量分读。
  if (isFiniteNumber(source.similarity)) {
    return { kind: 'measured', value: source.similarity };
  }
  return { kind: 'missing' };
}

/**
 * 还原度：像不像目标网站？
 *
 * **绝不从 similarity 推断** —— similarity 装的是质量分，是两个不同的指标。
 * 历史数据只有 similarity 时，还原度一律 missing（界面显示「—」）。
 */
export function readReconstructionView(source: ScoreSource): ScoreView {
  if (isFiniteNumber(source.reconstructionScore)) {
    return { kind: 'measured', value: source.reconstructionScore };
  }
  if (source.reconstructionScore === null) {
    return { kind: 'unavailable', reason: source.reconstructionMeta?.degradedReason };
  }
  return { kind: 'missing' };
}

/** 格式化为界面文案。missing 用「—」，与既有 admin 空态保持一致。 */
export function formatScoreView(view: ScoreView): string {
  switch (view.kind) {
    case 'measured':
      return `${view.value.toFixed(1)}%`;
    case 'unavailable':
      return view.reason ? `不可用 · ${view.reason}` : '不可用';
    case 'missing':
      return '—';
  }
}

/**
 * 只在 measured 时给出数值，供求平均等统计使用。
 *
 * 统计口径的关键：缺失的记录**不进入分母**，而不是当作 0 分拉低均值 ——
 * 这正是被禁掉的 `g.similarity || 0` 会犯的错。
 */
export function measuredValue(view: ScoreView): number | null {
  return view.kind === 'measured' ? view.value : null;
}

/** 一组记录里所有实测值的平均；一个都没有则返回 null（不返回 0）。 */
export function averageMeasured(views: readonly ScoreView[]): number | null {
  const values = views
    .map(measuredValue)
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** 分数配色：≥90 绿、≥75 琥珀、其余灰；不可用/缺失不参与配色。 */
export function scoreToneClass(view: ScoreView): string {
  if (view.kind !== 'measured') return 'text-white/30';
  if (view.value >= 90) return 'text-emerald-400';
  if (view.value >= 75) return 'text-amber-400';
  return 'text-white/60';
}
