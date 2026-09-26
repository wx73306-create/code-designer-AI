/**
 * QA 报告产物测试（P3-11 / P3-08）
 * ===================================================================
 * 用**真实模型输出形状**做输入（不是理想契约形状）—— 这是这套代码最重要的
 * 测试习惯：B.2.4.3 的教训就是「契约与模型输出零重叠」而测试全绿。
 *
 * 模型真实输出（取自 .b2verify/run20.log 的 QA-RAW-HEAD）：
 *   { scores: { visualFidelity, layout, hierarchy, typography, color,
 *               spacing, interaction, premium }, totalScore, problems:[{category,
 *               severity, priority, problem, reason, solution}] }
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildQaReport, extractProblems, renderQaReportMarkdown } from './report';
// 落盘测试从 report-write 引 —— report.ts 保持零 node: 依赖（客户端可达），
// 详见 report-write.ts 文件头：混在一起会让 next build 打包 node:fs/promises 而失败。
import { writeQaReport } from './report-write';

/** 与真实日志一致的模型输出。 */
const REAL_MODEL_OUTPUT = {
  scores: {
    visualFidelity: 78,
    layout: 82,
    hierarchy: 80,
    typography: 85,
    color: 88,
    spacing: 79,
    interaction: 72,
    premium: 65,
  },
  totalScore: 78,
  problems: [
    {
      category: 'typography',
      severity: 'critical',
      priority: 'P0',
      problem: '字体家族与设计 DNA 严重不匹配',
      reason: 'Design DNA 指定 Geist Sans，而代码使用了 Inter',
      solution: '将 CSS 中的字体替换为 @font-face 引入 Geist Sans',
    },
    {
      category: 'interaction',
      severity: 'major',
      priority: 'P1',
      problem: '缺少滚动触发的入场动画',
      reason: '原站使用 ScrollTrigger',
      solution: '为 hero 区块补 gsap.from 入场',
    },
    {
      category: 'visualFidelity',
      severity: 'minor',
      priority: 'P2',
      problem: '产品主视觉使用 CSS 模拟而非真实摄影',
      reason: '缺少品牌情感锚点',
      solution: '替换为真实产品图',
    },
  ],
};

let root = '';

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'qa-report-'));
});

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe('buildQaReport · 信任度', () => {
  it('真实模型输出 ⇒ trustworthy=true，总分取模型 totalScore', () => {
    const r = buildQaReport({ generationId: 'gen_x', sourceUrl: 'https://stripe.com', raw: REAL_MODEL_OUTPUT });

    expect(r.trustworthy).toBe(true);
    expect(r.overallSource).toBe('model');
    expect(r.overallScore).toBe(78);
    // 5 维命中（layout/spacing/color/typography/premium），visual_balance 不命中
    expect(r.defaultedDimensions).toEqual(['visual_balance']);
  });

  it('六维全回落 ⇒ trustworthy=false 且结论里显式标「不可信」', () => {
    const r = buildQaReport({ generationId: 'gen_bad', sourceUrl: 'https://x.com', raw: { raw: 'not json' } });

    expect(r.trustworthy).toBe(false);
    expect(r.overallSource).toBe('default');
    expect(r.verdict).toContain('不可信');
    expect(renderQaReportMarkdown(r)).toContain('不可信');
    expect(renderQaReportMarkdown(r)).toContain('不是测量结果');
  });

  it('六维全命中 ⇒ overallSource=computed（走加权，不采信模型自报）', () => {
    const r = buildQaReport({
      generationId: 'gen_full',
      sourceUrl: 'https://x.com',
      raw: {
        scores: {
          layout_score: 80,
          visual_balance: 80,
          spacing_score: 80,
          color_score: 80,
          typography_score: 80,
          premium_score: 80,
        },
        totalScore: 99,
      },
    });
    expect(r.overallSource).toBe('computed');
    expect(r.overallScore).toBe(80);
    expect(r.defaultedDimensions).toEqual([]);
  });

  it('每个维度都标出「取值来源」，回落不再隐形', () => {
    const r = buildQaReport({ generationId: 'g', sourceUrl: 'u', raw: REAL_MODEL_OUTPUT });
    const byKey = Object.fromEntries(r.dimensions.map((d) => [d.key, d]));

    expect(byKey.layout_score.resolvedKey).toBe('layout');
    expect(byKey.layout_score.defaulted).toBe(false);
    expect(byKey.typography_score.resolvedKey).toBe('typography');
    expect(byKey.visual_balance.resolvedKey).toBeNull();
    expect(byKey.visual_balance.defaulted).toBe(true);
  });
});

describe('buildQaReport · 问题清单保留模型原始信息（P3-08）', () => {
  it('severity / priority / reason / solution 不被压扁', () => {
    const problems = extractProblems(REAL_MODEL_OUTPUT);

    expect(problems).toHaveLength(3);
    expect(problems[0]).toMatchObject({
      category: 'typography',
      dimension: 'typography_score',
      severity: 'critical',
      priority: 'P0',
      reason: 'Design DNA 指定 Geist Sans，而代码使用了 Inter',
    });
    expect(problems[0].solution).toContain('Geist Sans');
  });

  it('同类问题映射到契约维度；契约表达不了的分类映射为 null（不硬塞）', () => {
    const problems = extractProblems(REAL_MODEL_OUTPUT);
    const byCategory = Object.fromEntries(problems.map((p) => [p.category, p]));

    expect(byCategory.typography.dimension).toBe('typography_score');
    // interaction / visualFidelity 在契约六维里没有对应维度
    expect(byCategory.interaction.dimension).toBeNull();
    expect(byCategory.visualFidelity.dimension).toBeNull();
  });

  it('契约盲区分类被显式列出 —— 而不是被静默改写成 premium', () => {
    const r = buildQaReport({ generationId: 'g', sourceUrl: 'u', raw: REAL_MODEL_OUTPUT });

    expect(r.unmatchedCategories).toEqual(['interaction', 'visualFidelity']);
    const md = renderQaReportMarkdown(r);
    expect(md).toContain('契约盲区');
    expect(md).toContain('`interaction`');
  });

  it('严重度分布可统计', () => {
    const r = buildQaReport({ generationId: 'g', sourceUrl: 'u', raw: REAL_MODEL_OUTPUT });
    expect(r.severityCounts).toEqual({ critical: 1, major: 1, minor: 1 });
  });

  it('无 problems 字段时不崩，返回空清单', () => {
    const r = buildQaReport({ generationId: 'g', sourceUrl: 'u', raw: { scores: { layout: 70 } } });
    expect(r.problems).toEqual([]);
    expect(renderQaReportMarkdown(r)).toContain('未给出问题清单');
  });

  it('problems 里缺 description 的条目被丢弃（不产出空壳条目）', () => {
    const problems = extractProblems({ problems: [{ category: 'color' }, { category: 'color', problem: '有内容' }] });
    expect(problems).toHaveLength(1);
    expect(problems[0].problem).toBe('有内容');
  });
});

describe('buildQaReport · 还原度', () => {
  it('有还原度时写入报告与摘要', () => {
    const r = buildQaReport({
      generationId: 'g',
      sourceUrl: 'u',
      raw: REAL_MODEL_OUTPUT,
      reconstruction: { score: 64 },
    });
    expect(r.reconstruction?.score).toBe(64);
    expect(renderQaReportMarkdown(r)).toContain('还原度');
  });

  it('还原度不可得（null）时写「不可得」，不伪装成 0', () => {
    const r = buildQaReport({ generationId: 'g', sourceUrl: 'u', raw: REAL_MODEL_OUTPUT, reconstruction: { score: null } });
    expect(r.reconstruction?.score).toBeNull();
    expect(r.reconstruction?.note).toContain('不可得');
  });

  it('未传 reconstruction 时该字段整体缺失', () => {
    const r = buildQaReport({ generationId: 'g', sourceUrl: 'u', raw: REAL_MODEL_OUTPUT });
    expect(r.reconstruction).toBeUndefined();
    expect(renderQaReportMarkdown(r)).not.toContain('还原度');
  });
});

describe('renderQaReportMarkdown', () => {
  it('含标题 / 结论 / 六维表 / 问题清单，且六维表标出回落维度', () => {
    const md = renderQaReportMarkdown(buildQaReport({ generationId: 'gen_abc', sourceUrl: 'https://s.com', raw: REAL_MODEL_OUTPUT }));

    expect(md).toContain('# QA 报告 · gen_abc');
    expect(md).toContain('## 结论');
    expect(md).toContain('## 六维明细');
    expect(md).toContain('| 视觉平衡 |');
    expect(md).toContain('⚠️ 回落默认值');
    expect(md).toContain('## 问题清单（3 条）');
    expect(md).toContain('### 1. [P0] typography · critical');
  });

  it('问题按严重度排序（critical 在前）', () => {
    const md = renderQaReportMarkdown(buildQaReport({ generationId: 'g', sourceUrl: 'u', raw: REAL_MODEL_OUTPUT }));
    expect(md.indexOf('critical')).toBeLessThan(md.indexOf('major'));
    expect(md.indexOf('major')).toBeLessThan(md.indexOf('minor'));
  });
});

describe('writeQaReport', () => {
  it('产出 qa-report.json 与 qa-report.md 两个文件', async () => {
    const report = buildQaReport({ generationId: 'gen_w1', sourceUrl: 'https://s.com', raw: REAL_MODEL_OUTPUT });
    const w = await writeQaReport(report, { root });

    expect(w.json.ok).toBe(true);
    expect(w.markdown.ok).toBe(true);
    expect(w.json.relativePath).toBe(path.join('gen_w1', 'qa-report.json'));

    const json = JSON.parse(await readFile(path.join(root, 'gen_w1', 'qa-report.json'), 'utf8'));
    expect(json.generationId).toBe('gen_w1');
    expect(json.trustworthy).toBe(true);
    const md = await readFile(path.join(root, 'gen_w1', 'qa-report.md'), 'utf8');
    expect(md).toContain('# QA 报告 · gen_w1');
  });

  it('jobId 非法时返回 ok:false 而不抛错', async () => {
    const report = buildQaReport({ generationId: '../evil', sourceUrl: 'u', raw: REAL_MODEL_OUTPUT });
    const w = await writeQaReport(report, { root });
    expect(w.json.ok).toBe(false);
    expect(w.markdown.ok).toBe(false);
  });
});
