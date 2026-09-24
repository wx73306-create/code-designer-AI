import type { ReconstructionMeta } from '@/types/agent';

/**
 * B.2.3 — API 边界的分数字段取值器。
 *
 * 冻结合约 §4 要求三态互不塌缩，而 JSON 边界最容易出事：
 * `typeof v === 'number' ? v : undefined` 这种常见写法会把显式的 `null`
 * （「有流程但不可得」）悄悄变成 `undefined`（「从没上报」），四态被压成两态。
 *
 * 这里定死映射：
 * - `null`            → `null`      （不可得，必须保留，UI 显示「—」）
 * - 有限数字           → number      （有效测量值，**包括 0**）
 * - `undefined`/其他   → `undefined` （老客户端 / 未采集 → 字段不写入）
 */
export function pickScore(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

/**
 * reconstructionMeta 的边界校验：只接受非数组的普通对象。
 *
 * 不逐字段深校验 —— meta 明细（structuralDiff / visualDiff）目前仍是 evolving shape，
 * 深校验会让每次扩展都炸在 API 边界上；这里只挡住明显不合法的形状。
 */
export function pickReconstructionMeta(value: unknown): ReconstructionMeta | undefined {
  if (value === undefined) return undefined;
  if (value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as ReconstructionMeta;
}
