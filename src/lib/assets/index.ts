/**
 * 资源本地化模块出口（P2-03）
 */
export {
  DEFAULT_LIMITS,
  applyLocalPaths,
  buildPlaceholderSvg,
  isAssetLocalizeEnabled,
  localizeAssets,
  localizePackageAssetsIfEnabled,
  summarizeLocalize,
  type AssetLimits,
  type AssetStatus,
  type LocalizeOptions,
  type LocalizeResult,
  type LocalizedAsset,
} from './localize';

export { assetTypeFromMime, parseImageSize, type ParsedImageSize } from './image-size';
