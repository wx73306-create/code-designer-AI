/**
 * Visual Evaluation — Schema Normalization
 * 将 AI 返回的原始对象规范化为 VisualScore，保证每个字段可用。
 */

import type { VisualScore, VisualScoreDimensions, VisualProblem } from '@/types/agent';
import { computeOverallScore } from './scoring';

const DEFAULT_DIMENSIONS: VisualScoreDimensions = {
  layout_score: 80,
  visual_balance: 78,
  spacing_score: 76,
  color_score: 82,
  typography_score: 80,
  premium_score: 70,
};

const VALID_PROBLEM_TYPES = new Set([
  'layout', 'balance', 'spacing', 'color', 'typography', 'premium',
]);

function clampScore(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(100, Math.max(0, Math.round(num)));
}

// ---------------------------------------------------------------------------
// B.2.4.3 —— 字段别名（Field aliasing）：让解析侧读得懂 QA Agent 的真实输出
//
// 实证发现（2026-09-25）：QA Agent **实际产出**的是自己的一套命名，与本契约**零重叠**：
//
//   模型实际 → { scores: { visualFidelity, layout, hierarchy, typography,
//                          color, spacing, interaction, premium }, totalScore: 82 }
//   契约期望 → { scores: { layout_score, visual_balance, spacing_score,
//                          color_score, typography_score, premium_score }, overall_score }
//
// 于是六个维度全部取不到值 → 每个 clampScore 各自回落 DEFAULT_DIMENSIONS
// → computeOverallScore 恒为 77.4 → 账本里所谓「服务端权威分数」其实是个常量。
//
// 两点重要约束：
//  1. prompt 里**已经**写死了契约 schema，模型依然不遵守 ⇒ 只改 prompt 无效，必须在解析侧容错。
//  2. 只做「同名不同写法」的归一，**绝不做跨语义映射**
//     （例如绝不把 hierarchy「视觉层级」当成 visual_balance「视觉平衡」）——
//     那正是 B.2 契约最反对的语义混淆。取不到的维度宁可明写「回落」，也不张冠李戴。
// ---------------------------------------------------------------------------

/** 每个契约维度可接受的键名（按顺序优先匹配）。 */
const DIMENSION_ALIASES: Record<keyof VisualScoreDimensions, string[]> = {
  layout_score: ['layout_score', 'layoutScore', 'layout'],
  visual_balance: ['visual_balance', 'visualBalance', 'balance'],
  spacing_score: ['spacing_score', 'spacingScore', 'spacing'],
  color_score: ['color_score', 'colorScore', 'color'],
  typography_score: ['typography_score', 'typographyScore', 'typography'],
  premium_score: ['premium_score', 'premiumScore', 'premium'],
};

/** 模型可能用来表达「总分」的键名。 */
const OVERALL_KEYS = ['overall_score', 'overallScore', 'totalScore', 'total_score'];

/** 分数来源（B.2.4.3 provenance）——让「回落」不再隐形。 */
export interface ScoreProvenance {
  /** 每个维度实际命中的键名；null = 没取到、用了默认值。 */
  resolvedKeys: Record<keyof VisualScoreDimensions, string | null>;
  /** 用了默认值的维度；为空表示六维全是真实测量。 */
  defaultedDimensions: Array<keyof VisualScoreDimensions>;
  /** 总分来源：model=模型自报总分；computed=维度加权算出；default=全部回落（伪测量）。 */
  overallSource: 'model' | 'computed' | 'default';
}

function isNumberLike(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string' && v.trim() !== '') return Number.isFinite(Number(v));
  return false;
}

/** 按别名找第一个可用数值，返回命中键名（未命中返回 null）。 */
function resolveKey(src: Record<string, unknown>, aliases: string[]): string | null {
  for (const key of aliases) {
    if (isNumberLike(src[key])) return key;
  }
  return null;
}

/**
 * 规范化 AI 返回的视觉评分对象。
 * 兼容 { scores: {...}, problems: [...] } 与扁平结构。
 */
export function normalizeVisualScore(raw: unknown, round?: number): VisualScore {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  // 六维 + 总分的解析统一走 resolveScores（scores 嵌套或扁平都能处理）
  const resolved = resolveScores(obj);
  const scores = resolved.scores;

  // problems 数组
  const rawProblems = Array.isArray(obj.problems) ? obj.problems : [];
  const problems: VisualProblem[] = rawProblems
    .map((p) => {
      const prob = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      const type = typeof prob.type === 'string' && VALID_PROBLEM_TYPES.has(prob.type)
        ? (prob.type as VisualProblem['type'])
        : 'premium';
      const description = typeof prob.description === 'string' && prob.description.trim()
        ? prob.description.trim()
        : '';
      return description ? { type, description } : null;
    })
    .filter((p): p is VisualProblem => p !== null)
    .slice(0, 12);

  // ---- overall 取值策略（B.2.4.3）----
  //  · 六维全部真实命中 → 沿用契约口径：加权计算，保证与权重模型一致；
  //  · 有维度回落     → 加权结果会被默认值污染，此时优先采信模型自报总分（若给了）；
  //  · 都没有          → 只能用被污染的加权值，并由 provenance 标出回落维度（不再隐形）。
  const overall = resolved.defaultedDimensions.length === 0 || resolved.modelOverall === null
    ? computeOverallScore(scores)
    : resolved.modelOverall;

  return {
    overall_score: overall,
    scores,
    problems,
    round: round ?? 1,
  };
}

/** 解析结果（内部共用，避免 normalizeVisualScore 与 scoreProvenance 两套逻辑漂移）。 */
interface ResolvedScores {
  scores: VisualScoreDimensions;
  resolvedKeys: Record<keyof VisualScoreDimensions, string | null>;
  defaultedDimensions: Array<keyof VisualScoreDimensions>;
  /** 模型自报总分的命中键名（未命中为 null）。 */
  overallKey: string | null;
  /** 模型自报总分（未命中为 null）。 */
  modelOverall: number | null;
}

/**
 * 按别名解析六维 + 总分。
 *
 * 只归一「同种语义的不同写法」，不做跨语义映射：取不到就是取不到，
 * 明确记进 defaultedDimensions —— 这正是 B.2.4.3 要的「回落可见」。
 */
function resolveScores(obj: Record<string, unknown>): ResolvedScores {
  // scores 可能在 obj.scores 里，也可能扁平地挂在 obj 上
  const scoresSrc = (obj.scores && typeof obj.scores === 'object'
    ? obj.scores
    : obj) as Record<string, unknown>;

  const resolvedKeys = {} as Record<keyof VisualScoreDimensions, string | null>;
  const defaultedDimensions: Array<keyof VisualScoreDimensions> = [];
  const scores = {} as VisualScoreDimensions;

  for (const dim of Object.keys(DIMENSION_ALIASES) as Array<keyof VisualScoreDimensions>) {
    const hit = resolveKey(scoresSrc, DIMENSION_ALIASES[dim]);
    resolvedKeys[dim] = hit;
    if (hit === null) {
      defaultedDimensions.push(dim);
      scores[dim] = DEFAULT_DIMENSIONS[dim];
    } else {
      scores[dim] = clampScore(scoresSrc[hit], DEFAULT_DIMENSIONS[dim]);
    }
  }

  // 总分：顶层或 scores 内都找一遍（模型放哪儿都有可能）
  let overallKey: string | null = null;
  let modelOverall: number | null = null;
  for (const src of [obj, scoresSrc]) {
    const hit = resolveKey(src, OVERALL_KEYS);
    if (hit) {
      overallKey = hit;
      modelOverall = clampScore(src[hit], 0);
      break;
    }
  }

  return { scores, resolvedKeys, defaultedDimensions, overallKey, modelOverall };
}

/**
 * B.2.4.3 —— 分数来源（provenance）。
 *
 * 回答一个问题：这次的 qualityScore 到底是**真测量**还是**回落常量**。
 * 与 `normalizeVisualScore` 共用同一套解析，不会出现两个口径。
 */
export function scoreProvenance(raw: unknown): ScoreProvenance {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const r = resolveScores(obj);

  let overallSource: ScoreProvenance['overallSource'];
  if (r.defaultedDimensions.length === 6 && r.modelOverall === null) {
    overallSource = 'default';
  } else if (r.defaultedDimensions.length > 0 && r.modelOverall !== null) {
    overallSource = 'model';
  } else {
    overallSource = 'computed';
  }

  return {
    resolvedKeys: r.resolvedKeys,
    defaultedDimensions: r.defaultedDimensions,
    overallSource,
  };
}
