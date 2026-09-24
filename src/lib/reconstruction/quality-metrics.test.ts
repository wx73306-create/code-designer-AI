import { describe, expect, it } from 'vitest';

import { deriveReconstructionMeta, reconstructionFields, toQualityMetrics } from './quality-metrics';
import { summarizeMigration } from '@/lib/migration/observe';

import type { ReconstructionScore } from '@/types/reconstruction';
import type { DiffReport, LayoutDiff } from '@/types/reconstruction';
import type { SectionRole } from '@/types/website-package';

/** 造一个带 report 的最小 ReconstructionScore，避免测试依赖真实采集链路。 */
function scoreWithLayout(items: { role: SectionRole; status: 'matched' | 'missing' | 'extra' }[]): ReconstructionScore {
  const layout: LayoutDiff = {
    roleSequenceCoverage: 1,
    heightProfileDistance: 0,
    items: items.map((i) => ({ role: i.role, status: i.status })),
  };
  const report = { layout } as DiffReport;
  return {
    score: 87,
    dimensions: null,
    renderStatus: 'success',
    report,
    evaluatedAt: '2026-09-22T00:00:00.000Z',
  };
}

describe('deriveReconstructionMeta — 四态语义', () => {
  it('输入 undefined / null → 不产生字段（不是 {}，也不是 null）', () => {
    expect(deriveReconstructionMeta(undefined)).toBeUndefined();
    expect(deriveReconstructionMeta(null)).toBeUndefined();
  });

  it('开关关闭（服务没产出对象）≠ 采集失败：前者字段根本不存在', () => {
    // 开关关闭时 use-workflow 侧 reconstructionScore 保持初始值 null
    expect(deriveReconstructionMeta(null)).toBeUndefined();
  });

  it('measuredSections 是 role 序列：只含与原站真值配对的区块（matched / missing）', () => {
    const meta = deriveReconstructionMeta(
      scoreWithLayout([
        { role: 'hero', status: 'matched' },
        { role: 'feature', status: 'missing' },
        { role: 'cta', status: 'extra' },
        { role: 'footer', status: 'matched' },
      ]),
    );

    expect(meta?.measuredSections).toEqual(['hero', 'feature', 'footer']);
    expect(meta?.measuredSections).not.toContain('cta');
  });

  it('measuredSections 去重但保持顺序', () => {
    const meta = deriveReconstructionMeta(
      scoreWithLayout([
        { role: 'hero', status: 'matched' },
        { role: 'nav', status: 'matched' },
        { role: 'hero', status: 'matched' },
      ]),
    );

    expect(meta?.measuredSections).toEqual(['hero', 'nav']);
  });

  it('全部都是 extra（没有任何可比对的真值）→ measuredSections 不出现', () => {
    const meta = deriveReconstructionMeta(scoreWithLayout([{ role: 'cta', status: 'extra' }]));

    expect(meta?.measuredSections).toBeUndefined();
  });

  it('score 为 null → degradedReason 必现（reason 优先）', () => {
    const meta = deriveReconstructionMeta({
      score: null,
      dimensions: null,
      renderStatus: 'failed',
      reason: 'render-error',
      evaluatedAt: '2026-09-22T00:00:00.000Z',
    });

    expect(meta?.degradedReason).toBe('render-error');
  });

  it('score 为 null 且没有 reason → 退到 renderStatus，最后兜底 unknown', () => {
    expect(
      deriveReconstructionMeta({
        score: null,
        dimensions: null,
        renderStatus: 'degraded',
        evaluatedAt: '2026-09-22T00:00:00.000Z',
      })?.degradedReason,
    ).toBe('degraded');

    expect(
      deriveReconstructionMeta({
        score: null,
        dimensions: null,
        renderStatus: 'success',
        evaluatedAt: '2026-09-22T00:00:00.000Z',
      })?.degradedReason,
    ).toBe('success');
  });

  it('score 有值时不写 degradedReason（有分数就说明度量成功了）', () => {
    const meta = deriveReconstructionMeta(scoreWithLayout([{ role: 'hero', status: 'matched' }]));

    expect(meta?.degradedReason).toBeUndefined();
  });

  it('有 report 时挂上 structuralDiff / visualDiff 引用', () => {
    const score = scoreWithLayout([{ role: 'hero', status: 'matched' }]);
    score.report!.style = { primary: { distance: 0.2 } } as DiffReport['style'];

    const meta = deriveReconstructionMeta(score);

    expect(meta?.structuralDiff).toBe(score.report!.layout);
    expect(meta?.visualDiff).toBe(score.report!.style);
  });

  it('宁可不产生字段，也不产出空对象（空对象无法与未测量区分）', () => {
    const meta = deriveReconstructionMeta({
      score: 90,
      dimensions: null,
      renderStatus: 'success',
      evaluatedAt: '2026-09-22T00:00:00.000Z',
    });

    expect(meta).toBeUndefined();
  });
});

describe('toQualityMetrics — 单向投影', () => {
  it('读取优先级：qualityScore 与 similarity 共存时取 qualityScore', () => {
    const metrics = toQualityMetrics({ similarity: 60, qualityScore: 92 });

    expect(metrics.qualityScore).toBe(92);
    expect(metrics.similarity).toBe(60);
  });

  it('迁移期双字段同时保留（谁都不丢，供观察期比对）', () => {
    const metrics = toQualityMetrics({ similarity: 88, qualityScore: 88 });

    expect(metrics.similarity).toBe(88);
    expect(metrics.qualityScore).toBe(88);
  });

  it('undefined ≠ 0：字段缺失时投影结果里也不得出现该字段', () => {
    const metrics = toQualityMetrics({});

    expect('qualityScore' in metrics).toBe(false);
    expect('similarity' in metrics).toBe(false);
    expect('reconstructionScore' in metrics).toBe(false);
  });

  it('0 是有效测量值，不得被塌成 null / undefined', () => {
    const metrics = toQualityMetrics({ qualityScore: 0 });

    expect(metrics.qualityScore).toBe(0);
    expect(metrics.qualityScore == null).toBe(false);
  });

  it('reconstructionScore 从对象形态投影为标量', () => {
    const metrics = toQualityMetrics({
      reconstructionScore: scoreWithLayout([{ role: 'hero', status: 'matched' }]),
    });

    expect(metrics.reconstructionScore).toBe(87);
  });

  it('对象存在但内部分数为 null → 投影为 null（不得塌成 0）', () => {
    const metrics = toQualityMetrics({
      reconstructionScore: {
        score: null,
        dimensions: null,
        renderStatus: 'failed',
        reason: 'render-error',
        evaluatedAt: '2026-09-22T00:00:00.000Z',
      },
    });

    expect(metrics.reconstructionScore).toBeNull();
    expect(metrics.reconstructionScore === 0).toBe(false);
    expect(metrics.reconstructionMeta?.degradedReason).toBe('render-error');
  });

  it('对象不存在（undefined）→ 保持 undefined，不臆造 null', () => {
    const metrics = toQualityMetrics({ qualityScore: 70 });

    expect('reconstructionScore' in metrics).toBe(false);
    expect(metrics.reconstructionScore).toBeUndefined();
  });

  it('调用方显式传 null（= 已尝试但不可得）→ 投影为 null 且不带 meta', () => {
    // 注意 B.2.3.1 之后：null 只表示「已尝试度量但不可得」。
    // 「服务未开启 / 未产出」由调用方**省略该键**表达（见 reconstructionFields 用例）。
    const metrics = toQualityMetrics({ reconstructionScore: null });

    expect(metrics.reconstructionScore).toBeNull();
    expect(metrics.reconstructionMeta).toBeUndefined();
  });

  it('已传入 reconstructionMeta 时不重复派生', () => {
    const metrics = toQualityMetrics({
      reconstructionScore: scoreWithLayout([{ role: 'pricing', status: 'matched' }]),
      reconstructionMeta: { measuredSections: ['pricing'] },
    });

    expect(metrics.reconstructionMeta?.measuredSections).toEqual(['pricing']);
  });
});

// =====================================================================
// B.2.3.1 — 开关关闭时 reconstructionScore 必须「不产生」
//
// 修复前的实现无条件写入 `reconstructionScore: null`，把「未开启」冒充成
// 「已尝试但不可得」，进而污染迁移观察数据（unavailable / 覆盖率分子）。
// 下面这组用例把三种状态钉死，防止回归。
// =====================================================================

describe('reconstructionFields — 开关关闭时字段不产生（B.2.3.1）', () => {
  it('未开启度量（ran=false）→ 键根本不存在，而不是 null', () => {
    const fields = reconstructionFields(false, null);

    expect('reconstructionScore' in fields).toBe(false);
    expect(fields.reconstructionScore).toBeUndefined();
  });

  it('已开启但不可得（ran=true, score=null）→ 如实产出 null', () => {
    const fields = reconstructionFields(true, null);

    expect('reconstructionScore' in fields).toBe(true);
    expect(fields.reconstructionScore).toBeNull();
  });

  it('已开启且测得（ran=true, 有效对象）→ 原样保留对象', () => {
    const score = scoreWithLayout([{ role: 'hero', status: 'matched' }]);

    expect(reconstructionFields(true, score).reconstructionScore).toBe(score);
  });

  it('「未开启」经投影后仍然没有该键，不得被读成「不可得」', () => {
    const metrics = toQualityMetrics({
      similarity: 77.4,
      qualityScore: 77.4,
      ...reconstructionFields(false, null),
    });

    expect('reconstructionScore' in metrics).toBe(false);
    expect(metrics.reconstructionScore).toBeUndefined();
    expect(metrics.qualityScore).toBe(77.4);
  });

  it('「不可得」投影为标量 null，原因由 meta.degradedReason 承载', () => {
    const degraded: ReconstructionScore = {
      ...scoreWithLayout([{ role: 'hero', status: 'matched' }]),
      score: null,
      renderStatus: 'degraded',
      reason: 'original-layout-unavailable',
    };

    const metrics = toQualityMetrics({
      qualityScore: 88,
      ...reconstructionFields(true, degraded),
    });

    expect(metrics.reconstructionScore).toBeNull();
    expect(metrics.reconstructionMeta?.degradedReason).toBe('original-layout-unavailable');
  });

  it('「未开启」与「不可得」在 observe 口径下落在不同桶（missing vs unavailable）', () => {
    // 未开启：调用方省略该键（字段不产生）
    const notEnabled = { qualityScore: 77.4, similarity: 77.4 };
    // 不可得：字段存在且为 null
    const unavailable = { qualityScore: 77.4, similarity: 77.4, reconstructionScore: null };

    const a = summarizeMigration([notEnabled]);
    const b = summarizeMigration([unavailable]);

    expect(a.reconstruction).toMatchObject({ measured: 0, unavailable: 0, missing: 1 });
    expect(b.reconstruction).toMatchObject({ measured: 0, unavailable: 1, missing: 0 });
    // 覆盖率口径：只有「不可得」证明通道已通，才计入分子
    expect(a.reconstruction.coverage).toBe(0);
    expect(b.reconstruction.coverage).toBe(1);
  });
});
