// =====================================================================
// Generation Ledger — 生成记录的持久化观察账本
//
// 背景：`liveStats` 是纯内存的，容器一重启/重新部署就清零。而 B.2 契约 §6 的
// Phase 3（Observe）要「积累样本后再决定是否停用 similarity」——样本必须活过重启，
// 否则观察期永远攒不够，Phase 4 的准入闸门（observe.ts 的 MIN_READINESS_SAMPLES）
// 永远不会开口。
//
// 本模块只负责三件事，且**都不参与 UI 渲染路径**：
//   1. 把埋点事件写成 DB 行（upsert by externalId，失败不影响埋点响应）
//   2. 把「已完成」的行映射回 ScoreSource[]（供 summarizeMigration 统计）
//   3. 四态语义的显式表达（见下）
//
// 四态为什么需要布尔位：SQL 的 NULL 无法区分「字段未产生(undefined)」与
// 「已尝试但不可得(null)」。若把两者都存成 NULL，就等于把 B.2.3.1 刚修掉的
// 「null 冒充不可得」问题原封不动搬进数据库。因此：
//   produced=false              → 未产生（undefined；观察口径记 missing）
//   produced=true + score=null  → 已尝试但不可得（记 unavailable）
//   produced=true + score=数值  → 有效测量（含 0；记 measured）
// =====================================================================

import { prisma } from '@/lib/prisma';
import type { ScoreSource } from '@/lib/score-display';

/** 账本里与四态语义相关的那几列（行 → ScoreSource 映射的输入）。 */
export interface LedgerScoreColumns {
  similarity: number | null;
  qualityScore: number | null;
  qualityScoreProduced: boolean;
  reconstructionScore: number | null;
  reconstructionScoreProduced: boolean;
}

/**
 * 行 → 观察口径的 ScoreSource。
 *
 * 纯函数，方便单测锁死四态：**没产生过的字段不能出现在返回值里**（`in` 判定为 false），
 * 而产生过且不可得的字段必须存在且为 `null`。这两者在关系型存储里最容易塌缩。
 */
export function rowToScoreSource(row: LedgerScoreColumns): ScoreSource {
  const source: ScoreSource = {};

  // similarity 是可选的 deprecated 数字，没有「不可得」态
  if (row.similarity !== null) source.similarity = row.similarity;

  if (row.qualityScoreProduced) source.qualityScore = row.qualityScore;
  if (row.reconstructionScoreProduced) source.reconstructionScore = row.reconstructionScore;

  return source;
}

/** 埋点上报的可选数值：只在“确实上报过”时才会有值（含显式 null）。 */
function producedNumber(value: unknown): { produced: boolean; value: number | null } {
  if (typeof value === 'number' && Number.isFinite(value)) return { produced: true, value };
  if (value === null) return { produced: true, value: null };
  return { produced: false, value: null };
}

export interface GenerationStartInput {
  id: string;
  user?: string;
  email?: string;
  url: string;
  goal?: string;
  model?: string;
}

/**
 * 记录生成开始。失败只记日志、不抛出 —— 埋点路径绝不能因为账本问题影响主流程。
 */
export async function recordGenerationStart(input: GenerationStartInput): Promise<void> {
  try {
    const now = new Date();
    await prisma.generation.upsert({
      where: { externalId: input.id },
      create: {
        externalId: input.id,
        user: input.user,
        email: input.email,
        url: input.url,
        goal: input.goal,
        model: input.model,
        status: 'running',
        startedAt: now,
      },
      update: {
        status: 'running',
        completedAt: null,
      },
    });
  } catch (err) {
    console.warn('[Ledger] recordGenerationStart failed:', err instanceof Error ? err.message : err);
  }
}

export interface GenerationCompleteInput {
  id: string;
  /** create 路径的兜底身份信息（若 generation_start 从未到达） */
  url?: string;
  user?: string;
  email?: string;
  goal?: string;
  model?: string;
  files?: number;
  tokens?: number;
  durationMs?: number;
  similarity?: number;
  qualityScore?: number | null;
  reconstructionScore?: number | null;
  reconstructionMeta?: unknown;
}

/** 记录生成完成（含 B.2 双分数字段与四态标记）。 */
export async function recordGenerationComplete(input: GenerationCompleteInput): Promise<void> {
  try {
    const quality = producedNumber(input.qualityScore);
    const reconstruction = producedNumber(input.reconstructionScore);

    const data = {
      status: 'completed',
      completedAt: new Date(),
      files: input.files,
      tokens: input.tokens,
      durationMs: input.durationMs,
      similarity: typeof input.similarity === 'number' ? input.similarity : null,
      qualityScore: quality.value,
      qualityScoreProduced: quality.produced,
      reconstructionScore: reconstruction.value,
      reconstructionScoreProduced: reconstruction.produced,
      reconstructionMeta:
        input.reconstructionMeta === undefined
          ? undefined
          : (input.reconstructionMeta as object),
    };

    await prisma.generation.upsert({
      where: { externalId: input.id },
      create: {
        externalId: input.id,
        url: input.url ?? '',
        user: input.user,
        email: input.email,
        goal: input.goal,
        model: input.model,
        startedAt: new Date(),
        ...data,
      },
      update: data,
    });
  } catch (err) {
    console.warn('[Ledger] recordGenerationComplete failed:', err instanceof Error ? err.message : err);
  }
}

/** 记录生成失败 / 取消（终态），使账本不残留 running 行。 */
export async function recordGenerationEnd(
  id: string,
  status: 'error' | 'cancelled',
  error?: string,
): Promise<void> {
  try {
    await prisma.generation.updateMany({
      where: { externalId: id },
      data: { status, error, completedAt: new Date() },
    });
  } catch (err) {
    console.warn('[Ledger] recordGenerationEnd failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * 读取所有「已完成」的生成，映射为观察口径的样本。
 *
 * 分母口径与 Phase 3 约定一致：**只统计已完成的任务**（running / error 本来就没有分数，
 * 计入分母只会稀释覆盖率，让迁移看起来比实际更差）。
 * 账本为空或库不可用时返回空数组 —— 观察页会显示「没有可观测样本」，而不是伪造 0%。
 */
export async function loadCompletedScoreSources(): Promise<ScoreSource[]> {
  try {
    const rows = await prisma.generation.findMany({
      where: { status: 'completed' },
      select: {
        similarity: true,
        qualityScore: true,
        qualityScoreProduced: true,
        reconstructionScore: true,
        reconstructionScoreProduced: true,
      },
      orderBy: { completedAt: 'asc' },
    });
    return rows.map(rowToScoreSource);
  } catch (err) {
    console.warn('[Ledger] loadCompletedScoreSources failed:', err instanceof Error ? err.message : err);
    return [];
  }
}
