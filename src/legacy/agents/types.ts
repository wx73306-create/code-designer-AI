/**
 * Shared types for all agents in the Code Designer AI pipeline.
 *
 * These interfaces define the data contracts exchanged between
 * CaptureAgent, VisionAgent, ReviewAgent, and OptimizeAgent
 * throughout the multi-phase website cloning workflow.
 */

// ---------------------------------------------------------------------------
// Agent lifecycle
// ---------------------------------------------------------------------------

/** Current execution state of an agent. */
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error' | 'cancelled';

/** Standardised result returned by every agent's `execute()` method. */
export interface AgentResult {
  /** Whether the agent completed successfully. */
  success: boolean;
  /** Arbitrary payload produced on success. */
  data?: any;
  /** Human-readable error message when `success` is `false`. */
  error?: string;
  /** Wall-clock duration of the execution in milliseconds. */
  duration: number;
  /** Chronological log entries emitted during the run. */
  logs: AgentLog[];
}

/** A single timestamped log entry emitted by an agent. */
export interface AgentLog {
  /** Unix epoch in milliseconds when the entry was created. */
  timestamp: number;
  /** Severity level following standard logging conventions. */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Free-form human-readable message. */
  message: string;
}

// ---------------------------------------------------------------------------
// Phase 2 -- Website Intelligence Package
// ---------------------------------------------------------------------------

/**
 * The Website Intelligence Package protocol now lives in ONE shared location
 * (`@/types/website-package`) so every consumer serialises an identical shape.
 *
 * Re-exported here for backwards compatibility with the legacy pipeline.
 */
export type {
  WebsitePackage,
  ScreenshotData,
  AssetData,
  DOMAnalysis,
  SectionInfo,
  SectionRole,
  LayoutAnalysis,
  LayoutBlock,
  PageMetadata,
  StyleAnalysis,
  ColorInfo,
  FontInfo,
  SpacingInfo,
  DesignSystem,
  ComponentPlan,
  ComponentNode,
  ComponentFile,
  AnimationData,
} from '@/types/website-package';

export { WEBSITE_PACKAGE_VERSION, createEmptyPackage } from '@/types/website-package';

// ---------------------------------------------------------------------------
// Phase 7 -- Visual evaluation
// ---------------------------------------------------------------------------

/**
 * Scored comparison between the original website and the generated clone.
 *
 * Produced by {@link ReviewAgent} and consumed by {@link OptimizeAgent}.
 */
export interface VisualEvaluation {
  /** Weighted average score across all dimensions (0-100). */
  totalScore: number;
  /** Per-dimension scores (each 0-100). */
  dimensions: {
    layout: number;
    color: number;
    typography: number;
    spacing: number;
    detail: number;
    responsiveness: number;
  };
  /** Specific visual discrepancies found during evaluation. */
  issues: EvaluationIssue[];
  /** Free-form suggestions for improvement. */
  suggestions: string[];
}

/** A single issue identified during visual evaluation. */
export interface EvaluationIssue {
  /** Which scoring dimension this issue belongs to. */
  dimension: string;
  /** How severely this issue impacts visual fidelity. */
  severity: 'critical' | 'major' | 'minor';
  /** Human-readable description of the discrepancy. */
  description: string;
  /** Suggested code or design change to resolve the issue. */
  fix: string;
}

// ---------------------------------------------------------------------------
// Phase 8 -- Optimisation loop
// ---------------------------------------------------------------------------

/**
 * Result of a single optimisation round.
 *
 * Tracked by {@link OptimizeAgent} to detect convergence.
 */
export interface OptimizationResult {
  /** 1-based round number. */
  round: number;
  /** Visual score before this round's changes. */
  previousScore: number;
  /** Visual score after this round's changes. */
  newScore: number;
  /** Human-readable list of improvements made. */
  improvements: string[];
  /** Map of filename to updated source code. */
  code: Map<string, string>;
  /** Whether the optimisation loop should stop after this round. */
  converged: boolean;
}

// ---------------------------------------------------------------------------
// Pipeline configuration
// ---------------------------------------------------------------------------

/** Top-level configuration for the multi-agent cloning pipeline. */
export interface PipelineConfig {
  /** Maximum number of optimisation rounds before the loop is forced to stop. */
  maxOptimizationRounds: number;
  /** Minimum visual score (0-100) required to consider the clone acceptable. */
  targetScore: number;
  /** Whether to use Playwright for full browser-based capture. */
  enablePlaywright: boolean;
  /** Whether to invoke the multimodal AI for vision-based analysis. */
  enableVisionAnalysis: boolean;
  /** Whether to run the automatic optimisation loop after initial generation. */
  enableAutoOptimization: boolean;
  /** Style profile identifiers to load from the knowledge base. */
  knowledgeBase: string[];
}
