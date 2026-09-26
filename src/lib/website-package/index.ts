/**
 * Website Intelligence Package — Public API
 * ===================================================================
 * Phase 3 中间层的统一入口：
 *
 *   buildWebsitePackage(scraped)  →  WebsitePackage
 *   formatPackageContext(pkg)     →  Agent 提示词
 */

export { buildWebsitePackage } from './adapter';
export type { BuildPackageInput } from './adapter';

/** 截图入包（P1-06 / P1-10）：base64 → 契约合法的 ScreenshotData（宽高真解析，不猜）。 */
export { decodeScreenshotDataUrl, MAX_SCREENSHOT_BASE64_CHARS } from './screenshot';

/** 步骤级数据包闸门（C2 / P1-16 / P1-18）：拒绝违约包、显著告警空壳包。 */
export { gatePackageForStep, packageForPrompt } from './guard';
export type { PackageGateResult, PackageGateStep } from './guard';

/** 落盘归档（P1-10 / S-03 / P1-14）：runs/<jobId>/website-package/ 目录标准。 */
export {
  archiveWebsitePackage,
  archivePackageIfEnabled,
  isPackageArchiveEnabled,
  archiveRoot,
  sanitizeJobId,
  parseDataUrl,
} from './archive';
export type { ArchiveOptions, ArchiveResult } from './archive';

/** 交互产物 → InteractionPackage 的归一化入口（Agent 不直接读 interaction.json）。 */
export { buildInteractionPackage, RESTORED_FROM_EXPORT } from './interaction-adapter';

export {
  formatPackageContext,
  formatPackageContextCompact,
  formatInteractionContext,
} from './formatter';
export type { InteractionContextLevel } from './formatter';

export {
  WEBSITE_PACKAGE_VERSION,
  createEmptyPackage,
} from '@/types/website-package';
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
