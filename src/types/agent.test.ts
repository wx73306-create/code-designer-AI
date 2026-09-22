import { describe, expect, expectTypeOf, it } from 'vitest';

import type { QualityMetrics } from './agent';

/**
 * B.2.1 Types Migration —— 契约类型测试
 * 契约来源：docs/B2-CONTRACT-DESIGN-FREEZE.md §3（Type Contract）/ §4（State Semantics）
 *
 * 这里只锁**类型与语义**，不锁任何运行时行为：
 * B.2.1 阶段 QualityMetrics 还没有生产点，也没有消费点。
 */
describe('QualityMetrics — B.2 contract', () => {
  it('所有字段都是 optional：空对象是合法值（不得强制生产）', () => {
    const empty: QualityMetrics = {};

    expect(Object.keys(empty)).toHaveLength(0);
    expect(empty.similarity).toBeUndefined();
    expect(empty.qualityScore).toBeUndefined();
    expect(empty.reconstructionScore).toBeUndefined();
  });

  it('三个分数字段的类型都是 number | undefined（不是 number）', () => {
    expectTypeOf<QualityMetrics['similarity']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<QualityMetrics['qualityScore']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<QualityMetrics['reconstructionScore']>().toEqualTypeOf<number | undefined>();
  });

  it('四态语义：undefined = 未产生，不能被当成 0', () => {
    const notProduced: QualityMetrics = {};

    // undefined 与 0 必须可区分：这是「unknown 不是 guess」的类型基础
    expect(notProduced.qualityScore).toBeUndefined();
    expect(notProduced.qualityScore == null).toBe(true);
    expect(notProduced.qualityScore === 0).toBe(false);
  });

  it('四态语义：0 = 有效测量结果为零，必须保留（不得被 falsy 判断吞掉）', () => {
    const measuredZero: QualityMetrics = { qualityScore: 0, reconstructionScore: 0 };

    expect(measuredZero.qualityScore).toBe(0);
    expect(measuredZero.reconstructionScore).toBe(0);
    expect(measuredZero.qualityScore === undefined).toBe(false);
  });

  it('迁移期双字段可以共存（similarity 与 qualityScore 同时存在）', () => {
    const dualWrite: QualityMetrics = { similarity: 88, qualityScore: 92 };

    // 读取优先级 qualityScore > similarity 在 B.2.3 读取点强制；
    // 这里只锁「共存不冲突」这一前提。
    expect(dualWrite.qualityScore).toBe(92);
    expect(dualWrite.similarity).toBe(88);
  });

  it('reconstructionMeta.measuredSections 是 role 序列（string[]），不是计数', () => {
    expectTypeOf<NonNullable<QualityMetrics['reconstructionMeta']>['measuredSections']>().toEqualTypeOf<
      string[] | undefined
    >();

    const meta: NonNullable<QualityMetrics['reconstructionMeta']> = {
      measuredSections: ['hero', 'features', 'pricing', 'footer'],
    };

    expect(Array.isArray(meta.measuredSections)).toBe(true);
    expect(meta.measuredSections).toHaveLength(4);
    expect(typeof meta.measuredSections?.[0]).toBe('string');
  });

  it('reconstructionMeta.degradedReason 承载「有流程但不可得」的原因', () => {
    const degraded: QualityMetrics = {
      reconstructionMeta: { degradedReason: 'render-degraded' },
    };

    expect(degraded.reconstructionMeta?.degradedReason).toBe('render-degraded');
  });
});
