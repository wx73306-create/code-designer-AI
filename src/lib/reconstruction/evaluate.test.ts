/**
 * composeReconstructionScore 单测 —— null 语义（unknown 不是 guess）
 *
 * 这里是 Sprint B 三条硬约定的**执行处**：
 *   1. 渲染降级 → null（不是 20 分）
 *   2. clone 指纹采不到 → null
 *   3. 原站真值缺失 → null（不做部分计分）
 */

import { describe, expect, it } from 'vitest';

import { composeReconstructionScore, type SideFingerprints } from './evaluate';
import type { RawAssets } from '@/lib/diff/asset-diff';
import type { RawStyleTokens } from '@/lib/diff/style-diff';
import type { LayoutBlock } from '@/types/website-package';
import type { LayoutProbeResult } from '@/lib/browser-intelligence/layout-probe';

function probe(flow: LayoutBlock[]): LayoutProbeResult {
  return {
    flow,
    gridColumns: 0,
    stickyHeader: false,
    centered: false,
    viewport: { width: 1440, height: 900 },
    docHeight: 6000,
  };
}

const LAYOUT: LayoutProbeResult = probe([
  {
    role: 'hero',
    heightWeight: 40,
    heightPx: 2400,
    columns: 1,
    alignment: 'left',
    fullBleed: true,
  },
  {
    role: 'footer',
    heightWeight: 20,
    heightPx: 1200,
    columns: 1,
    alignment: 'center',
    fullBleed: true,
  },
]);

const TOKENS: RawStyleTokens = {
  bodyBackground: 'rgb(255, 255, 255)',
  bodyColor: 'rgb(29, 29, 31)',
  colorHistogram: [{ color: 'rgb(0, 113, 227)', area: 50000 }],
  bodyFontSizePx: 17,
  bodyFontFamily: '-apple-system, sans-serif',
  sectionGaps: [80, 96],
  containerPaddings: [24, 32],
  radii: [12, 16],
  visibleElementCount: 200,
  shadowedElementCount: 10,
};

const ASSETS: RawAssets = {
  imgCount: 10,
  bgImageCount: 2,
  svgCount: 4,
  videoCount: 0,
  heroMediaCount: 2,
};

const SIDE: SideFingerprints = { layout: LAYOUT, tokens: TOKENS, assets: ASSETS };

describe('composeReconstructionScore — 成功路径', () => {
  it('两侧完全一致 → 100 分并带完整报告', () => {
    const r = composeReconstructionScore({
      renderStatus: 'success',
      original: SIDE,
      clone: SIDE,
      evaluatedAt: '2026-09-20T00:00:00.000Z',
    });

    expect(r.score).toBe(100);
    expect(r.dimensions).not.toBeNull();
    expect(r.report).toBeDefined();
    expect(r.report?.layout.items.every((i) => i.status === 'matched')).toBe(true);
    expect(r.evaluatedAt).toBe('2026-09-20T00:00:00.000Z');
  });
});

describe('composeReconstructionScore — null 语义', () => {
  it('渲染 degraded（Tailwind CDN 没加载）→ null，不是低分', () => {
    const r = composeReconstructionScore({
      renderStatus: 'degraded',
      renderReason: 'tailwind-cdn-unavailable',
      // 即使两侧指纹都在，也不能产分
      original: SIDE,
      clone: SIDE,
    });

    expect(r.score).toBeNull();
    expect(r.dimensions).toBeNull();
    expect(r.report).toBeUndefined();
    expect(r.reason).toBe('tailwind-cdn-unavailable');
  });

  it('渲染 failed → null', () => {
    const r = composeReconstructionScore({
      renderStatus: 'failed',
      renderReason: 'empty-document',
      original: SIDE,
      clone: SIDE,
    });

    expect(r.score).toBeNull();
    expect(r.reason).toBe('empty-document');
  });

  it('clone 指纹采不到 → null', () => {
    const r = composeReconstructionScore({
      renderStatus: 'success',
      original: SIDE,
      clone: null,
    });

    expect(r.score).toBeNull();
    expect(r.reason).toBe('render-error');
  });

  it('原站真值缺失 → null（不做部分计分）', () => {
    const r = composeReconstructionScore({
      renderStatus: 'success',
      original: null,
      clone: SIDE,
    });

    expect(r.score).toBeNull();
    expect(r.dimensions).toBeNull();
    expect(r.reason).toBe('original-layout-unavailable');
    // 关键：不能拿 style/asset diff 单独凑出一个数
    expect(r.report).toBeUndefined();
  });
});
