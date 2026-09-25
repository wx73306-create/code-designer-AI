/**
 * Visual Evaluation — Schema Normalization 测试
 *
 * B.2.4.3：这些用例锁死「qualityScore 到底是不是真测量」。
 * 其中最关键的是第一条 —— 直接拿线上 QA Agent 的真实输出形状作样本，
 * 防止以后再出现「模型换了套命名、解析侧全部静默回落成常量 77.4」。
 */

import { describe, it, expect } from 'vitest';
import { normalizeVisualScore, scoreProvenance } from './schema';

/** 2026-09-25 线上取证拿到的 QA Agent 真实输出形状（八维驼峰 + totalScore）。 */
const REAL_MODEL_OUTPUT = {
  scores: {
    visualFidelity: 85,
    layout: 88,
    hierarchy: 82,
    typography: 72,
    color: 92,
    spacing: 84,
    interaction: 78,
    premium: 76,
  },
  totalScore: 82,
  problems: [{ type: 'typography', description: '字体系统与原设计不符' }],
};

describe('normalizeVisualScore — 字段别名（B.2.4.3）', () => {
  it('能读懂 QA Agent 实际的驼峰命名，而不是全部回落成 77.4', () => {
    const r = normalizeVisualScore(REAL_MODEL_OUTPUT, 1);

    // 五个语义直接对应的维度必须拿到模型的真实值
    expect(r.scores.layout_score).toBe(88);
    expect(r.scores.spacing_score).toBe(84);
    expect(r.scores.color_score).toBe(92);
    expect(r.scores.typography_score).toBe(72);
    expect(r.scores.premium_score).toBe(76);

    // 模型没给 visual_balance → 只能是默认值，绝不能拿 hierarchy/visualFidelity 顶替
    expect(r.scores.visual_balance).toBe(78);

    // 有维度回落 → 采信模型自报总分，避免加权值被默认值污染
    expect(r.overall_score).toBe(82);

    // 回归断言：绝不能再是兜底常量 77.4 / 77
    expect(r.overall_score).not.toBe(77.4);
    expect(r.overall_score).not.toBe(77);
  });

  it('provenance 如实标出回落维度，使「伪测量」不再隐形', () => {
    const p = scoreProvenance(REAL_MODEL_OUTPUT);

    expect(p.resolvedKeys.layout_score).toBe('layout');
    expect(p.resolvedKeys.color_score).toBe('color');
    expect(p.resolvedKeys.visual_balance).toBeNull();
    expect(p.defaultedDimensions).toEqual(['visual_balance']);
    expect(p.overallSource).toBe('model');
  });

  it('契约原生的 snake_case 输入行为不变（加权口径）', () => {
    const r = normalizeVisualScore({
      scores: {
        layout_score: 85,
        visual_balance: 75,
        spacing_score: 80,
        color_score: 90,
        typography_score: 88,
        premium_score: 65,
      },
    });

    // 六维真实命中 → 沿用加权计算
    expect(r.overall_score).toBe(80);
    expect(scoreProvenance({
      scores: {
        layout_score: 85,
        visual_balance: 75,
        spacing_score: 80,
        color_score: 90,
        typography_score: 88,
        premium_score: 65,
      },
    }).overallSource).toBe('computed');
  });

  it('空 / 非法输入：全部回落，且 provenance 明确标记为 default', () => {
    const r = normalizeVisualScore({ raw: '' });
    const p = scoreProvenance({ raw: '' });

    // 这就是 2026-09-25 之前线上真实发生的情况：静默产出兜底常量 77.4
    expect(r.overall_score).toBe(77.4);
    expect(p.defaultedDimensions).toHaveLength(6);
    expect(p.overallSource).toBe('default');
  });

  it('扁平结构（分数直接挂在顶层）也能解析', () => {
    const r = normalizeVisualScore({ layout: 90, color: 70, totalScore: 80 });
    expect(r.scores.layout_score).toBe(90);
    expect(r.scores.color_score).toBe(70);
    expect(r.overall_score).toBe(80);
  });

  it('不做跨语义映射：hierarchy 不会被当成 visual_balance', () => {
    const r = normalizeVisualScore({ scores: { hierarchy: 10 } });
    expect(r.scores.visual_balance).toBe(78); // 保持默认，不张冠李戴
  });

  it('数值越界会被 clamp 到 0-100', () => {
    const r = normalizeVisualScore({ scores: { layout: 150, color: -20 } });
    expect(r.scores.layout_score).toBe(100);
    expect(r.scores.color_score).toBe(0);
  });
});
