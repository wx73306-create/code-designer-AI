/**
 * Website Intelligence Package — Adapter
 * ===================================================================
 * 把现有采集层的产物（ScrapedDesignData）聚合成标准 WebsitePackage。
 *
 * 注意：历史上的 `src/legacy/agents/captureAgent.ts`（已归档） 也做过这件事，但它的假设与
 * `ScrapedDesignData` 的真实结构不符（把 colors 当 string[]、把 spacing 当
 * 对象、引用了不存在的 cssVariables 字段）。那份实现从未接线，因此缺陷从未
 * 暴露。本文件按真实结构重写，是唯一可信的构造入口。
 */

import type { ScrapedDesignData } from '@/lib/website-scraper';
import type { InteractionPackage } from '@/lib/browser-intelligence/types';
import type { LayoutProbeResult } from '@/lib/browser-intelligence/layout-probe';
import {
  createEmptyPackage,
  type WebsitePackage,
  type AssetData,
  type ColorInfo,
  type FontInfo,
  type SectionInfo,
  type SectionRole,
  type AnimationData,
} from '@/types/website-package';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BuildPackageInput {
  /** Raw output of `scrapeWebsite`. */
  scraped: Partial<ScrapedDesignData> | null | undefined;
  /** Optional desktop screenshot captured alongside the scrape. */
  screenshot?: {
    dataUrl: string;
    width: number;
    height: number;
    viewport?: string;
  };
  /**
   * 交互采集结果（Phase 1 Sprint 3 接入）。
   *
   * 由 `browser-intelligence` 产出、经 `buildInteractionPackage()` 归一化。
   * 不传则 `WebsitePackage.interaction` 保持 `undefined` —— 这是「没采集过」
   * 的唯一正确表示，不要传空对象。
   */
  interaction?: InteractionPackage;
  /**
   * 布局实测结果（Phase 2 Sprint A）。由 `probeLayout()` 产出。
   *
   * **不传则 `layout.flow` 为空数组**，语义是 **unknown（没测过）**，
   * 而不是 guess。这是删掉 `buildFlow()` 硬编码常量后的关键约定：
   *
   * > 宁可没有数据，也不给「看起来像数据的假数据」。
   *
   * 旧的 `buildFlow()` 用一串常量（nav:4 / hero:26 / feature:20 …）按角色
   * 推算高度占比，任何网站的 hero 都会是同一个百分比。它产出的不是测量结果，
   * 而是伪装成测量结果的猜测——比没有数据更危险，因为下游会当真。
   */
  layout?: LayoutProbeResult;
}

/**
 * Assemble a complete {@link WebsitePackage} from scraped page data.
 *
 * Only the fields that can be derived locally (without an LLM) are filled.
 * `design` and `components` stay empty until the Vision / Planning agents
 * enrich them — every downstream consumer must tolerate that.
 */
export function buildWebsitePackage(input: BuildPackageInput): WebsitePackage {
  const scraped = input.scraped ?? undefined;
  const html = scraped?.htmlStructure ?? '';

  const pkg = createEmptyPackage(scraped?.url ?? '');

  if (input.screenshot) {
    pkg.screenshots.push({
      viewport: input.screenshot.viewport ?? 'desktop',
      width: input.screenshot.width,
      height: input.screenshot.height,
      dataUrl: input.screenshot.dataUrl,
    });
  }

  if (scraped) {
    pkg.assets = extractAssets(html);
    pkg.dom = analyzeDom(html, scraped.cssSnippet ?? '');
    pkg.styles = analyzeStyles(scraped);
    pkg.layout = analyzeLayout(scraped, input.layout);
    pkg.animations = extractAnimations(scraped);
    pkg.metadata = extractMetadata(scraped, html);
  }

  // 只在**真的采到了东西**时才写入。
  // 传进来一个全空的包就保持 undefined —— 「采过但什么都没采到」等价于
  // 「没采过」，两者都不该在提示词里留下 interaction 的痕迹。
  if (input.interaction && hasInteractionContent(input.interaction)) {
    pkg.interaction = input.interaction;
  }

  return pkg;
}

/** 交互包是否含有任何实际内容（决定要不要写进 WebsitePackage）。 */
function hasInteractionContent(pkg: InteractionPackage): boolean {
  return pkg.scrolls.length > 0 || pkg.clicks.length > 0 || pkg.states.length > 0;
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

const MAX_ASSETS = 40;

/** Pull `<img>` sources and inline `<svg>` references out of the HTML. */
function extractAssets(html: string): AssetData[] {
  const assets: AssetData[] = [];
  const seen = new Set<string>();

  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null && assets.length < MAX_ASSETS) {
    const url = match[1];
    if (!url || seen.has(url) || url.startsWith('data:')) continue;
    seen.add(url);
    assets.push({
      type: url.endsWith('.svg') ? 'svg' : 'image',
      url,
      role: inferAssetRole(url, ''),
    });
  }

  const svgRegex = /<svg[^>]*>/gi;
  let inlineCount = 0;
  while ((match = svgRegex.exec(html)) !== null && inlineCount < 10) {
    inlineCount += 1;
    assets.push({
      type: 'svg',
      url: `inline-svg-${inlineCount}`,
      role: 'inline-icon',
    });
  }

  return assets;
}

/** Guess an asset's semantic role from its filename / path. */
function inferAssetRole(url: string, alt: string): string | undefined {
  const haystack = `${url} ${alt}`.toLowerCase();
  if (/logo/.test(haystack)) return 'logo';
  if (/hero|banner|cover/.test(haystack)) return 'hero';
  if (/avatar|profile|team|user/.test(haystack)) return 'avatar';
  if (/icon|glyph/.test(haystack)) return 'icon';
  if (/bg|background|pattern/.test(haystack)) return 'background';
  if (/favicon|apple-touch/.test(haystack)) return 'favicon';
  return undefined;
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

/**
 * Detect semantic sections and classify the overall page type.
 *
 * 响应式斷言必须同时看 HTML 内联 `<style>` 与提取出的 CSS 片段 ——
 * 现代站点的 @media 规则几乎从不在 HTML 里出现。
 */
function analyzeDom(html: string, cssSnippet: string): WebsitePackage['dom'] {
  const sections = extractSections(html);

  return {
    pageType: inferPageType(html, sections),
    sections,
    layout: detectPrimaryLayout(html),
    responsive: /@media[^{]*\(\s*(max|min)-width/i.test(`${html}\n${cssSnippet}`),
    structure: html.slice(0, 3000),
  };
}

/** Scan top-level structural tags and assign each a {@link SectionRole}. */
function extractSections(html: string): SectionInfo[] {
  const tags = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'] as const;
  const sections: SectionInfo[] = [];
  let index = 0;

  for (const tag of tags) {
    const regex = new RegExp(`<${tag}\\b([^>]*)>`, 'gi');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null && sections.length < 30) {
      const attrs = match[1] ?? '';
      const role = inferSectionRole(tag, attrs);
      index += 1;

      sections.push({
        name: `${tag}-${index}`,
        tag,
        height: 'auto',
        layout: detectPrimaryLayout(match[0]),
        children: [],
        role,
      });
    }
  }

  return sections;
}

/**
 * Heuristic role assignment for a single structural element.
 *
 * 只看元素自身的 tag 与属性（class / id / aria-label）。刻意不读取元素后面的
 * 内容 —— 一旦把后续兄弟结构的文本也算进来，`<section class="hero">` 会因为
 * 文档末尾存在 `<footer>` 而被误判成 footer。
 */
function inferSectionRole(tag: string, attrs: string): SectionRole {
  // 把 class="a b" / id="c" / aria-label="d" 的值摊平成一个字符串
  const attrValues = Array.from(attrs.matchAll(/(?:class|id|aria-label|data-section)=["']([^"']+)["']/gi))
    .map((m) => m[1])
    .join(' ');
  const idClass = `${tag} ${attrValues}`.toLowerCase();

  if (tag === 'nav' || /<nav|navigation|navbar/.test(idClass)) return 'nav';
  if (tag === 'footer' || /footer/.test(idClass)) return 'footer';
  if (/hero|jumbotron|banner/.test(idClass)) return 'hero';
  if (/pricing|plan|tier/.test(idClass)) return 'pricing';
  if (/testimonial|review|quote/.test(idClass)) return 'testimonial';
  if (/feature|benefit|service/.test(idClass)) return 'feature';
  if (/product|card-grid|gallery/.test(idClass)) return 'product';
  if (/cta|get-started|signup|sign-up|contact/.test(idClass)) return 'cta';
  if (tag === 'header') return 'hero';
  if (tag === 'aside') return 'other';

  return 'content';
}

/** Decide whether the page is primarily grid / flexbox / block based. */
function detectPrimaryLayout(html: string): string {
  const grid = (html.match(/display\s*:\s*grid|grid-template-columns/gi) ?? []).length;
  const flex = (html.match(/display\s*:\s*flex|flex-direction/gi) ?? []).length;
  if (grid > flex) return 'css-grid';
  if (flex > 0) return 'flexbox';
  return 'block';
}

/** Very coarse page-type classification used for prompt conditioning. */
function inferPageType(html: string, sections: SectionInfo[]): string {
  const lower = html.toLowerCase();
  const roles = sections.map((s) => s.role);

  if (/add to cart|add-to-cart|shop-now/.test(lower)) return 'ecommerce';
  if (roles.includes('pricing') || /start free trial|free trial/.test(lower)) return 'saas-landing';
  if (roles.includes('hero') && roles.includes('feature')) return 'landing';
  if (/<article|blog-post|post-title/.test(lower)) return 'blog';
  if (/portfolio|case-study|our work/.test(lower)) return 'portfolio';

  return 'website';
}

// ---------------------------------------------------------------------------
// Styles — 按 ScrapedDesignData 的真实结构（对象数组 / 扁平数组）
// ---------------------------------------------------------------------------

function analyzeStyles(scraped: Partial<ScrapedDesignData>): WebsitePackage['styles'] {
  return {
    colors: mapColors(scraped.colors),
    fonts: mapFonts(scraped.fonts),
    spacing: mapSpacing(scraped.spacing),
    shadows: (scraped.shadows ?? []).slice(0, 12),
    borderRadius: (scraped.borderRadius ?? []).slice(0, 12),
    transitions: (scraped.transitions ?? []).slice(0, 20),
    cssVariables: extractCssVariables(scraped.cssSnippet ?? ''),
  };
}

function mapColors(colors?: ScrapedDesignData['colors']): ColorInfo[] {
  if (!Array.isArray(colors)) return [];
  return colors.slice(0, 20).map((c) => ({
    hex: c?.value ?? '#000000',
    role: inferColorRole(c?.context ?? ''),
    usage: c?.context ?? 'unknown',
  }));
}

/**
 * Infer a colour's semantic role from its usage context.
 *
 * 顺序很重要：像 'primary button background' 同时命中 primary 与 background，
 * 若先判 background 就会把品牌主色降级成背景色，导致 Code Agent 拿不到主色。
 * 因此强语义词（text / border / accent / primary）一律先判。
 */
function inferColorRole(context: string): ColorInfo['role'] {
  const c = context.toLowerCase();
  if (/text|foreground|heading|paragraph|title/.test(c)) return 'text';
  if (/border|divider|outline|stroke/.test(c)) return 'border';
  if (/accent|highlight|link/.test(c)) return 'accent';
  if (/primary|brand|main-color/.test(c)) return 'primary';
  if (/background|bg|body|surface|section/.test(c)) return 'background';
  return 'primary';
}

function mapFonts(fonts?: ScrapedDesignData['fonts']): FontInfo[] {
  if (!Array.isArray(fonts)) return [];
  return fonts.slice(0, 10).map((f, i) => ({
    family: f?.family ?? 'sans-serif',
    weights: (f?.weights ?? []).map((w) => Number(w) || 400),
    sizes: (f?.sizes ?? []).slice(0, 8),
    role: i === 0 ? 'heading' : 'body',
  }));
}

/**
 * `ScrapedDesignData.spacing` is a flat string[], NOT an object — derive the
 * structured SpacingInfo from it (this is exactly where the legacy adapter
 * went wrong).
 */
function mapSpacing(spacing?: string[]): WebsitePackage['styles']['spacing'] {
  const numeric = (Array.isArray(spacing) ? spacing : [])
    .map((s) => parseInt(String(s).replace('px', ''), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  const unique = Array.from(new Set(numeric));
  const base = unique.length > 0 ? `${gcd(unique)}px` : '4px';

  return {
    base,
    scale: unique.slice(0, 10).map((n) => `${n}px`),
    containerMaxWidth: unique.length > 0 ? `${Math.max(...unique)}px` : '1200px',
    sectionPadding: unique.length > 1 ? `${unique[Math.min(4, unique.length - 1)]}px 0` : '64px 0',
  };
}

/** Greatest common divisor — used to recover the spacing base unit. */
function gcd(values: number[]): number {
  return values.reduce((acc, v) => {
    let a = acc;
    let b = v;
    while (b) {
      [a, b] = [b, a % b];
    }
    return a;
  }, values[0] ?? 4) || 4;
}

function extractCssVariables(cssSnippet: string): Record<string, string> {
  const out: Record<string, string> = {};
  const regex = /(--[\w-]+)\s*:\s*([^;{}]+)[;}]/g;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = regex.exec(cssSnippet)) !== null && count < 40) {
    out[match[1]] = match[2].trim();
    count += 1;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Layout — 计划书 Phase 3 新增：区块顺序 + 视觉占比 + 网格
// ---------------------------------------------------------------------------

/**
 * 组装布局分析。
 *
 * **实测优先**：传了 `measured` 就用实测值；没传才退回 CSS 正则推断。
 *
 * 关于 `flow: []` 的语义（本 Sprint 的关键约定）：
 *
 * > **unknown（没测过），不是 guess。**
 *
 * 旧的 `buildFlow()` 会用一串常量（nav:4 / hero:26 / feature:20 …）按角色推算
 * 高度占比，导致任何网站的 hero 都是同一个百分比。它产出的不是测量结果，
 * 而是**伪装成测量结果的猜测**——比没有数据更危险，因为下游会当真。
 * 该函数已删除，见 {@link BuildPackageInput.layout}。
 */
function analyzeLayout(
  scraped: Partial<ScrapedDesignData>,
  measured?: LayoutProbeResult,
): WebsitePackage['layout'] {
  const css = scraped.cssSnippet ?? '';
  const hints = (scraped.layoutHints ?? []).join(' ').toLowerCase();

  // 刻意用 `measured ?` 而非 `measured?.x ?? fallback`：
  // 0 列、false（非吸顶 / 非居中）都是**有效的实测结论**，必须保留，
  // 若用 `??` 会被兜底值覆盖掉，等于把实测结果又改回猜测。
  const gridColumns = measured
    ? measured.gridColumns
    : detectGridColumns(css, scraped.htmlStructure ?? '');
  const stickyHeader = measured
    ? measured.stickyHeader
    : /position\s*:\s*(sticky|fixed)/i.test(css) || /sticky|fixed/i.test(hints);
  const centered = measured
    ? measured.centered
    : /margin\s*:\s*0\s+auto|margin-inline\s*:\s*auto|justify-content\s*:\s*center/i.test(css);

  return {
    flow: measured?.flow ?? [],
    breakpoints: extractBreakpoints(css),
    gridColumns,
    gap: detectGap(css),
    stickyHeader,
    centered,
  };
}

function extractBreakpoints(cssSnippet: string): string[] {
  const out = new Set<string>();
  const regex = /@media[^{]*\(\s*(max|min)-width\s*:\s*([^)]+)\)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cssSnippet)) !== null && out.size < 8) {
    out.add(`${match[1]}-width: ${match[2].trim()}`);
  }

  return Array.from(out);
}

function detectGridColumns(cssSnippet: string, html: string): number {
  const repeat = /grid-template-columns\s*:\s*repeat\(\s*(\d+)/i.exec(cssSnippet);
  if (repeat) return Number(repeat[1]);

  const counted = /grid-template-columns\s*:\s*([^;]+);/i.exec(cssSnippet);
  if (counted) {
    const tracks = counted[1].trim().split(/\s+/).length;
    if (tracks > 1) return tracks;
  }

  return detectPrimaryLayout(html) === 'css-grid' ? 2 : 0;
}

function detectGap(cssSnippet: string): string | undefined {
  const gap = /(?:grid-)?gap\s*:\s*([^;]+);/i.exec(cssSnippet);
  return gap ? gap[1].trim() : undefined;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Animations - Phase 6 GSAP Agent 的上游输入
// ---------------------------------------------------------------------------

/**
 * Parse every animation signal available in STATIC data:
 *
 *   1. `@keyframes`      -> which properties actually move (transform? layout?)
 *   2. `animation:` decl -> duration / easing / delay / iteration count
 *   3. `transition:`     -> hover & micro-interaction states
 *   4. class heuristics  -> scroll-driven libraries (AOS, fade-in-up, ...)
 *
 * `properties` is the single most important field downstream: transform/opacity
 * effects translate cleanly to GSAP, whereas width/height/margin do not.
 */
function extractAnimations(scraped: Partial<ScrapedDesignData>): AnimationData[] {
  const out: AnimationData[] = [];
  const css = scraped.cssSnippet ?? '';
  const html = scraped.htmlStructure ?? '';
  const MAX_PER_SOURCE = 12;

  // 1 + 2 -- keyframe rules matched with their usage declarations
  const keyframes = parseKeyframes(css);
  for (const decl of parseAnimationDeclarations(css)) {
    if (out.length >= MAX_PER_SOURCE) break;

    const properties = keyframes.get(decl.name);

    out.push({
      name: decl.name,
      type: classifyAnimationType(properties, decl.iterations),
      duration: decl.duration,
      easing: decl.easing,
      target: decl.selector,
      properties,
      delay: decl.delay,
      infinite: decl.iterations === 'infinite',
      // 找不到对应 @keyframes 就无法复刻真实运动轨迹
      uncertain: properties === undefined,
    });
  }

  // 3 -- plain transitions (hover states / micro interactions)
  for (const raw of (scraped.transitions ?? []).slice(0, MAX_PER_SOURCE)) {
    const parsed = parseTransition(raw);
    if (parsed) out.push(parsed);
  }

  // 4 -- scroll-driven classes that static CSS cannot express
  const scrollAnim = detectScrollAnimation(html);
  if (scrollAnim) out.push(scrollAnim);

  return out;
}

/** Collect every `@keyframes` block and the properties its frames animate. */
function parseKeyframes(css: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const openRe = /@keyframes\s+([\w-]+)\s*\{/gi;
  let open: RegExpExecArray | null;

  while ((open = openRe.exec(css)) !== null) {
    // Walk to the matching closing brace so nested frames are handled.
    let depth = 1;
    let i = openRe.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }

    const body = css.slice(openRe.lastIndex, Math.max(0, i - 1));
    const props = new Set<string>();
    const propRe = /([a-z-]+)\s*:/gi;
    let prop: RegExpExecArray | null;

    while ((prop = propRe.exec(body)) !== null) {
      const name = prop[1].toLowerCase();
      const ignorable = ['from', 'to', 'offset', 'animation-timing-function'].includes(name)
        || /^\d+%$/.test(name);
      if (!ignorable) props.add(name);
    }

    map.set(open[1], Array.from(props));
  }

  return map;
}

interface ParsedAnimationDeclaration {
  name: string;
  selector: string;
  duration: string;
  easing: string;
  delay?: string;
  iterations?: string;
}

/**
 * Extract `animation` / `animation-name` declarations together with the
 * selector they apply to, so the Agent knows WHICH element to animate.
 */
function parseAnimationDeclarations(css: string): ParsedAnimationDeclaration[] {
  const out: ParsedAnimationDeclaration[] = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let rule: RegExpExecArray | null;

  while ((rule = ruleRe.exec(css)) !== null) {
    const selector = rule[1].trim().replace(/\s+/g, ' ');
    const body = rule[2];

    // Skip at-rules (@media / @keyframes / @supports) - they carry no selector.
    if (selector.startsWith('@')) continue;
    if (!/animation(?:-name)?\s*:/i.test(body)) continue;

    const nameFromLong = /animation-name\s*:\s*([\w-]+)/i.exec(body);
    const shorthand = /animation\s*:\s*([^;]+)/i.exec(body);

    if (!nameFromLong && !shorthand) continue;

    const tokens = shorthand ? shorthand[1].trim().split(/\s+/) : [];
    const name = nameFromLong ? nameFromLong[1] : tokens[0];
    if (!name || name === 'none') continue;

    // Shorthand order: duration delay easing iteration-count fill-mode
    const timing = nameFromLong ? tokens : tokens.slice(1);
    const times = timing.filter((t) => /^\d*\.?\d+m?s$/.test(t));
    const easing = timing.find((t) => /^(linear|ease|ease-in|ease-out|ease-in-out|step|steps|cubic-bezier|spring)/i.test(t));
    const iterations = timing.find((t) => /^(infinite|\d+)$/.test(t) && !times.includes(t));

    out.push({
      name,
      selector: selector.slice(0, 80),
      duration: times[0] ?? (/animation-duration\s*:\s*([\w.]+)/i.exec(body)?.[1] ?? '0.3s'),
      easing: easing ?? (/animation-timing-function\s*:\s*([^;]+)/i.exec(body)?.[1]?.trim() ?? 'ease'),
      delay: times[1],
      iterations,
    });
  }

  return out;
}

/**
 * Decide whether an animation is an entrance (one-shot reveal), a looping
 * keyframe effect, or something expensive that touches layout.
 */
function classifyAnimationType(properties: string[] | undefined, iterations?: string): AnimationData['type'] {
  if (iterations === 'infinite') return 'keyframe';
  if (!properties) return 'keyframe';

  const revealOnly = properties.every((p) => /^(opacity|transform|filter|visibility)$/.test(p));
  if (revealOnly && properties.includes('opacity')) return 'entrance';

  return 'keyframe';
}

/** Detect scroll-reveal conventions that only exist as class names. */
function detectScrollAnimation(html: string): AnimationData | null {
  const signals: Array<[RegExp, string]> = [
    [/data-aos\s*=/i, 'AOS (data-aos)'],
    [/class="[^"]*\b(?:fade-in-up|fadeInUp|animate-on-scroll|scroll-reveal|reveal)\b/i, 'fade-in-up / scroll-reveal class'],
    [/class="[^"]*\b(?:wow|animate__animated)\b/i, 'animate.css / WOW.js'],
    [/[\w-]*observer\s*\(/i, 'IntersectionObserver trigger'],
  ];

  for (const [re, label] of signals) {
    if (re.test(html)) {
      return {
        name: label,
        type: 'scroll',
        duration: '0.6s',
        easing: 'ease-out',
        target: '[scroll-reveal]',
        properties: ['opacity', 'transform'],
        uncertain: true,
      };
    }
  }

  return null;
}

/** Turn `all 0.3s ease-in-out 0s` into a structured record. */
function parseTransition(raw: string): AnimationData | null {
  if (!raw || typeof raw !== 'string') return null;

  const parts = raw.trim().split(/\s+/);
  const properties = parts[0] && parts[0] !== 'all'
    ? parts[0].split(',').map((p) => p.trim())
    : (parts[0] === 'all' ? ['all'] : []);

  const duration = parts.find((p) => /^\.?\d+m?s$/.test(p)) ?? '0.3s';
  const delay = parts.find((p) => /^\.?\d+m?s$/.test(p) && p !== duration);
  const easing = parts.find((p) => /ease|cubic|linear|steps/i.test(p));

  return {
    name: `transition:${properties.slice(0, 2).join('-') || 'unknown'}`,
    type: 'transition',
    duration,
    easing: easing ?? 'ease',
    target: 'unknown',
    properties: properties.length > 0 ? properties : undefined,
    delay,
    uncertain: properties[0] === 'all',
  };
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

function extractMetadata(
  scraped: Partial<ScrapedDesignData>,
  html: string,
): WebsitePackage['metadata'] {
  const og: Record<string, string> = {};
  const ogRegex = /<meta[^>]+property=["']og:([^"']+)["'][^>]+content=["']([^"']*)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = ogRegex.exec(html)) !== null) {
    og[match[1]] = match[2];
  }

  const favicon = /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i.exec(html);
  const canonical = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html);
  const lang = /<html[^>]+lang=["']([^"']+)["']/i.exec(html);

  return {
    title: scraped.title || undefined,
    description: scraped.metaDescription || undefined,
    language: lang ? lang[1] : undefined,
    favicon: favicon ? favicon[1] : (og.image ? undefined : undefined),
    openGraph: Object.keys(og).length > 0 ? og : undefined,
    canonical: canonical ? canonical[1] : undefined,
    brand: deriveBrand(scraped.title ?? '', og),
  };
}

/** Strip taglines from a page title to recover the bare brand name. */
function deriveBrand(title: string, og: Record<string, string>): string | undefined {
  if (og.site_name) return og.site_name;

  const cleaned = title
    .split(/\s*[|–—·]\s*/)[0]
    .replace(/\s*[-:]\s*(home|homepage|official site).*$/i, '')
    .trim();

  return cleaned.length > 0 && cleaned.length < 32 ? cleaned : undefined;
}
