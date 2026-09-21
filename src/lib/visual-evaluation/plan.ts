/**
 * Optimization Plan normalization — Phase 7（QA 手动优化模式）
 *
 * 背景：Optimization Agent 的真实输出 schema 定义在
 * `src/app/api/mimo/route.ts` 的 `SYSTEM_PROMPTS.optimize` 中，是完整结构：
 *   diagnosis / optimizationPlan[] / codeInstructions[] /
 *   estimatedScoreIncrease / optimizationDecision / optimizationMemory / confidence
 *
 * 但仓库里遗留的 `OptimizationPlan` 类型只有 `{ issues: [{problem, solution}] }`，
 * 与真实输出对不上 —— 这也是该 step 此前从未被接线、方案无法落库的原因之一。
 *
 * 这里做「宽容归一化」：既能吃下完整 schema，也能吃下旧版 issues 数组，
 * 且永远返回 UI 可直接渲染的结构（解析不出来时返回 null，由调用方决定降级）。
 */

import type {
  OptimizationPlan,
  OptimizationPlanItem,
  OptimizationCodeInstruction,
} from '@/types/agent';

const PRIORITIES = ['P0', 'P1', 'P2'] as const;
const ACTIONS = ['modify', 'replace', 'remove'] as const;
const DECISIONS = ['complete', 'fix', 'optimize'] as const;

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
    : [];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** 归一化单条优化项；兼容新版完整字段与旧版 { problem, solution } */
function normalizeItem(raw: unknown, index: number): OptimizationPlanItem | null {
  const o = asRecord(raw);
  const problem = str(o.problem) || str(o.issue);
  if (!problem) return null; // 没有问题描述的条目对 UI 无意义，丢弃

  const priority = str(o.priority).toUpperCase();

  return {
    priority: (PRIORITIES as readonly string[]).includes(priority)
      ? (priority as OptimizationPlanItem['priority'])
      : index === 0
        ? 'P0'
        : 'P1',
    category: str(o.category, 'visual'),
    targetComponent: str(o.targetComponent) || str(o.file, '—'),
    problem,
    reason: str(o.reason),
    before: str(o.before),
    // 旧 schema 里 solution 等价于「改成什么」
    after: str(o.after) || str(o.solution),
    expectedImpact: str(o.expectedImpact),
  };
}

function normalizeCodeInstruction(raw: unknown): OptimizationCodeInstruction | null {
  const o = asRecord(raw);
  const file = str(o.file);
  if (!file) return null;
  const action = str(o.action).toLowerCase();
  return {
    file,
    action: (ACTIONS as readonly string[]).includes(action)
      ? (action as OptimizationCodeInstruction['action'])
      : 'modify',
    changes: strArray(o.changes),
  };
}

/**
 * 把 Optimization Agent 的原始响应归一化成 OptimizationPlan。
 * @param raw  已解析的 JSON 对象，或 JSON 字符串（会尝试再解析一次）
 * @param round 当前优化轮次（用于 schema 未带 optimizationMemory 时兜底）
 */
export function normalizeOptimizationPlan(raw: unknown, round = 1): OptimizationPlan | null {
  let input = raw;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      return null;
    }
  }
  const o = asRecord(input);

  // 新版字段 optimizationPlan[] 优先；回退到旧版 issues[]
  const planRaw = Array.isArray(o.optimizationPlan)
    ? o.optimizationPlan
    : Array.isArray(o.issues)
      ? o.issues
      : null;
  if (!planRaw) return null;

  const items = planRaw
    .map((it, i) => normalizeItem(it, i))
    .filter((x): x is OptimizationPlanItem => x !== null);
  if (items.length === 0) return null;

  const diag = asRecord(o.diagnosis);
  const memory = asRecord(o.optimizationMemory);
  const decision = str(o.optimizationDecision).toLowerCase();

  return {
    diagnosis: {
      rootCause: str(diag.rootCause, items[0].problem),
      affectedAreas: strArray(diag.affectedAreas),
      designDNAAtRisk: diag.designDNAAtRisk === true,
    },
    items,
    codeInstructions: Array.isArray(o.codeInstructions)
      ? o.codeInstructions
          .map(normalizeCodeInstruction)
          .filter((x): x is OptimizationCodeInstruction => x !== null)
      : [],
    estimatedScoreIncrease: num(o.estimatedScoreIncrease, 0),
    decision: (DECISIONS as readonly string[]).includes(decision)
      ? (decision as OptimizationPlan['decision'])
      : 'fix',
    confidence: num(o.confidence, 0.5),
    round: num(memory.round, round),
  };
}

/**
 * 把优化方案压缩成可注入 code step 的纯文本指令。
 * 对应 route.ts 里 `context.optimizationIssues` 分支（"⚡ 自动优化模式"），
 * 但注入时机完全由用户手动决定。
 */
export function formatOptimizationIssues(plan: OptimizationPlan): string {
  const lines: string[] = [`根因：${plan.diagnosis.rootCause}`];

  if (plan.diagnosis.affectedAreas.length > 0) {
    lines.push(`受影响区域：${plan.diagnosis.affectedAreas.join('、')}`);
  }
  if (plan.diagnosis.designDNAAtRisk) {
    lines.push('⚠️ 设计 DNA 有流失风险：修改时必须保留原站的核心视觉特征。');
  }

  lines.push('', '必须修复以下问题（按优先级）：');
  for (const it of plan.items) {
    lines.push(`- [${it.priority}] ${it.targetComponent}：${it.problem}`);
    if (it.reason) lines.push(`   原因：${it.reason}`);
    if (it.after) lines.push(`   改法：${it.after}`);
  }

  if (plan.codeInstructions.length > 0) {
    lines.push('', '文件级改动：');
    for (const ci of plan.codeInstructions) {
      lines.push(`- ${ci.file}（${ci.action}）`);
      for (const c of ci.changes) lines.push(`   · ${c}`);
    }
  }

  return lines.join('\n');
}
