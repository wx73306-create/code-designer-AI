import { describe, expect, it } from 'vitest';

import { rowToScoreSource } from './generation-ledger';
import { summarizeMigration } from './observe';

/** 造一行账本数据（只关心四态相关列）。 */
function row(overrides: Partial<Parameters<typeof rowToScoreSource>[0]> = {}) {
  return {
    similarity: null,
    qualityScore: null,
    qualityScoreProduced: false,
    reconstructionScore: null,
    reconstructionScoreProduced: false,
    ...overrides,
  };
}

describe('rowToScoreSource — 四态不能塌缩', () => {
  it('未产生 → 返回值里根本没有该键（不是 null）', () => {
    const src = rowToScoreSource(row());
    expect('qualityScore' in src).toBe(false);
    expect('reconstructionScore' in src).toBe(false);
    expect('similarity' in src).toBe(false);
    expect(src.qualityScore).toBeUndefined();
  });

  it('已尝试但不可得 → 键存在且为 null', () => {
    const src = rowToScoreSource(
      row({ qualityScoreProduced: true, reconstructionScoreProduced: true }),
    );
    expect('qualityScore' in src).toBe(true);
    expect(src.qualityScore).toBeNull();
    expect('reconstructionScore' in src).toBe(true);
    expect(src.reconstructionScore).toBeNull();
  });

  it('有效测得 0 分 → 键存在且为 0（0 是有效测量，不能被当 falsy 丢掉）', () => {
    const src = rowToScoreSource(
      row({ qualityScoreProduced: true, qualityScore: 0, reconstructionScoreProduced: true, reconstructionScore: 0 }),
    );
    expect(src.qualityScore).toBe(0);
    expect(src.reconstructionScore).toBe(0);
  });

  it('similarity 是可选的 deprecated 数字，没有「不可得」态', () => {
    expect(rowToScoreSource(row({ similarity: 77.4 })).similarity).toBe(77.4);
    expect('similarity' in rowToScoreSource(row())).toBe(false);
    // 即便 similarity 为 0 也要保留
    expect(rowToScoreSource(row({ similarity: 0 })).similarity).toBe(0);
  });

  it('与 observe 口径串联：三态分别落进 measured / unavailable / missing', () => {
    const measured = summarizeMigration([
      rowToScoreSource(row({ qualityScoreProduced: true, qualityScore: 88, reconstructionScoreProduced: true, reconstructionScore: 60, similarity: 88 })),
    ]);
    expect(measured.quality.measured).toBe(1);
    expect(measured.reconstruction.measured).toBe(1);

    const unavailable = summarizeMigration([
      rowToScoreSource(row({ qualityScoreProduced: true, qualityScore: null, reconstructionScoreProduced: true, reconstructionScore: null, similarity: 88 })),
    ]);
    expect(unavailable.quality.unavailable).toBe(1);
    expect(unavailable.reconstruction.unavailable).toBe(1);

    const notProduced = summarizeMigration([
      rowToScoreSource(row({ similarity: 88 })),
    ]);
    // 质量分：只有老字段 → legacyOnly；还原度：字段没产生 → missing
    expect(notProduced.quality.legacyOnly).toBe(1);
    expect(notProduced.reconstruction.missing).toBe(1);
    expect(notProduced.reconstruction.coverage).toBe(0);
  });

  it('「未产生」与「不可得」在覆盖率口径上必须不同（修复前的坑）', () => {
    const notProduced = summarizeMigration([rowToScoreSource(row({ similarity: 88 }))]);
    const unavailable = summarizeMigration([
      rowToScoreSource(row({ similarity: 88, reconstructionScoreProduced: true, reconstructionScore: null })),
    ]);
    // 覆盖率把「不可得」计入分子（证明通道已通），「未产生」不计
    expect(notProduced.reconstruction.coverage).toBe(0);
    expect(unavailable.reconstruction.coverage).toBe(1);
  });
});
