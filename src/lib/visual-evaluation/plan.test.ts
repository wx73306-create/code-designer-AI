import { describe, it, expect } from 'vitest';
import { normalizeOptimizationPlan, formatOptimizationIssues } from '@/lib/visual-evaluation/plan';

/** 完整 schema 样本：对齐 route.ts SYSTEM_PROMPTS.optimize 规定的输出 */
const FULL_PLAN = {
  diagnosis: {
    rootCause: 'Hero visual weight insufficient',
    affectedAreas: ['hero', 'typography'],
    designDNAAtRisk: true,
  },
  optimizationPlan: [
    {
      priority: 'P0',
      category: 'layout',
      targetComponent: 'HeroSection',
      problem: 'Hero 视觉权重不足',
      reason: '高度仅 30vh',
      before: 'height: 30vh',
      after: 'height: 70vh',
      expectedImpact: 'Hero weight +40%',
    },
    {
      priority: 'P1',
      category: 'component',
      targetComponent: 'FeatureGrid',
      problem: '卡片过多',
      reason: '8 个同构卡片',
      before: '8 cards',
      after: '3 storytelling sections',
      expectedImpact: 'eliminate template feel',
    },
  ],
  codeInstructions: [
    { file: 'src/components/HeroSection.tsx', action: 'modify', changes: ['height 30vh → 70vh'] },
    { file: 'src/components/FeatureGrid.tsx', action: 'replace', changes: ['8 cards → 3 sections'] },
  ],
  estimatedScoreIncrease: 15,
  optimizationDecision: 'fix',
  optimizationMemory: { round: 2, fixed: [], failed: [], scoreChange: null },
  confidence: 0.85,
};

describe('normalizeOptimizationPlan', () => {
  it('解析完整 schema', () => {
    const plan = normalizeOptimizationPlan(FULL_PLAN, 1);
    expect(plan).not.toBeNull();
    expect(plan!.items).toHaveLength(2);
    expect(plan!.items[0].priority).toBe('P0');
    expect(plan!.items[0].targetComponent).toBe('HeroSection');
    expect(plan!.diagnosis.rootCause).toBe('Hero visual weight insufficient');
    expect(plan!.diagnosis.affectedAreas).toEqual(['hero', 'typography']);
    expect(plan!.diagnosis.designDNAAtRisk).toBe(true);
    expect(plan!.codeInstructions).toHaveLength(2);
    expect(plan!.codeInstructions[1].action).toBe('replace');
    expect(plan!.estimatedScoreIncrease).toBe(15);
    expect(plan!.decision).toBe('fix');
    expect(plan!.confidence).toBe(0.85);
  });

  it('optimizationMemory.round 优先于传入的 round 兜底值', () => {
    expect(normalizeOptimizationPlan(FULL_PLAN, 1)!.round).toBe(2);
  });

  it('缺少 optimizationMemory 时用传入 round 兜底', () => {
    const rest: Record<string, unknown> = { ...FULL_PLAN };
    delete rest.optimizationMemory;
    expect(normalizeOptimizationPlan(rest, 3)!.round).toBe(3);
  });

  it('兼容旧版 issues[] schema（problem + solution）', () => {
    const plan = normalizeOptimizationPlan(
      {
        issues: [
          { problem: 'too many cards', solution: 'merge into storytelling section' },
          { problem: 'weak hero', solution: 'increase hero height to 70vh' },
        ],
      },
      1,
    );
    expect(plan).not.toBeNull();
    expect(plan!.items).toHaveLength(2);
    // solution 映射到 after
    expect(plan!.items[0].after).toBe('merge into storytelling section');
    // 首项默认 P0，其余 P1
    expect(plan!.items[0].priority).toBe('P0');
    expect(plan!.items[1].priority).toBe('P1');
    // diagnosis 缺失时用首条 problem 兜底
    expect(plan!.diagnosis.rootCause).toBe('too many cards');
    expect(plan!.decision).toBe('fix');
  });

  it('非法 priority / action / decision 收敛到合法值', () => {
    const plan = normalizeOptimizationPlan(
      {
        optimizationPlan: [{ priority: 'URGENT', problem: 'x' }],
        codeInstructions: [{ file: 'a.tsx', action: 'delete' }],
        optimizationDecision: 'whatever',
      },
      1,
    );
    expect(plan!.items[0].priority).toBe('P0'); // index 0
    expect(plan!.codeInstructions[0].action).toBe('modify');
    expect(plan!.decision).toBe('fix');
  });

  it('丢弃没有 problem 的条目', () => {
    const plan = normalizeOptimizationPlan(
      {
        optimizationPlan: [
          { priority: 'P0', targetComponent: 'A' }, // 无 problem
          { priority: 'P1', problem: 'real issue' },
        ],
      },
      1,
    );
    expect(plan!.items).toHaveLength(1);
    expect(plan!.items[0].problem).toBe('real issue');
  });

  it('没有 optimizationPlan 也没有 issues 时返回 null', () => {
    expect(normalizeOptimizationPlan({ diagnosis: { rootCause: 'x' } }, 1)).toBeNull();
  });

  it('全部条目无效时返回 null（避免 UI 渲染空卡片）', () => {
    expect(normalizeOptimizationPlan({ optimizationPlan: [{ foo: 1 }, { bar: 2 }] }, 1)).toBeNull();
  });

  it('输入为 JSON 字符串时尝试再解析一次', () => {
    expect(normalizeOptimizationPlan(JSON.stringify(FULL_PLAN), 1)).not.toBeNull();
  });

  it('非 JSON 字符串 / null / 数字 返回 null', () => {
    expect(normalizeOptimizationPlan('not json', 1)).toBeNull();
    expect(normalizeOptimizationPlan(null, 1)).toBeNull();
    expect(normalizeOptimizationPlan(42, 1)).toBeNull();
  });

  it('route 解析失败的降级形态 { raw: string } 返回 null 而不是崩溃', () => {
    expect(normalizeOptimizationPlan({ raw: '抱歉，我无法生成' }, 1)).toBeNull();
  });
});

describe('formatOptimizationIssues', () => {
  it('输出包含根因、优先级、改法与文件级指令', () => {
    const plan = normalizeOptimizationPlan(FULL_PLAN, 1)!;
    const text = formatOptimizationIssues(plan);

    expect(text).toContain('根因：Hero visual weight insufficient');
    expect(text).toContain('受影响区域：hero、typography');
    expect(text).toContain('设计 DNA 有流失风险');
    expect(text).toContain('- [P0] HeroSection：Hero 视觉权重不足');
    expect(text).toContain('改法：height: 70vh');
    expect(text).toContain('- src/components/FeatureGrid.tsx（replace）');
    expect(text).toContain('· 8 cards → 3 sections');
  });

  it('省略空字段，不产生 "原因：" 之类的空行', () => {
    const plan = normalizeOptimizationPlan(
      { optimizationPlan: [{ priority: 'P0', problem: 'only problem' }] },
      1,
    )!;
    const text = formatOptimizationIssues(plan);
    expect(text).toContain('- [P0] —：only problem');
    expect(text).not.toContain('原因：');
    expect(text).not.toContain('改法：');
    expect(text).not.toContain('文件级改动');
  });
});
