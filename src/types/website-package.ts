/**
 * Website Intelligence Package — 统一数据协议
 * ===================================================================
 * 所有 Agent 之间通信的唯一标准（对应执行计划书 Phase 0 / Phase 3）。
 *
 * 数据流向：
 *   URL → Capture → Vision → DesignSystem → ComponentPlan → Code → Animation → QA
 *   ↑                                                                        ↓
 *   └──────────────── WebsitePackage（唯一载体）────────────────────────────┘
 *
 * 设计原则：
 *   1. 每个 Agent 只读自己需要的字段，写完就交给下一个 Agent
 *   2. 所有字段可序列化为 JSON（WebsitePackage.json）
 *   3. 允许 Partial 传递 —— 上游未产出的字段由下游 Agent 填充
 *
 * 目录对应关系（计划书 Phase 3）：
 *   package.screenshots → screenshots/
 *   package.dom         → dom/
 *   package.styles      → styles/
 *   package.assets      → assets/
 *   package.layout      → layout/
 *   package.animations  → interaction/
 *   package.metadata    → metadata/
 */

/**
 * 交互采集结果的契约类型。
 *
 * 用 `import type` 而非值导入：编译后消失，不产生运行时依赖，
 * 因此 `types/` 层引用 `lib/` 层的类型不会引入循环或额外打包体积。
 * （协议定义在 src/lib/browser-intelligence/types.ts，见该文件的冻结说明。）
 */
import type { InteractionPackage } from '@/lib/browser-intelligence/types';

// ---------------------------------------------------------------------------
// Root package
// ---------------------------------------------------------------------------

export interface WebsitePackage {
  /** The URL that was captured. */
  url: string;
  /** ISO-8601 timestamp of when the capture took place. */
  capturedAt: string;
  /** Schema version — 用于跨版本兼容识别。 */
  version: string;
  /** Screenshots taken at various viewport breakpoints. */
  screenshots: ScreenshotData[];
  /** Static assets discovered on the page (images, SVGs, fonts, icons). */
  assets: AssetData[];
  /** Structural analysis of the page's DOM tree. */
  dom: DOMAnalysis;
  /** Extracted CSS style information. */
  styles: StyleAnalysis;
  /** Page-level layout composition (section order, proportions, grid). */
  layout: LayoutAnalysis;
  /** High-level design system inferred from the page. */
  design: DesignSystem;
  /** Component decomposition plan for code generation. */
  components: ComponentPlan;
  /** Animations and transitions detected on the page. */
  animations: AnimationData[];
  /** Document metadata harvested from <head>. */
  metadata: PageMetadata;
  /**
   * 交互采集结果（Phase 1 Sprint 2 产出，Sprint 3 接入 Agent）。
   *
   * **刻意是可选的**，而且缺失时必须是 `undefined`，**不能填空对象**：
   *
   * 1. 采集需要真实浏览器，可能失败、超时或被显式关闭
   *    （`INTERACTION_CAPTURE` 默认 off）；
   * 2. formatter 的既有原则是「空段整体跳过，绝不让模型看到空占位符」——
   *    填一个 `{ scrolls: [], clicks: [], meta: { capturedAt: ... } }` 会让模型
   *    看到"有 interaction 字段但里面是空的"，它可能理解成「这个网站没有交互」
   *    甚至自行补全，这与「没采集过」是完全不同的两件事。
   *
   * 下游 Agent 必须容忍 `undefined`。
   */
  interaction?: InteractionPackage;
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
  /**
   * Local path **relative to `website-package/`** after localization
   * (e.g. `assets/ab12….png`, or `assets/placeholders/…svg` when the original
   * was unreachable). Downstream (formatter / generator) must prefer this over
   * `url` — the whole point of P2-03 is that generated projects never hotlink.
   */
  localPath?: string;
  /** MIME type when known. */
  mimeType?: string;
  /** File size in bytes when known. */
  size?: number;
  /** Semantic role inferred from the asset context (e.g. `'logo'`, `'hero'`). */
  role?: string;
  /** sha256 of the localized bytes (P2-03 manifest requirement). */
  hash?: string;
  /** Pixel width of the original asset, when parseable. Absent = not measured. */
  width?: number;
  /** Pixel height of the original asset, when parseable. Absent = not measured. */
  height?: number;
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
  role: SectionRole;
}

/** Semantic role a detected section can play. */
export type SectionRole =
  | 'hero'
  | 'nav'
  | 'content'
  | 'feature'
  | 'product'
  | 'pricing'
  | 'testimonial'
  | 'cta'
  | 'footer'
  | 'other';

// ---------------------------------------------------------------------------
// Layout analysis — 计划书 Phase 3「页面结构」与「布局占比」
// ---------------------------------------------------------------------------

/**
 * 页面版式构成：区块自上而下的顺序、视觉占比与网格系統。
 * 供 Code Agent 决定各组件的高度权重与排列，避免生成「每个区块一样高」的模板感。
 */
export interface LayoutAnalysis {
  /** Vertical composition, ordered top → bottom. */
  flow: LayoutBlock[];
  /** Responsive breakpoints detected in the page's CSS. */
  breakpoints: string[];
  /** Number of grid columns used by the main content area (0 = not grid-based). */
  gridColumns: number;
  /** Gutter / gap size between grid or flex items. */
  gap?: string;
  /** Whether the page uses a sticky or fixed header. */
  stickyHeader: boolean;
  /** Whether the layout is horizontally centered with a max-width container. */
  centered: boolean;
}

/** One block within the vertical page flow. */
export interface LayoutBlock {
  /** Semantic role, aligned with {@link SectionRole}. */
  role: SectionRole;
  /** Approximate share of total page height, 0-100. Sums to ~100 across all blocks. */
  heightWeight: number;
  /**
   * Measured pixel height of the section.
   *
   * Measured from browser geometry.
   * Never inferred from semantic role.
   *
   * 存在理由（1.2.0）：`heightWeight` 是相对文档总高的百分比，在长页面上会退化——
   * 文档高 9000px 时，一个 900px 的 hero 只占 10%，模型无法判断它是「大视觉入口」
   * 还是「小块」。像素高度才是模型复刻区块高度的直接锚点。
   *
   * 刻意是**可选的**：未开采集（`LAYOUT_PROBE=off`）时没有实测值，
   * 此时必须是 `undefined`，**不能填猜测值**（见 `LayoutAnalysis.flow` 的原则）。
   */
  heightPx?: number;
  /** Number of columns this block lays its children out in. */
  columns: number;
  /**
   * 实测的 CSS `z-index`。
   *
   * **刻意是可选的，且 `undefined` 有确切含义**：`z-index: auto`（未建立层叠上下文）
   * 与 `z-index: 0` 在浏览器里是**不同**的两件事 —— 前者随层叠顺序浮动，后者显式
   * 压在第 0 层。把 auto 写成 0 就是编造测量值（与 `heightPx` 同一原则）。
   * 因此 auto ⇒ 字段缺失，而非 0。
   *
   * 存在理由：计划书 §四 要求采集「元素坐标、尺寸、**层级**」，而层级信息是
   * 判断「吸顶导航盖住 hero」这类还原失真的直接依据。
   */
  zIndex?: number;
  /** Text block alignment within the section. */
  alignment: 'left' | 'center' | 'right';
  /** Whether this section spans the full viewport width (edge-to-edge). */
  fullBleed: boolean;
}

// ---------------------------------------------------------------------------
// Metadata — 计划书 Phase 3「metadata」
// ---------------------------------------------------------------------------

/** Document metadata harvested from the page `<head>`. */
export interface PageMetadata {
  /** `<title>` text. */
  title?: string;
  /** `<meta name="description">` content. */
  description?: string;
  /** `<html lang>` value. */
  language?: string;
  /** Text directionality. */
  dir?: 'ltr' | 'rtl';
  /** Favicon URL. */
  favicon?: string;
  /** Open Graph fields (`og:title`, `og:image`, …) keyed without the `og:` prefix. */
  openGraph?: Record<string, string>;
  /** Canonical link URL. */
  canonical?: string;
  /** Detected brand / site name, when distinguishable from the page title. */
  brand?: string;
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
 * Populated by the Vision Agent during Phase 4.
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
// Animations — 计划书 Phase 6 的上游输入
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
  /**
   * Properties actually animated — the single most important field for
   * GSAP translation, since it decides whether an effect is transform-based
   * (cheap, GPU-friendly) or layout-based (expensive).
   */
  properties?: string[];
  /** Delay applied before the animation starts. */
  delay?: string;
  /** Whether the animation repeats indefinitely. */
  infinite?: boolean;
  /** Whether the effect could not be attributed to a stable selector. */
  uncertain?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Current schema version — bump on any breaking change to {@link WebsitePackage}.
 *
 * 1.3.0：`LayoutBlock` 新增可选字段 `zIndex`（实测层叠层级，`auto` ⇒ 缺失）。
 * 1.2.0（Phase 2 Sprint A）：`LayoutBlock` 新增可选字段 `heightPx`（实测像素高度）。
 * 1.1.0（Phase 1 Sprint 3）：新增可选字段 `interaction`。
 * 均属 minor —— 老数据反序列化后该字段为 `undefined`，既有消费方不受影响。
 */
export const WEBSITE_PACKAGE_VERSION = '1.3.0';

/**
 * Create a fully-populated skeleton package.
 *
 * Every Agent starts from this shape so downstream consumers never have to
 * guard against missing top-level keys.
 */
export function createEmptyPackage(url: string): WebsitePackage {
  // ⚠️ 刻意**不写** `interaction` 字段。
  // 见 WebsitePackage.interaction 的注释：缺失必须是 `undefined`，
  // 填 `createEmptyInteraction()` 会让模型看到空占位符并可能自行补全。
  return {
    url,
    capturedAt: new Date().toISOString(),
    version: WEBSITE_PACKAGE_VERSION,
    screenshots: [],
    assets: [],
    dom: {
      pageType: 'unknown',
      sections: [],
      layout: 'block',
      responsive: false,
      structure: '',
    },
    styles: {
      colors: [],
      fonts: [],
      spacing: {
        base: '4px',
        scale: [],
        containerMaxWidth: '1200px',
        sectionPadding: '80px',
      },
      shadows: [],
      borderRadius: [],
      transitions: [],
      cssVariables: {},
    },
    layout: {
      flow: [],
      breakpoints: [],
      gridColumns: 0,
      stickyHeader: false,
      centered: true,
    },
    design: {
      style: 'unknown',
      brand: '',
      visualLanguage: '',
      colorPalette: {},
      typography: {},
      spacingScale: [],
      componentPatterns: [],
      animationStyle: '',
    },
    components: {
      tree: [],
      files: [],
      totalComponents: 0,
    },
    animations: [],
    metadata: {},
  };
}
