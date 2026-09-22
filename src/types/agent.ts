// =============================================================================
// Code Designer AI - Core Type Definitions
// =============================================================================

import type { CodeValidationResult } from '@/lib/code-rules/validator';
import type { ReconstructionScore } from '@/types/reconstruction';

// ---------------------------------------------------------------------------
// Log Entry
// ---------------------------------------------------------------------------
export type LogType = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  timestamp: number;
  message: string;
  type: LogType;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error';

export type AgentId =
  | 'browser'
  | 'vision'
  | 'stylematcher'
  | 'planning'
  | 'code'
  | 'animation'
  | 'qa'
  | 'deploy'
  | 'preview';

export interface Agent {
  id: AgentId;
  name: string;
  icon: string; // lucide-react icon name (resolved at render time)
  status: AgentStatus;
  progress: number; // 0-100
  logs: LogEntry[];
  startTime: number | null;
  endTime: number | null;
  /** Live streaming text (token-by-token) pushed during a running stage's SSE stream. Cleared when the stage starts. */
  streamingText?: string;
}

// ---------------------------------------------------------------------------
// Design Tokens
// ---------------------------------------------------------------------------
export interface ColorToken {
  name: string;
  hex: string;
  usage: string;
}

export interface TypographyToken {
  name: string;
  family: string;
  weight: number;
  size: string;
  usage: string;
}

export interface ShadowToken {
  name: string;
  value: string;
}

export interface AnimationToken {
  name: string;
  property: string;
  duration: string;
  easing: string;
}

export interface DesignAnalysis {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: number[];
  borderRadius: number[];
  shadows: ShadowToken[];
  animations: AnimationToken[];
}

// ---------------------------------------------------------------------------
// Component Tree
// ---------------------------------------------------------------------------
export interface ComponentNode {
  name: string;
  type: 'component' | 'element' | 'text' | 'container' | 'page';
  children: ComponentNode[];
  props: Record<string, string | number | boolean>;
  code?: string;
}

// ---------------------------------------------------------------------------
// QA
// ---------------------------------------------------------------------------
export type IssueSeverity = 'critical' | 'major' | 'minor' | 'cosmetic';

export interface QAIssue {
  type: string;
  description: string;
  severity: IssueSeverity;
  fixed: boolean;
}

export interface QAFix {
  issue: string;
  description: string;
  applied: boolean;
}

// ---------------------------------------------------------------------------
// Visual Evaluation — 视觉评分与自动优化系统 (Visual Score)
// ---------------------------------------------------------------------------

/** 六维视觉评分（满分各 100，加权合成 overall） */
export interface VisualScoreDimensions {
  layout_score: number;      // 布局 20%
  visual_balance: number;    // 视觉平衡 15%
  spacing_score: number;     // 空间 15%
  color_score: number;       // 颜色 15%
  typography_score: number;  // 字体 15%
  premium_score: number;     // 高级感 20% ⭐
}

export interface VisualProblem {
  type: 'layout' | 'balance' | 'spacing' | 'color' | 'typography' | 'premium';
  description: string;
}

export interface VisualScore {
  overall_score: number;               // 加权总分 0-100
  scores: VisualScoreDimensions;
  problems: VisualProblem[];
  round?: number;                       // 优化轮次
}

/** 单条优化项（对应 SYSTEM_PROMPTS.optimize 的 optimizationPlan[]） */
export interface OptimizationPlanItem {
  priority: 'P0' | 'P1' | 'P2';
  category: string;              // layout / component / typography / color / spacing ...
  targetComponent: string;
  problem: string;
  reason: string;
  before: string;
  after: string;
  expectedImpact: string;
}

/** 文件级改动指令（对应 codeInstructions[]） */
export interface OptimizationCodeInstruction {
  file: string;
  action: 'modify' | 'replace' | 'remove';
  changes: string[];
}

/** Optimization Agent 输出的优化方案（Phase 7：手动触发，绝不会自动生成） */
export interface OptimizationPlan {
  diagnosis: {
    rootCause: string;
    affectedAreas: string[];
    designDNAAtRisk: boolean;
  };
  items: OptimizationPlanItem[];
  codeInstructions: OptimizationCodeInstruction[];
  estimatedScoreIncrease: number;
  decision: 'complete' | 'fix' | 'optimize';
  confidence: number;
  round: number;
}

export interface QAResult {
  /**
   * @deprecated 历史兼容字段，**语义是错的，请勿在新代码中使用**。
   *
   * 契约注释写的是「0-100 percentage（相似度）」，但实现上一直被赋成
   * 六维质量分 `VisualScore.overall_score`（见 src/store/use-workflow.ts）。
   * 也就是说：一个「好看但完全不像原站」的页面会在这里拿高分。
   *
   * 保留它是为了不炸历史消费方（qa-section.tsx 等），不删、不改赋值。
   * 新代码请用 `qualityScore` / `reconstructionScore`。
   */
  similarity?: number;

  /**
   * 视觉质量分（0-100）：**这个网页设计得好吗？**
   * 等于 `visualScore.overall_score`，只是给了它一个语义正确的名字。
   */
  qualityScore?: number;

  /**
   * 还原度（0-100）：**AI 做出来的像不像原网页？**
   * 与质量分是两件事，不能互相替代。null = 无法度量（渲染降级 / 真值缺失）。
   * 详见 src/types/reconstruction.ts 的三条硬约定。
   */
  reconstructionScore?: ReconstructionScore | null;

  issues: QAIssue[];
  fixes: QAFix[];
  screenshots: {
    original: string;
    clone: string;
    overlay: string;
  };
  accessibilityScore?: number;  // 0-100
  performanceScore?: number;    // 0-100
  metrics?: Record<string, number>; // per-category scores: visual, responsive, seo, code, image
  dimensionScores?: Record<string, number>; // 5-dimension: layout, color, typography, spacing, asset
  visualScore?: VisualScore;    // 六维视觉评分（Visual Evaluation Agent 输出）
  optimizationRounds?: number;  // 已执行的视觉优化轮次
}

// ---------------------------------------------------------------------------
// B.2 Quality / Reconstruction Metrics（契约冻结版，见 docs/B2-CONTRACT-DESIGN-FREEZE.md §3）
//
// B.2.1 只落地**类型**：新增接口、不接生产点、不接消费点、不改任何既有字段。
// ---------------------------------------------------------------------------
export interface QualityMetrics {
  /**
   * @deprecated 历史兼容字段，语义是「视觉质量分」，不是相似度。
   * 保留、不删除、继续双写，直到 Migration Phase 4 停止生产。
   *
   * Producer: QA Agent（use-workflow.ts:1312）
   * Source  : visualScore.overall_score
   * Read    : 当 qualityScore 也存在时，一律以 qualityScore 为准（见下方读取优先级）
   */
  similarity?: number;

  /**
   * 视觉质量分（0-100）：这个网页设计得好吗
   *
   * Producer: QA Agent
   * Source  : visualScore.overall_score（六维加权）
   * 缺失语义: undefined = 未产生；null = 有流程但结果不可得
   *          （生产侧 qa-section.tsx:85 已按 number | null 消费）
   */
  qualityScore?: number | null;

  /**
   * 还原度（0-100）：像不像目标网站
   *
   * Producer: Reconstruction Diff（src/store/use-workflow.ts → /api/reconstruction）
   * Source  : ReconstructionScore.score（9 维加权，types/reconstruction.ts:214）
   * 缺失语义: undefined = 未开启 / 未产生；null = 有流程但结果不可得（降级 / 真值缺失）
   *
   * 裁决记录（2026-09-22，原冻结为 `number`）：
   * §4 四态语义是硬不变量，null 必须可表达；且生产侧产出就是
   * `ReconstructionScore | null`（QAResult.reconstructionScore 同为 `... | null`），
   * 严格模式下 null 赋给 number 会编译失败。故收敛为 `number | null`；
   * 「为什么不可得」另由 reconstructionMeta.degradedReason 承载（两者不重复表达同一件事）。
   */
  reconstructionScore?: number | null;

  reconstructionMeta?: {
    /** 哪些页面区域参与了测量（role 序列，不是计数） */
    measuredSections?: string[];
    // TODO(B.2.x): 由 unknown 收敛为 DiffReport / 具名接口，避免 Export/Admin 侧类型逃逸
    structuralDiff?: unknown;
    visualDiff?: unknown;
    degradedReason?: string;
  };
}

// ---------------------------------------------------------------------------
// Deploy
// ---------------------------------------------------------------------------
export type DeployStatus = 'pending' | 'building' | 'deploying' | 'live' | 'failed';
export type BuildStatus = 'pending' | 'compiling' | 'success' | 'failed';

export interface DeployResult {
  url: string;
  githubUrl: string;
  status: DeployStatus;
  deployTime: number; // seconds
  buildStatus: BuildStatus;
  /** 标记为演示数据：未发生真实部署，UI 必须显著标注，不得展示为真实在线地址 */
  demo?: boolean;
}

// ---------------------------------------------------------------------------
// Design Critic — Decision Output
// ---------------------------------------------------------------------------
export interface VisualHierarchyItem {
  element: string;
  score: number; // 0-100 weight
}

export interface StructureIssue {
  problem: string;
  solution: string;
}

export interface PremiumScore {
  layout: number;     // 0-20
  typography: number; // 0-20
  color: number;      // 0-20
  image: number;      // 0-20
  premium: number;    // 0-20
}

export interface DesignDecision {
  // Task 1: 页面定位分析
  brandPosition: string;
  userFeeling: string[];
  designGoal: string;
  // Task 2: 视觉层级分析
  visualHierarchy: VisualHierarchyItem[];
  // Task 3: 页面结构审查
  structureIssues: StructureIssue[];
  // Task 4: 高级感评分
  score: PremiumScore;
  totalScore: number; // 0-100
  // 设计决策
  keep: string[];
  remove: string[];
  improve: string[];
  style: {
    direction: string;
    tone: string;
  };
  // QA 反馈闭环轮次
  round?: number;
}

// ---------------------------------------------------------------------------
// Style Matcher (Web Design Knowledge Base)
// ---------------------------------------------------------------------------

/** 单个风格档案的匹配得分明细（满分 100：布局30 + 色彩25 + 组件25 + 字体20） */
export interface StyleScoreBreakdown {
  layout: number;     // 0-30
  color: number;      // 0-25
  components: number; // 0-25
  typography: number; // 0-20
  total: number;      // 0-100
}

/** Style Matcher Agent 的匹配结果 */
export interface StyleMatch {
  matchedStyle: string;                 // 最佳匹配风格名，如 "Apple Style"
  matchedStyleId: string;               // 风格档案 id，如 "apple"
  confidence: number;                   // 置信度 0-100
  secondaryStyle: string;               // 次级风格名
  scores: Record<string, number>;       // 所有风格的总分 { "Apple Style": 92, ... }
  breakdown: StyleScoreBreakdown;       // 最佳风格的四维得分明细
  reasoning: string;                    // 匹配理由简述
}

/** 由匹配风格生成的设计系统（Design System Generator 输出） */
export interface GeneratedDesignSystem {
  style: string;                        // 所属风格名
  philosophy: string[];                 // 设计理念
  tokens: {
    spacing: { small: number; medium: number; large: number };
    radius: number;
    shadow: 'none' | 'soft' | 'medium' | 'strong';
    colors: { background: string[]; text: string; accent: string };
    typography: { font: string; titleSize: string; weight: string; lineHeight: string };
  };
  rules: string[];                      // 必须遵守的设计规则
  avoid: string[];                      // 禁止事项
  components: { preferred: string[]; avoid: string[] };
}

// ---------------------------------------------------------------------------
// Project Structure (file tree)
// ---------------------------------------------------------------------------
export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  language?: string;
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------
export type TaskStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'error';

export type ActiveSection =
  | 'home'
  | 'analysis'
  | 'stylematcher'
  | 'components'
  | 'code'
  | 'qa'
  | 'deploy'
  | 'preview';

export type GoalType =
  | 'colors'
  | 'layout'
  | 'style'
  | 'features'
  | 'template'
  | null;

// ---------------------------------------------------------------------------
// Design Mode System — 网页生成模式系统
// ---------------------------------------------------------------------------

/** 生成模式：精准复刻 / 设计升级 */
export type ModeType = 'clone' | 'enhancement';

export interface EnhancementItem {
  category: 'layout' | 'typography' | 'image' | 'animation' | 'spacing' | 'component' | 'color';
  before: string;
  after: string;
}

/** Enhancement Agent 输出的优化方案（保留设计 DNA + 优化项） */
export interface EnhancementPlan {
  preserve: {
    layout: string;
    style: string;
  };
  improve: EnhancementItem[];
}

export interface Task {
  id: string;
  url: string;
  goal: GoalType;
  mode: ModeType;
  /** 用户在首页选择的 AI 模型提供商 id（空字符串表示未选择，自动使用第一个已启用的 provider） */
  model: string;
  prompt: string;
  status: TaskStatus;
  currentAgent: AgentId | null;
  agents: Record<AgentId, Agent>;
  designAnalysis: DesignAnalysis | null;
  designDecision: DesignDecision | null;
  styleMatch: StyleMatch | null;
  designSystem: GeneratedDesignSystem | null;
  enhancementPlan: EnhancementPlan | null;
  codeValidation: CodeValidationResult | null;
  componentTree: ComponentNode | null;
  generatedCode: Map<string, string> | null;
  qaResult: QAResult | null;
  /** 手动触发的优化方案（Optimization Agent 产出，绝不会自动生成） */
  optimizationPlan: OptimizationPlan | null;
  deployResult: DeployResult | null;
  projectStructure: FileNode[] | null;
  startedAt: number | null;
  completedAt: number | null;
  /** 生成失败时的具体错误信息，用于弹窗展示 */
  errorMessage: string | null;
  /** AI 生成的高质量预览 HTML（Preview Agent 产出） */
  aiPreviewHtml: string | null;
  /** 正则转换的快速预览 HTML（buildPreviewHtml 产出，仅用于临时预览和 QA 评分） */
  previewHtml: string | null;
}

// ---------------------------------------------------------------------------
// Store State
// ---------------------------------------------------------------------------
export interface AgentStoreState {
  task: Task;
  activeSection: ActiveSection;
  isRunning: boolean;

  // Actions
  startTask: (url: string, goal?: GoalType, prompt?: string, mode?: ModeType, model?: string) => void;
  cancelTask: () => void;
  resetTask: () => void;
  updateAgent: (agentId: AgentId, partial: Partial<Agent>) => void;
  addLog: (agentId: AgentId, entry: Omit<LogEntry, 'timestamp'>) => void;
  setActiveSection: (section: ActiveSection) => void;
  setTaskPartial: (partial: Partial<Task>) => void;
}
