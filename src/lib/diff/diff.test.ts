/**
 * diff 层单测 — 冻结文档 §6 Step 4 的 10 条 PASS 判据 + 边界语义
 *
 * 判据核心：每一个破坏都必须能**被独立检出**（维度分显著下降），
 * 并且能在 notes 里**读到一句人话**（可解释性硬要求）。
 */

import { describe, expect, it } from 'vitest';

import { diffLayout } from './layout-diff';
import { diffStyleTokens, parseRgb, pickPrimaryColor, pairwiseRatio, type RawStyleTokens } from './style-diff';
import { diffAssets, type RawAssets } from './asset-diff';
import { computeReconstructionScore, RECONSTRUCTION_WEIGHTS } from './score';
import type { LayoutBlock } from '@/types/website-package';
import type { LayoutProbeResult } from '@/lib/browser-intelligence/layout-probe';
import type { SectionRole } from '@/types/website-package';

// ---------------------------------------------------------------------------
// Fixtures —— 一张「Apple 式」标准页面
// ---------------------------------------------------------------------------

function block(overrides: Partial<LayoutBlock> & { role: SectionRole }): LayoutBlock {
  return {
    heightWeight: 25,
    heightPx: 1500,
    columns: 1,
    alignment: 'left',
    fullBleed: true,
    ...overrides,
  };
}

function layoutResult(flow: LayoutBlock[], docHeight = 6000): LayoutProbeResult {
  return {
    flow,
    gridColumns: 0,
    stickyHeader: false,
    centered: false,
    viewport: { width: 1440, height: 900 },
    docHeight,
  };
}

const STANDARD_FLOW: LayoutBlock[] = [
  block({ role: 'hero', heightWeight: 40, heightPx: 2400 }),
  block({ role: 'content', heightWeight: 40, heightPx: 2400, columns: 3 }),
  block({ role: 'footer', heightWeight: 20, heightPx: 1200, alignment: 'center' }),
];

function styleTokens(overrides: Partial<RawStyleTokens> = {}): RawStyleTokens {
  return {
    bodyBackground: 'rgb(255, 255, 255)',
    bodyColor: 'rgb(29, 29, 31)',
    colorHistogram: [
      { color: 'rgb(0, 113, 227)', area: 50000 },
      { color: 'rgb(245, 245, 247)', area: 30000 },
    ],
    bodyFontSizePx: 17,
    bodyFontFamily: '-apple-system, "Segoe UI", sans-serif',
    headingFontSizePx: 56,
    sectionGaps: [80, 96, 88],
    containerPaddings: [24, 24, 32],
    radii: [12, 16, 0, 8],
    visibleElementCount: 200,
    shadowedElementCount: 10,
    ...overrides,
  };
}

const STANDARD_ASSETS: RawAssets = {
  imgCount: 10,
  bgImageCount: 2,
  svgCount: 4,
  videoCount: 0,
  heroMediaCount: 2,
};

function scoreAll(
  originalFlow = STANDARD_FLOW,
  cloneFlow = STANDARD_FLOW,
  originalStyle = styleTokens(),
  cloneStyle = styleTokens(),
  originalAssets = STANDARD_ASSETS,
  cloneAssets = STANDARD_ASSETS,
) {
  const layout = diffLayout(layoutResult(originalFlow), layoutResult(cloneFlow));
  const style = diffStyleTokens(originalStyle, cloneStyle);
  const assets = diffAssets(originalAssets, cloneAssets);
  const evaluation = computeReconstructionScore({ layout, style, assets });
  return { layout, style, assets, ...evaluation };
}

// ---------------------------------------------------------------------------
// 权重与基线
// ---------------------------------------------------------------------------

describe('权重', () => {
  it('九维权重合计 1.00', () => {
    const sum = Object.values(RECONSTRUCTION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });
});

describe('判据 1：完全相同的输入 → score 100', () => {
  it('每一维都是满分', () => {
    const r = scoreAll();
    expect(r.score).toBe(100);
    for (const [dim, value] of Object.entries(r.dimensions)) {
      expect(value, `${dim} 应为 100`).toBe(100);
    }
    expect(r.notes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 布局层
// ---------------------------------------------------------------------------

describe('判据 2：删掉一个 section → missing + score 下降 ≥ 10', () => {
  it('content 被删，其余区块按真实占比重新分配', () => {
    // 现实中删掉 content 后，hero/footer 会吃掉它的空间（权重重新归一化）
    const cloneFlow = [
      block({ role: 'hero', heightWeight: 67, heightPx: 4020 }),
      block({ role: 'footer', heightWeight: 33, heightPx: 1980, alignment: 'center' }),
    ];
    const r = scoreAll(STANDARD_FLOW, cloneFlow);

    const missing = r.layout.items.find((i) => i.role === 'content');
    expect(missing?.status).toBe('missing');
    expect(r.dimensions.roleSequence).toBe(80); // 2*2/(3+2)
    expect(r.score).toBeLessThanOrEqual(90); // 100 - ≥10
    expect(r.notes).toContain('content missing');
  });
});

describe('LCS 对齐语义', () => {
  it('中间多出的区块标 extra，其余区块不被错配', () => {
    const cloneFlow = [
      block({ role: 'hero', heightWeight: 40, heightPx: 2400 }),
      block({ role: 'feature', heightWeight: 20, heightPx: 1200 }),
      block({ role: 'content', heightWeight: 20, heightPx: 1200, columns: 3 }),
      block({ role: 'footer', heightWeight: 20, heightPx: 1200, alignment: 'center' }),
    ];
    const layout = diffLayout(layoutResult(STANDARD_FLOW), layoutResult(cloneFlow));

    expect(layout.items.find((i) => i.role === 'feature')?.status).toBe('extra');
    for (const role of ['hero', 'content', 'footer'] as const) {
      expect(layout.items.find((i) => i.role === role)?.status).toBe('matched');
    }
    expect(layout.roleSequenceCoverage).toBeCloseTo((2 * 3) / 7, 9);
  });

  it('同名 role（两个 content）按出现顺序配对', () => {
    const originalFlow = [
      block({ role: 'hero' }),
      block({ role: 'content', heightPx: 1000 }),
      block({ role: 'content', heightPx: 2000 }),
      block({ role: 'footer', alignment: 'center' }),
    ];
    const cloneFlow = [
      block({ role: 'hero' }),
      block({ role: 'content', heightPx: 1100 }),
      block({ role: 'content', heightPx: 1900 }),
      block({ role: 'footer', alignment: 'center' }),
    ];
    const layout = diffLayout(layoutResult(originalFlow), layoutResult(cloneFlow));
    const contents = layout.items.filter((i) => i.role === 'content' && i.status === 'matched');
    expect(contents).toHaveLength(2);
    // 顺序不串：第一个 matched 对应原站第一个 content
    expect(contents[0].originalIndex).toBe(1);
    expect(contents[0].cloneIndex).toBe(1);
    expect(contents[1].originalIndex).toBe(2);
    expect(contents[1].cloneIndex).toBe(2);
  });
});

describe('判据 3：hero 高度改为 1/3 → heightProfile 显著下降', () => {
  it('高度占比距离拉大，并产出人话标签', () => {
    const cloneFlow = [
      block({ role: 'hero', heightWeight: 13, heightPx: 800 }),
      block({ role: 'content', heightWeight: 46, heightPx: 2760, columns: 3 }),
      block({ role: 'footer', heightWeight: 23, heightPx: 1380, alignment: 'center' }),
    ];
    const r = scoreAll(STANDARD_FLOW, cloneFlow);

    expect(r.dimensions.heightProfile).toBeLessThanOrEqual(70);
    expect(r.notes).toContain('hero height -67%');
  });
});

// ---------------------------------------------------------------------------
// 视觉 token 层
// ---------------------------------------------------------------------------

describe('判据 4：主色改为紫色 → colorTokens 显著下降', () => {
  it('primary 色距被检出', () => {
    const cloneStyle = styleTokens({
      colorHistogram: [{ color: 'rgb(128, 0, 255)', area: 50000 }],
    });
    const r = scoreAll(STANDARD_FLOW, STANDARD_FLOW, styleTokens(), cloneStyle);

    expect(r.style.primary).toBeDefined();
    expect(r.style.primary!.distance).toBeGreaterThan(0.2);
    expect(r.dimensions.colorTokens).toBeLessThanOrEqual(92);
    expect(r.notes).toContain('-color mismatch (primary)');
  });
});

describe('判据 5：字号整体 ×2 → typography 显著下降', () => {
  it('字号比例与字体族分别计分', () => {
    const cloneStyle = styleTokens({ headingFontSizePx: 112 });
    const r = scoreAll(STANDARD_FLOW, STANDARD_FLOW, styleTokens(), cloneStyle);

    // 契约：fontSizeRatio = clone / original，所以「×2」是 2 而不是 0.5
    expect(r.style.fontSizeRatio).toBeCloseTo(2, 9);
    // 评分取 min(r, 1/r) 消掉方向性：50*0.5 + 50*1（字体族一致）= 75
    expect(r.dimensions.typography).toBeLessThanOrEqual(80);
    expect(r.notes.some((n) => n.startsWith('-font size'))).toBe(true);
  });

  it('字体族完全不同 → fontFamilyOverlap 归零', () => {
    const style = diffStyleTokens(styleTokens(), styleTokens({ bodyFontFamily: 'Comic Sans MS, cursive' }));
    expect(style.fontFamilyOverlap).toBe(0);
  });
});

describe('判据 6：section 间距全部归零 → spacing 显著下降', () => {
  it('间距中位数塌到 0', () => {
    const cloneStyle = styleTokens({ sectionGaps: [] });
    const r = scoreAll(STANDARD_FLOW, STANDARD_FLOW, styleTokens(), cloneStyle);

    expect(r.style.sectionGap?.ratio).toBe(0);
    expect(r.dimensions.spacing).toBeLessThanOrEqual(45); // 60*0 + 40*1 = 40
  });
});

describe('判据 7：圆角 0 → 24px → radius 显著下降 + +rounded', () => {
  it('达到 24px 阈值即判为完全不一致', () => {
    const r = scoreAll(
      STANDARD_FLOW,
      STANDARD_FLOW,
      styleTokens({ radii: [0, 0, 0, 0] }),
      styleTokens({ radii: [24, 24, 24, 24] }),
    );

    expect(r.dimensions.radius).toBe(0);
    expect(r.notes).toContain('+rounded');
  });
});

describe('判据 8：给所有卡片加阴影 → shadow 显著下降 + +shadow', () => {
  it('覆盖率突变被检出', () => {
    const r = scoreAll(
      STANDARD_FLOW,
      STANDARD_FLOW,
      styleTokens(),
      styleTokens({ shadowedElementCount: 100 }),
    );

    expect(r.dimensions.shadow).toBeLessThanOrEqual(60);
    expect(r.notes).toContain('+shadow');
  });
});

// ---------------------------------------------------------------------------
// 资源层
// ---------------------------------------------------------------------------

describe('判据 9：删掉所有图片 → mediaDensity 显著下降', () => {
  it('媒体全无 + 首屏媒体消失，双重罚分', () => {
    const r = scoreAll(
      STANDARD_FLOW,
      STANDARD_FLOW,
      styleTokens(),
      styleTokens(),
      STANDARD_ASSETS,
      { imgCount: 0, bgImageCount: 0, svgCount: 0, videoCount: 0, heroMediaCount: 0 },
    );

    expect(r.assets.ratio).toBe(0);
    expect(r.dimensions.mediaDensity).toBe(0);
    expect(r.notes).toContain('-media missing (原站有图，生成页全无)');
    expect(r.notes).toContain('-hero media missing');
  });
});

// ---------------------------------------------------------------------------
// 缺失值语义（unknown 不是 guess）
// ---------------------------------------------------------------------------

describe('缺失值语义', () => {
  it('两边都没有主色 → 一致（不罚分），不产出 primary 字段', () => {
    const grayHistogram = [{ color: 'rgb(240, 240, 240)', area: 5000 }];
    const style = diffStyleTokens(
      styleTokens({ colorHistogram: grayHistogram }),
      styleTokens({ colorHistogram: [{ color: 'rgb(245, 245, 245)', area: 5000 }] }),
    );
    expect(style.primary).toBeUndefined();
    const r = computeReconstructionScore({
      layout: diffLayout(layoutResult(STANDARD_FLOW), layoutResult(STANDARD_FLOW)),
      style,
      assets: diffAssets(STANDARD_ASSETS, STANDARD_ASSETS),
    });
    expect(r.dimensions.colorTokens).toBe(100);
  });

  it('两边流量都为 0 → pairwiseRatio 为 1（一致），不是 0', () => {
    expect(pairwiseRatio(0, 0)).toBe(1);
  });

  it('parseRgb 拒绝非法值与高透明度', () => {
    expect(parseRgb('nonsense')).toBeNull();
    expect(parseRgb('rgba(0, 0, 0, 0.2)')).toBeNull();
    expect(parseRgb('rgb(0, 113, 227)')).toEqual({ r: 0, g: 113, b: 227 });
  });

  it('pickPrimaryColor 跳过背景色 / 正文色 / 灰度色', () => {
    const primary = pickPrimaryColor(
      [
        { color: 'rgb(255, 255, 255)', area: 90000 }, // 背景色
        { color: 'rgb(29, 29, 31)', area: 8000 }, // 正文色
        { color: 'rgb(128, 128, 128)', area: 5000 }, // 灰度
        { color: 'rgb(230, 30, 60)', area: 4000 }, // 真正的主色
      ],
      'rgb(255, 255, 255)',
      'rgb(29, 29, 31)',
    );
    expect(primary).toBe('rgb(230, 30, 60)');
  });
});
