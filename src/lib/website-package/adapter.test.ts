/**
 * Website Package Adapter — 回归测试
 *
 * 重点覆盖一处真实历史缺陷：`src/legacy/agents/captureAgent.ts`（已归档） 把
 * `ScrapedDesignData` 的结构猜错了（colors 当 string[]、spacing 当对象、
 * 引用了不存在的 cssVariables）。那份实现从未接线，所以缺陷从未暴露。
 * 本文件用 scraper 的**真实结构**锁住正确行为，防止同样的错误再次引入。
 */

import { describe, it, expect } from 'vitest';
import { buildWebsitePackage } from './adapter';
import { WEBSITE_PACKAGE_VERSION } from '@/types/website-package';

const baseScraped = {
  url: 'https://example.com',
  title: 'Example — Official Site',
  metaDescription: 'A short description.',
  colors: [
    { value: '#0a0a0a', context: 'text primary' },
    { value: '#0071e3', context: 'primary button background' },
    { value: '#f5f5f7', context: 'section background' },
  ],
  fonts: [
    { family: 'Inter', weights: ['400', '700'], sizes: ['16px', '48px'] },
    { family: 'SF Mono', weights: ['400'], sizes: ['14px'] },
  ],
  spacing: ['8px', '16px', '24px', '48px'],
  borderRadius: ['8px', '12px'],
  shadows: ['0 1px 3px rgba(0,0,0,0.1)'],
  transitions: ['opacity 0.3s ease-in-out', 'all 0.2s linear'],
  layoutHints: ['hero-centered', 'sticky-header'],
  htmlStructure:
    '<html lang="en"><header class="site-header"><nav class="nav"></nav></header><main><section class="hero"><img src="/hero.png"></section><section class="features"></section></main><footer></footer></html>',
  cssSnippet: `
    :root { --brand: #0071e3; --radius: 12px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .header { position: sticky; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
  `,
  externalCSSCount: 2,
  inlineStyleCount: 5,
};

describe('buildWebsitePackage', () => {
  it('produces a complete skeleton even with no scrape data', () => {
    const pkg = buildWebsitePackage({ scraped: null });

    expect(pkg.version).toBe(WEBSITE_PACKAGE_VERSION);
    expect(pkg.dom.sections).toEqual([]);
    expect(pkg.styles.colors).toEqual([]);
    expect(pkg.layout.flow).toEqual([]);
    expect(pkg.animations).toEqual([]);
    expect(pkg.components.tree).toEqual([]);
    expect(typeof pkg.metadata).toBe('object');
  });

  // ------------------------------------------------------------------
  // 下面三条例是针对 captureAgent 历史缺陷的回归测试
  // ------------------------------------------------------------------

  it('maps colors from the real {value, context} shape (not string[])', () => {
    const pkg = buildWebsitePackage({ scraped: baseScraped });

    expect(pkg.styles.colors).toHaveLength(3);
    expect(pkg.styles.colors[0].hex).toBe('#0a0a0a');
    expect(pkg.styles.colors[0].usage).toBe('text primary');
    // context 参与角色推断，而不是退化为固定的 primary/secondary
    expect(pkg.styles.colors[0].role).toBe('text');
    expect(pkg.styles.colors[1].role).toBe('primary');
    expect(pkg.styles.colors[2].role).toBe('background');
  });

  it('derives SpacingInfo from the flat string[] (not an object)', () => {
    const pkg = buildWebsitePackage({ scraped: baseScraped });

    expect(pkg.styles.spacing.scale).toEqual(['8px', '16px', '24px', '48px']);
    expect(pkg.styles.spacing.base).toBe('8px');
    expect(pkg.styles.spacing.containerMaxWidth).toBe('48px');
  });

  it('maps fonts from the real {family, weights, sizes} shape', () => {
    const pkg = buildWebsitePackage({ scraped: baseScraped });

    expect(pkg.styles.fonts).toHaveLength(2);
    expect(pkg.styles.fonts[0].family).toBe('Inter');
    expect(pkg.styles.fonts[0].weights).toEqual([400, 700]);
    expect(pkg.styles.fonts[0].sizes).toEqual(['16px', '48px']);
    expect(pkg.styles.fonts[0].role).toBe('heading');
  });

  // ------------------------------------------------------------------
  // Phase 3 新增能力
  // ------------------------------------------------------------------

  it('recovers CSS variables, breakpoints and grid columns', () => {
    const pkg = buildWebsitePackage({ scraped: baseScraped });

    expect(pkg.styles.cssVariables['--brand']).toBe('#0071e3');
    expect(pkg.layout.gridColumns).toBe(3);
    expect(pkg.layout.gap).toBe('24px');
    expect(pkg.layout.stickyHeader).toBe(true);
    expect(pkg.layout.breakpoints).toContain('max-width: 768px');
  });

  it('leaves the vertical flow empty when no layout probe ran (unknown, not guess)', () => {
    const pkg = buildWebsitePackage({ scraped: baseScraped });

    // Phase 2 Sprint A：`buildFlow()` 的硬编码常量表已删除。
    // 没测过就是 unknown —— 空数组，绝不给「看起来像数据的猜测值」。
    //
    // 旧行为：这里会返回按角色推算的假百分比（nav 8% / hero 52% / feature 40%），
    // 且各区块权重和必定 ~100（因为是对常量表做归一化）。新语义下不成立：
    // 实测只取前 N 个 section 并过滤噪音，权重和本来就不等于 100。
    expect(pkg.layout.flow).toEqual([]);
  });

  it('classifies DOM sections with semantic roles', () => {
    const pkg = buildWebsitePackage({ scraped: baseScraped });
    const roles = pkg.dom.sections.map((s) => s.role);

    expect(roles).toContain('nav');
    expect(roles).toContain('hero');
    expect(roles).toContain('footer');
    expect(pkg.dom.responsive).toBe(true);
  });

  it('extracts image assets and skips inline data URIs', () => {
    const pkg = buildWebsitePackage({
      scraped: { ...baseScraped, htmlStructure: '<img src="/hero.png"><img src="data:image/png;base64,AAA">' },
    });

    const urls = pkg.assets.map((a) => a.url);
    expect(urls).toContain('/hero.png');
    expect(urls.some((u) => u.startsWith('data:'))).toBe(false);
  });

  it('parses transitions and flags layout-affecting ones as uncertain', () => {
    const pkg = buildWebsitePackage({ scraped: baseScraped });

    expect(pkg.animations).toHaveLength(2);
    expect(pkg.animations[0].properties).toEqual(['opacity']);
    expect(pkg.animations[0].duration).toBe('0.3s');
    expect(pkg.animations[0].easing).toBe('ease-in-out');
    // `all 0.2s linear` 无法归因到具体属性，应标记 uncertain
    expect(pkg.animations[1].uncertain).toBe(true);
    expect(pkg.animations[1].properties).toEqual(['all']);
  });

  it('derives brand from the page title and harvests metadata', () => {
    const pkg = buildWebsitePackage({ scraped: baseScraped });

    expect(pkg.metadata.title).toBe('Example — Official Site');
    expect(pkg.metadata.description).toBe('A short description.');
    expect(pkg.metadata.language).toBe('en');
    expect(pkg.metadata.brand).toBe('Example');
  });
});


describe('buildWebsitePackage - animation detection', () => {
  const animScraped = {
    ...baseScraped,
    transitions: [] as string[],
    cssSnippet: `
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(24px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulseRing {
        0%   { transform: scale(1); opacity: 0.8; }
        100% { transform: scale(1.6); opacity: 0; }
      }
      @keyframes growWidth {
        from { width: 0; }
        to   { width: 100%; }
      }
      .hero-title { animation: fadeUp 0.8s cubic-bezier(0.25,0.46,0.45,0.94) 0.1s both; }
      .pulse-dot  { animation: pulseRing 1.4s ease-out infinite; }
      .bar-fill   { animation: growWidth 0.5s linear forwards; }
    `,
  };

  it('links an animation declaration to the properties its @keyframes moves', () => {
    const pkg = buildWebsitePackage({ scraped: animScraped });
    const fadeUp = pkg.animations.find((a) => a.name === 'fadeUp');

    expect(fadeUp).toBeDefined();
    expect(fadeUp!.properties).toContain('opacity');
    expect(fadeUp!.properties).toContain('transform');
    expect(fadeUp!.uncertain).toBe(false);
  });

  it('parses duration / easing / delay / iteration from the shorthand', () => {
    const pkg = buildWebsitePackage({ scraped: animScraped });
    const fadeUp = pkg.animations.find((a) => a.name === 'fadeUp');

    expect(fadeUp!.duration).toBe('0.8s');
    expect(fadeUp!.delay).toBe('0.1s');
    expect(fadeUp!.easing).toBe('cubic-bezier(0.25,0.46,0.45,0.94)');
  });

  it('flags infinite iterations and keeps the selector as target', () => {
    const pkg = buildWebsitePackage({ scraped: animScraped });
    const pulse = pkg.animations.find((a) => a.name === 'pulseRing');

    expect(pulse!.infinite).toBe(true);
    expect(pulse!.duration).toBe('1.4s');
    expect(pulse!.target).toBe('.pulse-dot');
  });

  it('classifies pure opacity/transform reveals as entrance animations', () => {
    const pkg = buildWebsitePackage({ scraped: animScraped });
    const reveal = pkg.animations.find((a) => a.name === 'fadeUp');

    expect(reveal!.type).toBe('entrance');
  });

  it('does NOT classify layout-animating keyframes as entrance', () => {
    const pkg = buildWebsitePackage({ scraped: animScraped });
    const grow = pkg.animations.find((a) => a.name === 'growWidth');

    // width 是布局属性，不能被当成廉价 entrance 动画处理
    expect(grow!.properties).toEqual(['width']);
    expect(grow!.type).toBe('keyframe');
  });

  it('detects scroll-reveal libraries that only exist as markup', () => {
    const pkg = buildWebsitePackage({
      scraped: { ...baseScraped, htmlStructure: '<div data-aos="fade-up"></div>' },
    });

    const scroll = pkg.animations.filter((a) => a.type === 'scroll');
    expect(scroll).toHaveLength(1);
    expect(scroll[0].uncertain).toBe(true);
  });

  it('marks keyframes-free animations as uncertain', () => {
    const pkg = buildWebsitePackage({
      scraped: {
        ...baseScraped,
        transitions: [] as string[],
        cssSnippet: '.orphan { animation: notDefined 0.4s ease; }',
      },
    });

    const orphan = pkg.animations.find((a) => a.name === 'notDefined');
    expect(orphan!.uncertain).toBe(true);
    expect(orphan!.properties).toBeUndefined();
  });
});
