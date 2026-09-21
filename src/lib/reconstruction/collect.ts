/**
 * Reconstruction — 浏览器侧采集器
 * ===================================================================
 * Phase 2 / Sprint B Step 5。把渲染好的 clone 页面变成 diff 层的三份输入：
 *   布局真值（复用 Sprint A 的 probeLayout，与原站同一把尺子）
 *   视觉 token（RawStyleTokens）
 *   资源计数（RawAssets）
 *
 * ## 分层原则（与 Sprint A 一致）
 *
 * 浏览器内的函数**只采集计算值，不做语义判断**：
 * 「哪个是主色」「间距算不算大」这类判断全部在 Node 侧的 diff 层。
 * 浏览器函数体内不得引用任何外部变量（page.evaluate 序列化会炸），
 * 所以常量全部内联。
 *
 * ## evaluate-only 适配器
 *
 * `probeLayout()` 需要一个 `PageController`（5 方法窄接口），但 diff 只用得到
 * `evaluate`。这里做一个诚实命名的适配器，其余方法 no-op ——
 * 这样 **browser-intelligence 目录零改动**（连 collectGeometry 的 export 都不用加）。
 */

import type { Page } from 'puppeteer-core';

import { probeLayout } from '@/lib/browser-intelligence/layout-probe';
import type { LayoutProbeResult } from '@/lib/browser-intelligence/layout-probe';
import type { PageController } from '@/lib/browser-intelligence/types';
import type { RawAssets } from '@/lib/diff/asset-diff';
import type { RawStyleTokens } from '@/lib/diff/style-diff';

// ---------------------------------------------------------------------------
// clone 侧三份输入
// ---------------------------------------------------------------------------

/**
 * 只需要 `evaluate` 就能采集的页面。
 *
 * puppeteer 的真实 Page 与原站会话的 PageController 都满足它 ——
 * 但两者类型不互通，所以统一走这个最小契约（而非直接要 puppeteer Page）。
 */
export interface EvaluatablePage {
  evaluate<T>(fn: string | (() => T)): Promise<T>;
}

/** 在渲染好的 clone 页面上实测布局（与原站同一套 Sprint A 算法）。 */
export function readCloneLayout(page: Page): Promise<LayoutProbeResult> {
  return probeLayout(toEvaluateOnlyController(page));
}

export function readStyleTokens(page: EvaluatablePage): Promise<RawStyleTokens> {
  return page.evaluate(collectStyleTokens);
}

export function readAssets(page: EvaluatablePage): Promise<RawAssets> {
  return page.evaluate(collectAssets);
}

// ---------------------------------------------------------------------------
// evaluate-only 适配器
// ---------------------------------------------------------------------------

export function toEvaluateOnlyController(page: Page): PageController {
  return {
    url: page.url(),
    goto: async () => {
      throw new Error('evaluate-only controller：probeLayout 不需要 goto');
    },
    evaluate: async <T,>(fn: string | (() => T)) => {
      if (typeof fn === 'string') {
        return (await page.evaluate(fn)) as T;
      }
      return await page.evaluate(fn);
    },
    screenshot: async () => '',
    setViewport: async () => {},
    close: async () => {},
  };
}

// ---------------------------------------------------------------------------
// 浏览器内函数 —— 常量内联，不引用外部变量
// ---------------------------------------------------------------------------

function collectStyleTokens(): RawStyleTokens {
  const MAX_ELEMENTS = 400;
  const MIN_VISIBLE_AREA = 4; // px²，过滤零尺寸元素
  const TRANSPARENT = 'rgba(0, 0, 0, 0)';

  const bodyStyle = document.body ? window.getComputedStyle(document.body) : null;
  const bodyBackground = bodyStyle ? bodyStyle.backgroundColor : 'rgb(255, 255, 255)';
  const bodyColor = bodyStyle ? bodyStyle.color : 'rgb(0, 0, 0)';
  const bodyFontSizePx = bodyStyle ? Number.parseFloat(bodyStyle.fontSize) || 0 : 0;
  const bodyFontFamily = bodyStyle ? bodyStyle.fontFamily : '';

  let headingFontSizePx: number | undefined;
  const heading = document.querySelector('h1, h2');
  if (heading) {
    const px = Number.parseFloat(window.getComputedStyle(heading).fontSize);
    if (!Number.isNaN(px) && px > 0) headingFontSizePx = px;
  }

  // 遍历可见元素：背景色按面积统计 / 圆角样本 / 阴影计数
  const areaByColor = new Map<string, number>();
  const radii: number[] = [];
  let visibleElementCount = 0;
  let shadowedElementCount = 0;
  const all = document.body ? Array.from(document.body.querySelectorAll('*')) : [];
  for (let i = 0; i < all.length && i < MAX_ELEMENTS; i++) {
    const el = all[i];
    const rect = el.getBoundingClientRect();
    if (rect.width * rect.height < MIN_VISIBLE_AREA) continue;
    visibleElementCount++;

    const style = window.getComputedStyle(el);
    if (style.backgroundColor && style.backgroundColor !== TRANSPARENT) {
      areaByColor.set(style.backgroundColor, (areaByColor.get(style.backgroundColor) ?? 0) + rect.width * rect.height);
    }
    const radius = Number.parseFloat(style.borderTopLeftRadius);
    if (!Number.isNaN(radius)) radii.push(radius);
    if (style.boxShadow && style.boxShadow !== 'none') shadowedElementCount++;
  }

  const colorHistogram = Array.from(areaByColor.entries())
    .map(([color, area]) => ({ color, area }))
    .sort((a, b) => b.area - a.area)
    .slice(0, 8);

  // section 间距：body / main 直接子元素的相邻垂直间距
  const boxes: Array<{ top: number; bottom: number }> = [];
  const containers: Element[] = [];
  if (document.body) containers.push(document.body);
  const main = document.querySelector('main');
  if (main) containers.push(main);
  for (const container of containers) {
    for (let i = 0; i < container.children.length; i++) {
      const rect = container.children[i].getBoundingClientRect();
      if (rect.height < 8) continue; // 忽略占位/隐藏块
      boxes.push({ top: rect.top, bottom: rect.bottom });
    }
  }
  boxes.sort((a, b) => a.top - b.top);
  const sectionGaps: number[] = [];
  for (let i = 1; i < boxes.length; i++) {
    const gap = boxes[i].top - boxes[i - 1].bottom;
    if (gap > 0) sectionGaps.push(gap);
  }

  const containerPaddings: number[] = [];
  for (let i = 0; i < all.length && i < 60; i++) {
    const pl = Number.parseFloat(window.getComputedStyle(all[i]).paddingLeft);
    if (!Number.isNaN(pl) && pl > 0) containerPaddings.push(pl);
  }

  return {
    bodyBackground,
    bodyColor,
    colorHistogram,
    bodyFontSizePx,
    bodyFontFamily,
    headingFontSizePx,
    sectionGaps,
    containerPaddings,
    radii,
    visibleElementCount,
    shadowedElementCount,
  };
}

function collectAssets(): RawAssets {
  const MAX_ELEMENTS = 400;

  const imgCount = document.images.length;
  const svgCount = document.querySelectorAll('svg').length;
  const videoCount = document.querySelectorAll('video').length;

  let bgImageCount = 0;
  let heroMediaCount = 0;
  const heroLimit = window.innerHeight || 900;
  const scrollY = window.scrollY || 0;

  const all = document.body ? Array.from(document.body.querySelectorAll('*')) : [];
  for (let i = 0; i < all.length && i < MAX_ELEMENTS; i++) {
    const el = all[i];
    const style = window.getComputedStyle(el);
    const hasBg = Boolean(style.backgroundImage) && style.backgroundImage !== 'none';
    if (hasBg) bgImageCount++;

    const rect = el.getBoundingClientRect();
    const inHero = rect.height > 0 && rect.top + scrollY < heroLimit;
    if (!inHero) continue;
    if (el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'SVG' || hasBg) {
      heroMediaCount++;
    }
  }

  return { imgCount, bgImageCount, svgCount, videoCount, heroMediaCount };
}
