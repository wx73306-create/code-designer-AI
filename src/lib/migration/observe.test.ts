import { describe, expect, it } from 'vitest';

import { deprecateReadiness, summarizeMigration } from './observe';

describe('summarizeMigration — 覆盖率口径', () => {
  it('空样本 → 覆盖率是 null 而不是 0（0 会被误读成「迁移没生效」）', () => {
    const s = summarizeMigration([]);
    expect(s.total).toBe(0);
    expect(s.quality.coverage).toBeNull();
    expect(s.reconstruction.coverage).toBeNull();
    expect(s.drift.maxDelta).toBeNull();
  });

  it('新字段全都有值 → 覆盖率 100%', () => {
    const s = summarizeMigration([
      { qualityScore: 91, reconstructionScore: 87 },
      { qualityScore: 0, reconstructionScore: 0 },
    ]);
    expect(s.quality).toMatchObject({ measured: 2, unavailable: 0, legacyOnly: 0, none: 0 });
    expect(s.quality.coverage).toBe(1);
    expect(s.reconstruction.coverage).toBe(1);
  });

  it('null 计入覆盖率 —— 它证明新字段在生产，只是这次不可得', () => {
    const s = summarizeMigration([{ qualityScore: null, reconstructionScore: null }, {}]);
    expect(s.quality.unavailable).toBe(1);
    expect(s.quality.coverage).toBe(0.5);
    expect(s.reconstruction.unavailable).toBe(1);
    expect(s.reconstruction.coverage).toBe(0.5);
  });

  it('只有 similarity 的历史数据 → 算 legacyOnly，不算新字段覆盖', () => {
    const s = summarizeMigration([{ similarity: 88 }]);
    expect(s.quality).toMatchObject({ measured: 0, unavailable: 0, legacyOnly: 1, none: 0 });
    expect(s.quality.coverage).toBe(0);
    // 还原度没有历史兜底：只有 similarity 时一律 missing
    expect(s.reconstruction.missing).toBe(1);
    expect(s.reconstruction.coverage).toBe(0);
  });

  it('两个字段都没有 → none', () => {
    const s = summarizeMigration([{}]);
    expect(s.quality.none).toBe(1);
    expect(s.quality.coverage).toBe(0);
  });

  it('0 分是实测值，不能被判成缺失', () => {
    const s = summarizeMigration([{ qualityScore: 0, reconstructionScore: 0 }]);
    expect(s.quality.measured).toBe(1);
    expect(s.reconstruction.measured).toBe(1);
  });
});

describe('summarizeMigration — 漂移检测', () => {
  it('双写一致 → 可比、不漂移', () => {
    const s = summarizeMigration([{ qualityScore: 91, similarity: 91 }]);
    expect(s.drift).toEqual({ comparable: 1, mismatch: 0, maxDelta: 0 });
  });

  it('浮点噪声在容差内 → 不算漂移', () => {
    const s = summarizeMigration([{ qualityScore: 91.005, similarity: 91 }]);
    expect(s.drift.mismatch).toBe(0);
    expect(s.drift.maxDelta).toBeCloseTo(0.005, 5);
  });

  it('真漂移会被抓到，并记录最大差值', () => {
    const s = summarizeMigration([
      { qualityScore: 91, similarity: 88 },
      { qualityScore: 70, similarity: 70.5 },
    ]);
    expect(s.drift).toMatchObject({ comparable: 2, mismatch: 2 });
    expect(s.drift.maxDelta).toBe(3);
  });

  it('只有一个字段时不参与比较（不制造假漂移）', () => {
    const s = summarizeMigration([{ qualityScore: 91 }, { similarity: 88 }]);
    expect(s.drift.comparable).toBe(0);
    expect(s.drift.mismatch).toBe(0);
    expect(s.drift.maxDelta).toBeNull();
  });
});

describe('deprecateReadiness — Phase 4 闸门', () => {
  it('没有样本 → blocked', () => {
    expect(deprecateReadiness(summarizeMigration([]))).toEqual({
      kind: 'blocked',
      reason: expect.stringContaining('没有任何可观测样本'),
    });
  });

  it('有漂移 → blocked，且优先于覆盖率判断', () => {
    const s = summarizeMigration([
      { qualityScore: 91, similarity: 88 },
      { qualityScore: 92, similarity: 92 },
    ]);
    expect(s.quality.coverage).toBe(1);
    expect(deprecateReadiness(s).kind).toBe('blocked');
    expect(deprecateReadiness(s)).toMatchObject({ reason: expect.stringContaining('漂移') });
  });

  it('覆盖率不满 → blocked', () => {
    const s = summarizeMigration([{ qualityScore: 91 }, { similarity: 70 }]);
    expect(deprecateReadiness(s)).toMatchObject({
      kind: 'blocked',
      reason: expect.stringContaining('覆盖率'),
    });
  });

  it('全覆盖且无漂移 → ready', () => {
    const s = summarizeMigration([{ qualityScore: 91, similarity: 91 }]);
    expect(deprecateReadiness(s)).toEqual({ kind: 'ready' });
  });
});
