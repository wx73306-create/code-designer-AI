import { describe, expect, it } from 'vitest';

import {
  averageMeasured,
  formatScoreView,
  measuredValue,
  readQualityView,
  readReconstructionView,
  scoreToneClass,
} from './score-display';

describe('readQualityView — 质量分的读取优先级', () => {
  it('qualityScore 优先于 similarity', () => {
    expect(readQualityView({ qualityScore: 91, similarity: 62 })).toEqual({
      kind: 'measured',
      value: 91,
    });
  });

  it('历史数据只有 similarity 时按质量分口径读（不得改标为还原度）', () => {
    expect(readQualityView({ similarity: 88.5 })).toEqual({
      kind: 'measured',
      value: 88.5,
    });
  });

  it('0 是实测结果，不是缺失 —— 禁止 score ?? 0 的理由就在这里', () => {
    expect(readQualityView({ qualityScore: 0 })).toEqual({
      kind: 'measured',
      value: 0,
    });
    expect(formatScoreView(readQualityView({ qualityScore: 0 }))).toBe('0.0%');
  });

  it('null = 流程在但算不出来 → unavailable，不回落 similarity、不补 0', () => {
    // 与 B.2.2 toQualityMetrics 同口径：只有 undefined 才回落到 similarity
    const view = readQualityView({ qualityScore: null, similarity: 70 });
    expect(view.kind).toBe('unavailable');
    expect(measuredValue(view)).toBeNull();
  });

  it('undefined（缺失）才回落到 similarity —— null 与 undefined 不得互换', () => {
    expect(readQualityView({ qualityScore: undefined, similarity: 70 })).toEqual({
      kind: 'measured',
      value: 70,
    });
  });

  it('什么都没有 → missing（老客户端 / 未采集）', () => {
    expect(readQualityView({}).kind).toBe('missing');
    expect(readQualityView({ qualityScore: undefined }).kind).toBe('missing');
  });
});

describe('readReconstructionView — 还原度绝不从 similarity 推断', () => {
  it('有实测值 → measured', () => {
    expect(readReconstructionView({ reconstructionScore: 87.3 })).toEqual({
      kind: 'measured',
      value: 87.3,
    });
  });

  it('null → unavailable，并带上 degradedReason', () => {
    expect(
      readReconstructionView({
        reconstructionScore: null,
        reconstructionMeta: { degradedReason: 'render-failed' },
      }),
    ).toEqual({ kind: 'unavailable', reason: 'render-failed' });
  });

  it('null 且没有 reason → unavailable（reason 留空，不编造）', () => {
    const view = readReconstructionView({ reconstructionScore: null });
    expect(view).toEqual({ kind: 'unavailable', reason: undefined });
    expect(formatScoreView(view)).toBe('不可用');
  });

  it('只有 similarity 的历史数据 → 还原度 missing，不推断', () => {
    expect(readReconstructionView({ similarity: 92 }).kind).toBe('missing');
    expect(formatScoreView(readReconstructionView({ similarity: 92 }))).toBe('—');
  });

  it('0 分同样是实测值', () => {
    expect(readReconstructionView({ reconstructionScore: 0 })).toEqual({
      kind: 'measured',
      value: 0,
    });
  });
});

describe('formatScoreView — 四态文案', () => {
  it('measured → 一位小数百分比', () => {
    expect(formatScoreView({ kind: 'measured', value: 92 })).toBe('92.0%');
    expect(formatScoreView({ kind: 'measured', value: 87.5 })).toBe('87.5%');
    expect(formatScoreView({ kind: 'measured', value: 0 })).toBe('0.0%');
  });

  it('unavailable → 不可用 · 原因', () => {
    expect(formatScoreView({ kind: 'unavailable', reason: 'no-baseline' })).toBe(
      '不可用 · no-baseline',
    );
  });

  it('missing → 破折号', () => {
    expect(formatScoreView({ kind: 'missing' })).toBe('—');
  });
});

describe('averageMeasured — 缺失不进分母', () => {
  it('只统计实测值', () => {
    const views = [
      { kind: 'measured', value: 90 },
      { kind: 'missing' },
      { kind: 'measured', value: 80 },
    ] as const;
    expect(averageMeasured(views)).toBe(85);
  });

  it('一个实测都没有 → null（不是 0）', () => {
    expect(averageMeasured([{ kind: 'missing' }, { kind: 'unavailable' }])).toBeNull();
    expect(averageMeasured([])).toBeNull();
  });

  it('unavailable 也不进分母 —— "unknown 不是 guess"', () => {
    const views = [
      { kind: 'measured', value: 60 },
      { kind: 'unavailable', reason: 'x' },
    ] as const;
    expect(averageMeasured(views)).toBe(60);
  });
});

describe('scoreToneClass — 配色', () => {
  it('≥90 绿 / ≥75 琥珀 / 其余中性', () => {
    expect(scoreToneClass({ kind: 'measured', value: 95 })).toBe('text-emerald-400');
    expect(scoreToneClass({ kind: 'measured', value: 80 })).toBe('text-amber-400');
    expect(scoreToneClass({ kind: 'measured', value: 40 })).toBe('text-white/60');
  });

  it('不可用 / 缺失不参与配色', () => {
    expect(scoreToneClass({ kind: 'unavailable' })).toBe('text-white/30');
    expect(scoreToneClass({ kind: 'missing' })).toBe('text-white/30');
  });
});
