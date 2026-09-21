/**
 * Browser Intelligence Layer — Public API
 *
 * Phase 1 把「静态抓取」升级为「动态理解」。
 * 接口契约见 ./types.ts，设计方案见 docs/phase1-browser-intelligence.md。
 */

export type {
  BrowserManagerOptions,
  BrowserSession,
  ChangeRecord,
  ChangeType,
  ClickEvent,
  ClickSafetyPolicy,
  ClickTarget,
  ClickTargetKind,
  DetectedElement,
  ElementSnapshot,
  ElementType,
  InteractionAnimation,
  InteractionEvent,
  InteractionExport,
  InteractionMeta,
  InteractionPackage,
  PageController,
  PageState,
  RecoveryStrategy,
  RiskLevel,
  ScreenshotOptions,
  ScrollEvent,
  ScrollExplorerOptions,
  ScrollViewport,
  StateSnapshot,
  StateScreenshot,
  StateTrigger,
} from './types';
export { DEFAULT_CLICK_SAFETY, createEmptyInteraction, RISK } from './types';

export { openBrowserSession, adaptPuppeteerPage } from './browser-manager';
export { computeScrollSteps, exploreScroll } from './scroll-explorer';
export type { ScrollStep, ScrollExplorationResult } from './scroll-explorer';
export { buildStatesFromScrolls, buildInteractionFromScrolls, appendState } from './state-capture';
export { explorePageScroll } from './page-explorer';
export type { ExplorePageOptions } from './page-explorer';

// Sprint 2 — Interaction Explorer Layer
export {
  ELEMENT_SCAN_SCRIPT,
  buildSelector,
  inferElementType,
  normalizeElements,
  rankElements,
} from './element-detector';
export type { RawElement } from './element-detector';
export { classifyElement, isClickable, selectClickTargets, suggestRecovery } from './interaction-policy';
export {
  DIFF_THRESHOLDS,
  diffStates,
  extractAnimatedProperties,
  hasMeaningfulChange,
  summarizeChanges,
} from './state-diff';
export { exploreClicks } from './click-explorer';
export type { ClickExplorerOptions, ClickExplorationResult } from './click-explorer';
export {
  buildAnimations,
  buildBasePackage,
  collectAnimatedProperties,
  mergeClicks,
  serializeInteraction,
  toInteractionExport,
} from './interaction-recorder';
export { explorePageInteraction } from './interaction-explorer';
export type { ExploreInteractionOptions, InteractionExplorationResult } from './interaction-explorer';

// Sprint 3 — 带缓存的采集入口（planning/code/animation 共用一次采集）
export {
  getInteractionPackage,
  isInteractionCaptureEnabled,
  resetInteractionCache,
  interactionCacheSize,
} from './interaction-cache';
export type { InteractionCaptureOptions } from './interaction-cache';

// Phase 2 Sprint A — 布局实测（把 layout.flow 从硬编码常量换成真实几何）
export {
  DEFAULT_FULL_BLEED_RATIO,
  DEFAULT_MAX_SECTIONS,
  DEFAULT_MIN_SECTION_HEIGHT,
  DEFAULT_ROW_TOLERANCE,
  buildLayoutResult,
  countColumns,
  filterSections,
  inferSectionRole,
  normalizeAlignment,
  probeLayout,
} from './layout-probe';
export type {
  LayoutProbeOptions,
  LayoutProbeResult,
  RawLayoutProbe,
  RawSection,
} from './layout-probe';
export {
  getLayoutProbe,
  isLayoutProbeEnabled,
  layoutCacheSize,
  resetLayoutCache,
} from './layout-cache';
export type { LayoutCaptureOptions } from './layout-cache';
