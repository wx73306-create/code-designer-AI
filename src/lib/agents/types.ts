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
 * Complete intelligence snapshot of a captured website.
 *
 * Assembled by {@link CaptureAgent} and progressively enriched by
 * downstream agents (design system, component plan, animations, etc.).
 */
export interface WebsitePackage {
  /** The URL that was captured. */
  url: string;
  /** ISO-8601 timestamp of when the capture took place. */
  capturedAt: string;
  /** Screenshots taken at various viewport breakpoints. */
  screenshots: ScreenshotData[];
  /** Static assets discovered on the page (images, SVGs, fonts, icons). */
  assets: AssetData[];
  /** Structural analysis of the page's DOM tree. */
  dom: DOMAnalysis;
  /** Extracted CSS style information. */
  styles: StyleAnalysis;
  /** High-level design system inferred from the page. */
  design: DesignSystem;
  /** Component decomposition plan for code generation. */
  components: ComponentPlan;
  /** Animations and transitions detected on the page. */
  animations: AnimationData[];
}

// ---------------------------------------------------------------------------
// Screenshots & assets
// ---------------------------------------------------------------------------

/** A screenshot captured at a specific viewport size. */
export interface ScreenshotData {
  /** Viewport category label (e.g. `'desktop'`, `'tablet'`, `'mobile'`). */
  viewport: string;
  /** Viewport width in pixels. */
  width: number;
  /** Viewport height in pixels. */
  height: number;
  /** Base-64 encoded PNG data URL (populated when Playwright is enabled). */
  dataUrl?: string;
  /** Optional human-readable description of the captured state. */
  description?: string;
}

/** A static asset discovered on the page. */
export interface AssetData {
  /** Broad category of the asset. */
  type: 'image' | 'svg' | 'font' | 'icon';
  /** Original URL (or synthetic identifier for inline assets). */
  url: string;
  /** Local filesystem path after the asset has been downloaded. */
  localPath?: string;
  /** MIME type when known. */
  mimeType?: string;
  /** File size in bytes when known. */
  size?: number;
}

// ---------------------------------------------------------------------------
// DOM analysis
// ---------------------------------------------------------------------------

/** Structural summary of the page's DOM tree. */
export interface DOMAnalysis {
  /** Heuristic page-type classification (e.g. `'landing'`, `'ecommerce'`). */
  pageType: string;
  /** Semantic sections detected in the DOM. */
  sections: SectionInfo[];
  /** Primary CSS layout strategy in use (`'css-grid'`, `'flexbox'`, or `'block'`). */
  layout: string;
  /** Whether responsive design patterns were detected. */
  responsive: boolean;
  /** Abbreviated HTML structure for downstream analysis. */
  structure: string;
}

/** Metadata for a single semantic section of the page. */
export interface SectionInfo {
  /** Synthetic name used to reference this section. */
  name: string;
  /** HTML tag that defines the section. */
  tag: string;
  /** CSS height value or `'auto'`. */
  height: string;
  /** Layout model used within this section. */
  layout: string;
  /** Names of direct child sections. */
  children: string[];
  /** Semantic role of this section within the page. */
  role: 'hero' | 'nav' | 'content' | 'feature' | 'product' | 'cta' | 'footer' | 'other';
}

// ---------------------------------------------------------------------------
// Style analysis
// ---------------------------------------------------------------------------

/** Extracted CSS / visual style information. */
export interface StyleAnalysis {
  /** Colour palette with semantic role assignments. */
  colors: ColorInfo[];
  /** Font families with weight and size data. */
  fonts: FontInfo[];
  /** Spacing scale and container metrics. */
  spacing: SpacingInfo;
  /** Box-shadow declarations found on the page. */
  shadows: string[];
  /** Border-radius values found on the page. */
  borderRadius: string[];
  /** CSS transition declarations. */
  transitions: string[];
  /** Custom CSS properties (`--var: value`). */
  cssVariables: Record<string, string>;
}

/** A single colour extracted from the page with its semantic role. */
export interface ColorInfo {
  /** Hex colour code (e.g. `'#3b82f6'`). */
  hex: string;
  /** Semantic role this colour plays in the design. */
  role: 'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'border';
  /** Free-form description of where / how the colour is used. */
  usage: string;
}

/** A font family extracted from the page. */
export interface FontInfo {
  /** Font family name. */
  family: string;
  /** Font weights observed on the page. */
  weights: number[];
  /** Font sizes observed on the page. */
  sizes: string[];
  /** Semantic role of the font within the design system. */
  role: 'heading' | 'body' | 'mono' | 'ui';
}

/** Spacing scale and container metrics. */
export interface SpacingInfo {
  /** Base spacing unit (e.g. `'4px'`). */
  base: string;
  /** Ordered spacing scale from smallest to largest. */
  scale: string[];
  /** Maximum width of the content container. */
  containerMaxWidth: string;
  /** Vertical padding applied to page sections. */
  sectionPadding: string;
}

// ---------------------------------------------------------------------------
// Design system
// ---------------------------------------------------------------------------

/**
 * High-level design system description inferred from the captured page.
 *
 * Populated by {@link VisionAgent} during Phase 3.
 */
export interface DesignSystem {
  /** Overall visual style (e.g. `'modern-minimal'`, `'glassmorphism'`). */
  style: string;
  /** Brand or product name detected from the page. */
  brand: string;
  /** Free-form description of the visual language. */
  visualLanguage: string;
  /** Named colour palette (`{ primary: '#...', ... }`). */
  colorPalette: Record<string, string>;
  /** Named typography tokens (`{ heading: 'Inter 700', ... }`). */
  typography: Record<string, string>;
  /** Spacing scale values. */
  spacingScale: string[];
  /** Recurring component patterns (e.g. `'card-with-shadow'`). */
  componentPatterns: string[];
  /** Animation / motion style description. */
  animationStyle: string;
}

// ---------------------------------------------------------------------------
// Component plan
// ---------------------------------------------------------------------------

/** Decomposition of the page into a tree of reusable components. */
export interface ComponentPlan {
  /** Root nodes of the component tree. */
  tree: ComponentNode[];
  /** Flat list of component files to generate. */
  files: ComponentFile[];
  /** Total number of components in the plan. */
  totalComponents: number;
}

/** A single node in the component tree. */
export interface ComponentNode {
  /** Component display name. */
  name: string;
  /** Component type / category. */
  type: string;
  /** Child component nodes. */
  children: ComponentNode[];
  /** Optional prop definitions for this component. */
  props?: Record<string, string>;
}

/** Metadata for a single component file to be generated. */
export interface ComponentFile {
  /** Target filename (e.g. `'HeroSection.tsx'`). */
  filename: string;
  /** Component name exported from the file. */
  component: string;
  /** Other component files this one depends on. */
  dependencies: string[];
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

/** A single animation or transition detected on the page. */
export interface AnimationData {
  /** Descriptive name for the animation. */
  name: string;
  /** Category of animation. */
  type: 'transition' | 'keyframe' | 'scroll' | 'hover' | 'entrance';
  /** CSS duration value. */
  duration: string;
  /** CSS easing function. */
  easing: string;
  /** CSS selector or component the animation targets. */
  target: string;
}

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
