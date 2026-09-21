/**
 * diff/style — 第二层：视觉 token diff（color / font / spacing / radius / shadow）
 * ===================================================================
 * Phase 2 / Sprint B Step 4。纯函数，不碰浏览器。
 *
 * ## 输入契约
 *
 * `RawStyleTokens` 是**浏览器侧采集的原始计算值**（Step 5 的
 * `collectStyleTokens()` 负责产出），本模块不做任何语义判断之外的事——
 * 「哪个是主色」这类判断在 Node 侧做（与 Sprint A 的分层原则一致）。
 *
 * ## 缺失值语义（与「unknown 不是 guess」同源）
 *
 * - 某个 token **两边都缺** → 视为一致（距离 0 / ratio 1），不罚分
 * - 某个 token **只缺一边** → 视为不一致（距离 1 / ratio 0），罚满
 * - 绝不用猜测值补齐
 */

import type { ColorDelta, StyleTokenDiff } from '@/types/reconstruction';

// ---------------------------------------------------------------------------
// 采集契约（浏览器侧 collectStyleTokens 的产出形状）
// ---------------------------------------------------------------------------

export interface RawStyleTokens {
  /** getComputedStyle(body).backgroundColor，"rgb(r, g, b)" 形式。 */
  bodyBackground: string;
  bodyColor: string;
  /** 按可见面积排序的元素背景色（不含透明），最多 8 个。 */
  colorHistogram: Array<{ color: string; area: number }>;
  bodyFontSizePx: number;
  bodyFontFamily: string;
  headingFontSizePx?: number;
  /** 相邻可见区块之间的垂直间距（px）样本。 */
  sectionGaps: number[];
  /** 顶层容器水平内边距（px）样本。 */
  containerPaddings: number[];
  /** 可见元素 border-radius（px）样本，0 也算。 */
  radii: number[];
  visibleElementCount: number;
  shadowedElementCount: number;
}

// ---------------------------------------------------------------------------
// 颜色工具
// ---------------------------------------------------------------------------

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** 解析 "rgb(r, g, b)" / "rgba(r, g, b, a)"。解析失败返回 null。 */
export function parseRgb(value: string): Rgb | null {
  const match = /rgba?\(([^)]+)\)/.exec(value);
  if (!match) return null;
  const parts = match[1].split(',').map((p) => Number.parseFloat(p.trim()));
  if (parts.length < 3 || parts.some((p) => Number.isNaN(p))) return null;
  const [r, g, b] = parts;
  // alpha < 1 视为不可靠的背景（透出了别的东西），交给调用方按需处理
  if (parts.length >= 4 && parts[3] < 0.5) return null;
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
}

function clamp255(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)));
}

/**
 * 感知加权色距，归一化到 0-1。
 * 权重来自人眼对亮度的敏感度（ITU-R BT.601），比朴素欧氏距离更接近「看起来差多少」。
 */
export function colorDistance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const weighted = Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);
  return Math.min(1, weighted / 255);
}

function colorDelta(original: string, clone: string): ColorDelta | undefined {
  const o = parseRgb(original);
  const c = parseRgb(clone);
  if (!o || !c) return undefined;
  return { original, clone, distance: colorDistance(o, c) };
}

/**
 * 从可见面积直方图中挑主色。
 *
 * 排除：背景色、正文色、灰度色（|r-g|<12 且 |g-b|<12 且 |r-b|<12）。
 * 「主色」是语义判断，所以这个函数在 Node 侧、接收采集好的直方图。
 */
export function pickPrimaryColor(
  histogram: Array<{ color: string; area: number }>,
  background: string,
  text: string,
): string | undefined {
  const bgColor = parseRgb(background);
  const textColor = parseRgb(text);

  for (const entry of histogram) {
    const rgb = parseRgb(entry.color);
    if (!rgb) continue;
    if (isGray(rgb)) continue;
    if (bgColor && colorDistance(rgb, bgColor) < 0.1) continue;
    if (textColor && colorDistance(rgb, textColor) < 0.1) continue;
    return entry.color;
  }
  return undefined;
}

function isGray(rgb: Rgb): boolean {
  return Math.abs(rgb.r - rgb.g) < 12 && Math.abs(rgb.g - rgb.b) < 12 && Math.abs(rgb.r - rgb.b) < 12;
}

// ---------------------------------------------------------------------------
// 数值工具
// ---------------------------------------------------------------------------

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** min/max；两者都 ≤ 0 视为一致（1）。 */
export function pairwiseRatio(original: number, clone: number): number {
  if (original <= 0 && clone <= 0) return 1;
  if (original <= 0 || clone <= 0) return 0;
  return Math.min(original, clone) / Math.max(original, clone);
}

/** 字体族列表 → 归一化集合（去引号、小写）。 */
function parseFontFamilies(value: string): Set<string> {
  return new Set(
    value
      .split(',')
      .map((f) => f.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
      .filter((f) => f.length > 0),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

export function diffStyleTokens(original: RawStyleTokens, clone: RawStyleTokens): StyleTokenDiff {
  const diff: StyleTokenDiff = {};

  // ---- color ----
  const background = colorDelta(original.bodyBackground, clone.bodyBackground);
  if (background) diff.background = background;

  const text = colorDelta(original.bodyColor, clone.bodyColor);
  if (text) diff.text = text;

  const primaryOriginal = pickPrimaryColor(original.colorHistogram, original.bodyBackground, original.bodyColor);
  const primaryClone = pickPrimaryColor(clone.colorHistogram, clone.bodyBackground, clone.bodyColor);
  if (primaryOriginal && primaryClone) {
    diff.primary = colorDelta(primaryOriginal, primaryClone);
  } else if (primaryOriginal || primaryClone) {
    // 一边有主色一边没有 —— 这是真实的不一致，罚满
    diff.primary = {
      original: primaryOriginal ?? 'none',
      clone: primaryClone ?? 'none',
      distance: 1,
    };
  }
  // 两边都没有主色（纯黑白页面）→ 一致，不产出字段

  // ---- font ----
  const originalFontPx = original.headingFontSizePx ?? original.bodyFontSizePx;
  const cloneFontPx = clone.headingFontSizePx ?? clone.bodyFontSizePx;
  if (originalFontPx > 0 && cloneFontPx > 0) {
    diff.fontSizeRatio = cloneFontPx / originalFontPx;
  }
  diff.fontFamilyOverlap = jaccard(parseFontFamilies(original.bodyFontFamily), parseFontFamilies(clone.bodyFontFamily));

  // ---- spacing ----
  const originalGap = median(original.sectionGaps);
  const cloneGap = median(clone.sectionGaps);
  if (originalGap > 0 || cloneGap > 0) {
    diff.sectionGap = { original: originalGap, clone: cloneGap, ratio: pairwiseRatio(originalGap, cloneGap) };
  }
  const originalPadding = median(original.containerPaddings);
  const clonePadding = median(clone.containerPaddings);
  if (originalPadding > 0 || clonePadding > 0) {
    diff.containerPadding = {
      original: originalPadding,
      clone: clonePadding,
      ratio: pairwiseRatio(originalPadding, clonePadding),
    };
  }

  // ---- radius ----
  const originalRadius = median(original.radii);
  const cloneRadius = median(clone.radii);
  if (originalRadius > 0 || cloneRadius > 0) {
    diff.radius = { original: originalRadius, clone: cloneRadius, ratio: pairwiseRatio(originalRadius, cloneRadius) };
  }

  // ---- shadow ----
  const originalCoverage =
    original.visibleElementCount > 0 ? original.shadowedElementCount / original.visibleElementCount : 0;
  const cloneCoverage =
    clone.visibleElementCount > 0 ? clone.shadowedElementCount / clone.visibleElementCount : 0;
  if (originalCoverage > 0 || cloneCoverage > 0) {
    diff.shadowCoverage = {
      original: originalCoverage,
      clone: cloneCoverage,
      delta: cloneCoverage - originalCoverage,
    };
  }

  return diff;
}
