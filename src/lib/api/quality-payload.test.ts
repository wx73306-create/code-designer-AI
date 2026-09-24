import { describe, expect, it } from 'vitest';

import { pickReconstructionMeta, pickScore } from './quality-payload';

describe('pickScore — API 边界的三态保护', () => {
  it('显式 null 必须保留为 null（不可得 ≠ 未采集）', () => {
    expect(pickScore(null)).toBeNull();
    expect(pickScore(null) === undefined).toBe(false);
    expect(pickScore(null) === 0).toBe(false);
  });

  it('0 是有效测量值，不能被 falsy 判断吞掉', () => {
    expect(pickScore(0)).toBe(0);
    expect(pickScore(0) == null).toBe(false);
  });

  it('正常数字原样透传', () => {
    expect(pickScore(87.4)).toBe(87.4);
  });

  it('未上报（undefined / 缺字段）→ undefined，不臆造 null 或 0', () => {
    expect(pickScore(undefined)).toBeUndefined();
    expect(pickScore('87')).toBeUndefined();
    expect(pickScore({})).toBeUndefined();
  });

  it('NaN / Infinity 视为非法（"unknown 不是 guess"：不可信的数字宁可不要）', () => {
    expect(pickScore(Number.NaN)).toBeUndefined();
    expect(pickScore(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe('pickReconstructionMeta', () => {
  it('普通对象原样透传', () => {
    const meta = { measuredSections: ['hero', 'footer'] };
    expect(pickReconstructionMeta(meta)).toBe(meta);
  });

  it('undefined / null → undefined（字段不写入）', () => {
    expect(pickReconstructionMeta(undefined)).toBeUndefined();
    expect(pickReconstructionMeta(null)).toBeUndefined();
  });

  it('数组与标量不是合法的 meta', () => {
    expect(pickReconstructionMeta(['hero'])).toBeUndefined();
    expect(pickReconstructionMeta('hero')).toBeUndefined();
    expect(pickReconstructionMeta(87)).toBeUndefined();
  });
});
