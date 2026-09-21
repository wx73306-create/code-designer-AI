/**
 * diff/assets — 第三层：资源密度 diff
 * ===================================================================
 * Phase 2 / Sprint B Step 4。纯函数，不碰浏览器。
 *
 * 还原度不只是布局和颜色：「原站有 12 张图、生成页一张都没有」
 * 是最常见的低还原形态之一。这里只数数量与首屏有无媒体，不做更深的判断。
 */

import type { AssetDiff } from '@/types/reconstruction';
import { pairwiseRatio } from './style-diff';

/** 浏览器侧 collectAssets() 的产出形状（Step 5 实现）。 */
export interface RawAssets {
  imgCount: number;
  bgImageCount: number;
  svgCount: number;
  videoCount: number;
  /** 首屏（900px 内）媒体元素数。 */
  heroMediaCount: number;
}

/** 全部媒体元素（img / 背景图 / svg / video）计入同一口径。 */
function totalMedia(assets: RawAssets): number {
  return assets.imgCount + assets.bgImageCount + assets.svgCount + assets.videoCount;
}

export function diffAssets(original: RawAssets, clone: RawAssets): AssetDiff {
  const originalImageCount = totalMedia(original);
  const cloneImageCount = totalMedia(clone);

  return {
    originalImageCount,
    cloneImageCount,
    ratio: pairwiseRatio(originalImageCount, cloneImageCount),
    heroHasMediaOriginal: original.heroMediaCount > 0,
    heroHasMediaClone: clone.heroMediaCount > 0,
  };
}
