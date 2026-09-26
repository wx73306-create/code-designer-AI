/**
 * QA 报告产物（P3-11 / P3-08）
 * ===================================================================
 * 解决的问题：评分目前只活在 Admin 页面的渲染里 —— 刷新一次就没了，
 * 不可归档、不可分享、不可回溯「当时为什么给这个分」。而 P3-11 的验收标准
 * 明确要求 `qa-report.json` + 人读摘要。
 *
 * 三个刻意的设计决定：
 *
 * 1. **报告读的是模型原始输出，不是归一化后的 VisualScore。**
 *    `normalizeVisualScore` 会把 problems 压成 `{type, description}`，
 *    丢掉模型给的 `severity` / `priority` / `reason` / `solution`。
 *    对人读的报告来说那些字段恰恰是最有价值的（「哪条最严重、怎么修」）。
 *
 * 2. **把「契约表达不了的分类」显式列出来（unmatchedCategories）。**
 *    模型实际会输出 `visualFidelity` / `hierarchy` / `interaction` 这些分类，
 *    而契约的 `VisualProblem.type` 只认六维。此前它们会被静默改写成 `premium` ——
 *    「字体问题」被记成「高级感问题」。报告把这些分类单独列一栏，
 *    让「契约盲区」变成可见事实而不是静默改写（同一思路：`interaction`
 *    正是执行计划书 §八 要求、而当前指标字典里缺的 `animation_score`，见 docs/）。
 *
 * 3. **可信度是一等字段（trustworthy）。** 全部维度回落到默认值时，
 *    这份报告的分数字段是**伪测量**（B.2.4.3 的核心教训），必须写在最显眼处。
 */

import {
  DIMENSION_LABELS,
  DIMENSION_WEIGHTS,
} from './scoring';
import { normalizeVisualScore, scoreProvenance } from './schema';
import type { VisualScoreDimensions } from '@/types/agent';

/** 报告里的一条问题（保留模型给的完整信息，不压扁）。 */
export interface QaReportProblem {
  index: number;
  /** 模型给出的原始分类（原样保留，不做改写）。 */
  category: string;
  /** 该分类能对应的契约维度；契约表达不了时为 null（不硬塞）。 */
  dimension: keyof VisualScoreDimensions | null;
  severity: string;
  priority: string;
  problem: string;
  reason: string;
  solution: string;
}

export interface QaReportDimension {
  key: keyof VisualScoreDimensions;
  label: string;
  score: number;
  weight: number;
  /** 实际命中的模型键名；null = 该维度回落到默认值。 */
  resolvedKey: string | null;
  defaulted: boolean;
}

export interface QaReport {
  generationId: string;
  sourceUrl: string;
  capturedAt: string;
  round: number;
  overallScore: number;
  overallSource: 'model' | 'computed' | 'default';
  /**
   * 分数是否可信。
   *
   * `false` 表示六维全部回落默认值 —— 此时 `overallScore` 是个常量，
   * **不是测量结果**。任何消费方（含 Phase 4 迁移闸门）都不得把它当样本。
   */
  trustworthy: boolean;
  dimensions: QaReportDimension[];
  defaultedDimensions: string[];
  problems: QaReportProblem[];
  /** 模型用过、但契约的 VisualProblem.type 表达不了的分类。 */
  unmatchedCategories: string[];
  severityCounts: Record<string, number>;
  reconstruction?: {
    score: number | null;
    note: string;
  };
  /** 一句话结论，直接给人看。 */
  verdict: string;
}

// ---------------------------------------------------------------------------
// 分类 → 契约维度（只做**同语义**映射）
// ---------------------------------------------------------------------------

/**
 * 模型分类到契约维度的映射。
 *
 * ⚠️ 只映射**同一语义**的写法差异，绝不做跨义映射 —— 与 `schema.ts` 的
 * `DIMENSION_ALIASES` 同一条原则。取不到就留 null，宁缺毋滥。
 *
 * 刻意留空的三个（见文件头决定 2）：
 *   `visualFidelity`（整体还原度）、`hierarchy`（视觉层级）、
 *   `interaction`（交互/动效）—— 契约六维里没有对应维度。
 */
const CATEGORY_TO_DIMENSION: Record<string, keyof VisualScoreDimensions> = {
  layout: 'layout_score',
  layout_score: 'layout_score',
  layoutScore: 'layout_score',
  balance: 'visual_balance',
  visual_balance: 'visual_balance',
  spacing: 'spacing_score',
  spacing_score: 'spacing_score',
  color: 'color_score',
  color_score: 'color_score',
  typography: 'typography_score',
  typography_score: 'typography_score',
  premium: 'premium_score',
  premium_score: 'premium_score',
};

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** 从模型原始输出里抽取 problems（不经过 normalizeVisualScore 的压扁）。 */
export function extractProblems(raw: unknown): QaReportProblem[] {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(obj.problems) ? obj.problems : [];

  return list
    .map((p, i) => {
      const prob = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      const category = asString(prob.category) || asString(prob.type) || 'unknown';
      // 兼容两种字段命名：模型给 problem/reason/solution，契约给 description
      const problem = asString(prob.problem) || asString(prob.description);
      return {
        index: i + 1,
        category,
        dimension: CATEGORY_TO_DIMENSION[category] ?? null,
        severity: (asString(prob.severity) || 'unknown').toLowerCase(),
        priority: (asString(prob.priority) || '—').toUpperCase(),
        problem,
        reason: asString(prob.reason),
        solution: asString(prob.solution),
      };
    })
    .filter((p) => p.problem !== '');
}

export interface BuildQaReportInput {
  generationId: string;
  sourceUrl: string;
  /** qa 步骤的解析结果（模型原始对象）。 */
  raw: unknown;
  round?: number;
  capturedAt?: string;
  reconstruction?: { score: number | null; note?: string } | null;
}

/** 组装 QA 报告。纯函数（除时间戳外），便于单测。 */
export function buildQaReport(input: BuildQaReportInput): QaReport {
  const round = input.round ?? 1;
  const visual = normalizeVisualScore(input.raw, round);
  const prov = scoreProvenance(input.raw);

  const dimensions: QaReportDimension[] = (
    Object.keys(DIMENSION_WEIGHTS) as Array<keyof VisualScoreDimensions>
  ).map((key) => ({
    key,
    label: DIMENSION_LABELS[key],
    score: visual.scores[key],
    weight: DIMENSION_WEIGHTS[key],
    resolvedKey: prov.resolvedKeys[key],
    defaulted: prov.defaultedDimensions.includes(key),
  }));

  const problems = extractProblems(input.raw);
  const categories = new Set(problems.map((p) => p.category));
  const unmatchedCategories = [...categories].filter((c) => !(c in CATEGORY_TO_DIMENSION)).sort();

  const severityCounts = problems.reduce<Record<string, number>>((acc, p) => {
    acc[p.severity] = (acc[p.severity] ?? 0) + 1;
    return acc;
  }, {});

  const trustworthy = prov.overallSource !== 'default';

  const reconScore = input.reconstruction?.score ?? null;
  const reconstruction = input.reconstruction
    ? {
        score: reconScore,
        note:
          input.reconstruction.note
          ?? (reconScore === null ? '已尝试但不可得' : '已有实测还原度'),
      }
    : undefined;

  const parts: string[] = [];
  parts.push(trustworthy ? `总分 ${visual.overall_score}` : `总分 ${visual.overall_score}（⚠️ 回落常量，不可信）`);
  parts.push(`总分来源=${prov.overallSource}`);
  if (prov.defaultedDimensions.length) {
    parts.push(`回落维度 ${prov.defaultedDimensions.length}/6`);
  }
  parts.push(`问题 ${problems.length} 条`);
  if (reconScore !== null) parts.push(`还原度 ${reconScore}`);
  if (unmatchedCategories.length) parts.push(`契约盲区分类 ${unmatchedCategories.length} 个`);

  return {
    generationId: input.generationId,
    sourceUrl: input.sourceUrl,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    round,
    overallScore: visual.overall_score,
    overallSource: prov.overallSource,
    trustworthy,
    dimensions,
    defaultedDimensions: prov.defaultedDimensions as string[],
    problems,
    unmatchedCategories,
    severityCounts,
    reconstruction,
    verdict: parts.join(' · '),
  };
}

// ---------------------------------------------------------------------------
// 人读摘要（Markdown）
// ---------------------------------------------------------------------------

const SEVERITY_ORDER = ['critical', 'major', 'minor', 'unknown'];

/** 渲染成人读 Markdown。字段顺序刻意按「先结论、后证据」。 */
export function renderQaReportMarkdown(report: QaReport): string {
  const lines: string[] = [];

  lines.push(`# QA 报告 · ${report.generationId}`);
  lines.push('');
  lines.push(`- 源站：${report.sourceUrl}`);
  lines.push(`- 生成时间：${report.capturedAt}`);
  lines.push(`- 轮次：${report.round}`);
  lines.push('');

  // ---- 结论 ----
  lines.push('## 结论');
  lines.push('');
  if (report.trustworthy) {
    lines.push(`**总分 ${report.overallScore} / 100**（来源：${report.overallSource}）`);
  } else {
    lines.push(`**总分 ${report.overallScore} / 100 —— ⚠️ 不可信**`);
    lines.push('');
    lines.push('> 六个维度全部回落到默认值，这个分数等于一个常量，**不是测量结果**。');
    lines.push('> 任何用它做迁移样本 / 质量结论的流程都应先排除本次结果。');
  }
  lines.push('');
  if (report.reconstruction) {
    lines.push(
      `还原度（生成页 vs 原站）：**${report.reconstruction.score ?? '不可得'}**${report.reconstruction.note ? ` · ${report.reconstruction.note}` : ''}`,
    );
    lines.push('');
  }

  // ---- 六维 ----
  lines.push('## 六维明细');
  lines.push('');
  lines.push('| 维度 | 分数 | 权重 | 取值来源 |');
  lines.push('|---|---:|---:|---|');
  for (const d of report.dimensions) {
    lines.push(
      `| ${d.label} | ${d.score} | ${Math.round(d.weight * 100)}% | ${d.defaulted ? '⚠️ 回落默认值' : `模型 \`${d.resolvedKey}\``} |`,
    );
  }
  lines.push('');

  // ---- 问题清单 ----
  lines.push(`## 问题清单（${report.problems.length} 条）`);
  lines.push('');
  if (report.problems.length === 0) {
    lines.push('模型未给出问题清单。');
    lines.push('');
  } else {
    const counts = SEVERITY_ORDER
      .filter((s) => report.severityCounts[s])
      .map((s) => `${s} ${report.severityCounts[s]}`);
    lines.push(`严重度分布：${counts.join(' · ')}`);
    lines.push('');
    const sorted = [...report.problems].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
    );
    for (const p of sorted) {
      lines.push(`### ${p.index}. [${p.priority}] ${p.category} · ${p.severity}`);
      lines.push('');
      lines.push(`- **问题**：${p.problem}`);
      if (p.reason) lines.push(`- **原因**：${p.reason}`);
      if (p.solution) lines.push(`- **建议**：${p.solution}`);
      lines.push(
        `- **契约维度**：${p.dimension ? p.dimension : '—（契约六维无对应维度）'}`,
      );
      lines.push('');
    }
  }

  // ---- 契约盲区 ----
  if (report.unmatchedCategories.length) {
    lines.push('## ⚠️ 契约盲区（模型用了、契约表达不了的分类）');
    lines.push('');
    lines.push('这些分类**未被静默改写**，而是原样列出。静默改写成 `premium` 会让');
    lines.push('「字体问题」看起来像「高级感问题」，是评估失真的来源之一。');
    lines.push('');
    for (const c of report.unmatchedCategories) {
      lines.push(`- \`${c}\``);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`生成自 \`src/lib/visual-evaluation/report.ts\` · ${report.verdict}`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 落盘 —— **已移出本文件**
// ---------------------------------------------------------------------------
//
// `writeQaReport` 现在在 `./report-write.ts`。这不是洁癖，是构建约束：
// 本文件被 `src/app/page.tsx`（Client Component）经 barrel 间接引入，
// 而落盘要 `node:fs/promises` —— 一旦留在同一个文件里，客户端 chunk 会尝试
// 打包 `node:fs/promises`，`next build` 直接失败：
//
//   the chunking context (unknown) does not support external modules
//   (request: node:fs/promises)
//
// 因此本文件**必须保持零 `node:` 依赖**（纯函数、可在浏览器里跑），
// 任何要碰文件系统的代码都放进 `report-write.ts`。
// 与 `src/lib/qa-report.ts`（同样是服务端专用）保持同一层级划分。
