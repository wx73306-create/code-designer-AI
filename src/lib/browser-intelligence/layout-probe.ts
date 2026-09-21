/**
 * Layout Probe — 浏览器实测页面几何
 * ===================================================================
 * Phase 2 / Sprint A。用于把 `WebsitePackage.layout.flow` 从「硬编码常量」
 * 换成「真实测量值」。
 *
 * ## 分层原则（本文件的核心约束）
 *
 * | 层 | 职责 | 允许 |
 * |---|---|---|
 * | 浏览器内（`collectGeometry`） | **只返回原始几何数字** | 读 rect / computed style |
 * | Node 侧（`buildLayoutResult`） | 语义推断：role / columns / 占比 / 过滤 | 全部纯函数 |
 *
 * 浏览器内**禁止**：
 * - ❌ hero / feature / pricing 这类**语义角色**判断
 * - ❌ columns 推断
 * - ❌ heightWeight 计算
 *
 * 这样分层有三个理由：
 * 1. 视觉/语义判断不藏在 `evaluate` 里，改判定规则不用碰浏览器代码
 * 2. puppeteer 与 playwright 的差异被隔离在 `PageController` 之下
 * 3. Node 侧全是纯函数，vitest（node 环境）可直接单测，不需要真浏览器
 *
 * ## 唯一例外：`stickyHeader`
 *
 * 它读的是 `position: fixed|sticky` 这个**计算样式**并直接返回布尔，
 * 属于「读取」而非「推断」（不像 hero/feature 那样需要理解内容）。
 * 若改成 Node 侧判断，就得把全站元素的 position 都采回来，代价过大。
 */

import type { PageController } from './types';
import type { LayoutBlock, SectionRole } from '@/types/website-package';

// ---------------------------------------------------------------------------
// Options & defaults
// ---------------------------------------------------------------------------

export const DEFAULT_MAX_SECTIONS = 12;
export const DEFAULT_MIN_SECTION_HEIGHT = 40;
export const DEFAULT_FULL_BLEED_RATIO = 0.98;
export const DEFAULT_ROW_TOLERANCE = 8;

export interface LayoutProbeOptions {
  /** 最多保留多少个 section（按文档顺序取前 N 个）。默认 12。 */
  maxSections?: number;
  /** 低于此像素高度的 section 视为噪音丢弃。默认 40。 */
  minSectionHeight?: number;
  /** 通栏判定阈值：宽度 >= 视口宽度 × 此比例。默认 0.98。 */
  fullBleedRatio?: number;
  /** 列数判定时「同一行」的 top 容差（px）。默认 8。 */
  rowTolerance?: number;
}

// ---------------------------------------------------------------------------
// Raw geometry（浏览器返回，不含任何语义）
// ---------------------------------------------------------------------------

/** 一个候选区块的原始几何。浏览器侧唯一产物。 */
export interface RawSection {
  /** 稳定选择器，仅用于调试回溯，不参与判定。 */
  selector: string;
  tag: string;
  className: string;
  id: string;
  /** 文档绝对坐标：`rect.top + scrollY` */
  top: number;
  /** 文档绝对坐标：`rect.left` */
  left: number;
  height: number;
  width: number;
  /** `getComputedStyle(el).textAlign` 原文，归一化在 Node 侧做。 */
  textAlign: string;
  /** 直接子元素总数（真实值，不受 childTops 截断影响）。 */
  childCount: number;
  /** 直接子元素的 top（文档绝对坐标）。用于 Node 侧算列数。 */
  childTops: number[];
}

export interface RawLayoutProbe {
  sections: RawSection[];
  /** `documentElement.scrollHeight` */
  docHeight: number;
  viewport: { width: number; height: number };
  /** 是否存在「吸顶/固定」且靠近顶部的元素。 */
  stickyHeader: boolean;
}

export interface LayoutProbeResult {
  flow: LayoutBlock[];
  gridColumns: number;
  stickyHeader: boolean;
  centered: boolean;
  viewport: { width: number; height: number };
  docHeight: number;
}

// ---------------------------------------------------------------------------
// 浏览器内采集 —— 只返回原始几何
// ---------------------------------------------------------------------------

/**
 * ⚠️ 这个函数会被 `page.evaluate` 序列化后丢进浏览器执行：
 * **函数体内不得引用任何外部变量**（闭包不会跟着序列化过去）。
 * 所以常量全部内联在下面，而不是复用模块顶层的 DEFAULT_*。
 */
function collectGeometry(): RawLayoutProbe {
  const MAX_SECTIONS = 60;
  const MAX_CHILD_TOPS = 40;

  const scrollY = window.scrollY || window.pageYOffset || 0;
  const doc = document.documentElement;
  const bodyScroll = document.body ? document.body.scrollHeight : 0;
  const docHeight = Math.max(doc.scrollHeight || 0, bodyScroll || 0);
  const viewport = { width: window.innerWidth, height: window.innerHeight };

  // --- 候选元素：优先语义标签，不足则补 body 直接子元素 ---
  const found: Element[] = [];
  const tags = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'];
  for (const t of tags) {
    const els = document.getElementsByTagName(t);
    for (let i = 0; i < els.length; i++) found.push(els[i]);
  }
  if (found.length < 3 && document.body) {
    const kids = document.body.children;
    for (let i = 0; i < kids.length; i++) found.push(kids[i]);
  }

  const sections: RawSection[] = [];
  for (const el of found) {
    if (sections.length >= MAX_SECTIONS) break;

    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const cls = el.getAttribute('class') || '';
    const idAttr = el.getAttribute('id') || '';

    const childTops: number[] = [];
    const kids = el.children;
    for (let i = 0; i < kids.length && childTops.length < MAX_CHILD_TOPS; i++) {
      childTops.push(Math.round(kids[i].getBoundingClientRect().top + scrollY));
    }

    // 选择器仅用于调试回溯：有稳定 id 用 id，否则退到 tag.class
    const firstClass = cls.trim().split(/\s+/)[0] || '';
    const selector = idAttr
      ? `#${idAttr}`
      : (firstClass ? `${el.tagName.toLowerCase()}.${firstClass}` : el.tagName.toLowerCase());

    sections.push({
      selector,
      tag: el.tagName.toLowerCase(),
      className: cls,
      id: idAttr,
      top: Math.round(rect.top + scrollY),
      left: Math.round(rect.left),
      height: Math.round(rect.height),
      width: Math.round(rect.width),
      textAlign: style.textAlign || '',
      childCount: kids.length,
      childTops,
    });
  }

  // --- stickyHeader：读计算样式，不做语义推断 ---
  let stickyHeader = false;
  const all = document.querySelectorAll('header, nav, div');
  for (let i = 0; i < all.length && i < 200; i++) {
    const el = all[i];
    const pos = window.getComputedStyle(el).position;
    if (pos !== 'fixed' && pos !== 'sticky') continue;
    const top = el.getBoundingClientRect().top + scrollY;
    if (top < viewport.height * 0.3) {
      stickyHeader = true;
      break;
    }
  }

  return { sections, docHeight, viewport, stickyHeader };
}

// ---------------------------------------------------------------------------
// Node 侧语义推断（纯函数，可单测）
// ---------------------------------------------------------------------------

/**
 * 从 tag / class / id 推断区块角色。
 *
 * 与 `adapter.ts` 的 `inferSectionRole()` 是**不同输入源的两个实现**：
 * 那边吃 HTML 正则片段，这边吃浏览器实测的 DOM 属性。
 * 是否在后续 Sprint 合并，留到 Step 3 改动 adapter 时再评估。
 */
export function inferSectionRole(tag: string, className: string, id: string): SectionRole {
  const hay = `${tag} ${className} ${id}`.toLowerCase();

  // footer 必须先判：页脚里常含 nav / cta 字样，晚判会被误吞
  if (/footer/.test(hay)) return 'footer';
  if (tag === 'nav' || /\bnav\b|navbar|navigation/.test(hay)) return 'nav';
  if (/hero|banner|jumbotron|showcase/.test(hay)) return 'hero';
  if (/pricing|tier|price-plan/.test(hay)) return 'pricing';
  if (/testimonial|review|quote/.test(hay)) return 'testimonial';
  if (/cta|get-started|signup|sign-up|start-free|try-free/.test(hay)) return 'cta';
  if (/feature|benefit|advantage|why-/.test(hay)) return 'feature';
  if (/product|gallery|card-grid|portfolio/.test(hay)) return 'product';
  if (tag === 'header') return 'nav';
  if (tag === 'main') return 'content';

  return 'other';
}

/** 归一化文本对齐。未知值（start / justify / 空串）一律落到 left。 */
export function normalizeAlignment(textAlign: string): LayoutBlock['alignment'] {
  if (textAlign === 'center') return 'center';
  if (textAlign === 'right' || textAlign === 'end') return 'right';
  return 'left';
}

/**
 * 按「同一行的子元素个数」推断列数。
 *
 * `childTops` 是文档绝对坐标，同一行的子元素 top 相同（允许 ±tolerance 误差）。
 * 取任意一行里最密集的那一排的计数。
 */
export function countColumns(childTops: number[], tolerance: number): number {
  if (childTops.length === 0) return 1;

  let best = 1;
  for (const anchor of childTops) {
    let same = 0;
    for (const top of childTops) {
      if (Math.abs(top - anchor) <= tolerance) same += 1;
    }
    if (same > best) best = same;
  }
  return best;
}

/**
 * 纯容器标签 —— 它们是**包裹层**而不是区块。
 *
 * 真机教训（Apple）：`<main>` 高 5011px，内部还套着 hero(2100) / product(957)。
 * 若把 main 也算作一个区块，它和内部区块会被同时保留，
 * 导致 `heightWeight` 总和达到 **200%** —— 模型会以为页面有两倍高。
 */
const CONTAINER_TAGS = new Set(['main']);

/**
 * 过滤噪音 + 去嵌套，产出**互不重叠的顶层区块序列**。
 *
 * 两步：
 * 1. 丢弃过矮的噪音（`height < minHeight`），并排除 {@link CONTAINER_TAGS}
 * 2. 按 `top` 升序贪心选取：跳过任何被已选区块覆盖的区块（即嵌套在内部的那层）
 *
 * 同 `top` 时高度大的排前面，保证外层优先进来、内层被跳过。
 *
 * 这样产出的序列满足：`heightWeight` 之和 ≤ 100。
 */
export function filterSections(sections: RawSection[], minHeight: number): RawSection[] {
  const candidates = sections
    .filter((s) => s.height >= minHeight)
    .filter((s) => !CONTAINER_TAGS.has(s.tag))
    .slice()
    .sort((a, b) => a.top - b.top || b.height - a.height);

  const out: RawSection[] = [];
  let coveredTo = Number.NEGATIVE_INFINITY;

  for (const s of candidates) {
    // top 落在已选区块的覆盖区间内 → 是内部嵌套层，跳过
    if (s.top < coveredTo) continue;
    out.push(s);
    coveredTo = s.top + s.height;
  }

  return out;
}

/** 把原始几何组装成 LayoutProbeResult。纯函数，不碰浏览器。 */
export function buildLayoutResult(
  raw: RawLayoutProbe,
  options: LayoutProbeOptions = {},
): LayoutProbeResult {
  const maxSections = options.maxSections ?? DEFAULT_MAX_SECTIONS;
  const minSectionHeight = options.minSectionHeight ?? DEFAULT_MIN_SECTION_HEIGHT;
  const fullBleedRatio = options.fullBleedRatio ?? DEFAULT_FULL_BLEED_RATIO;
  const rowTolerance = options.rowTolerance ?? DEFAULT_ROW_TOLERANCE;

  const kept = filterSections(raw.sections, minSectionHeight)
    .slice()
    .sort((a, b) => a.top - b.top)
    .slice(0, maxSections);

  const docHeight = raw.docHeight || 0;

  const flow: LayoutBlock[] = kept.map((s) => ({
    role: inferSectionRole(s.tag, s.className, s.id),
    heightWeight: docHeight > 0 ? Math.round((s.height / docHeight) * 100) : 0,
    heightPx: s.height,
    columns: countColumns(s.childTops, rowTolerance),
    alignment: normalizeAlignment(s.textAlign),
    fullBleed: s.width >= raw.viewport.width * fullBleedRatio,
  }));

  // 主内容区 = 第一个既不是导航也不是页脚的区块
  const mainIndex = flow.findIndex((b) => b.role !== 'nav' && b.role !== 'footer');
  const gridColumns = mainIndex >= 0 ? flow[mainIndex].columns : 0;

  // centered：比较主内容区左右两侧的余量
  let centered = false;
  if (mainIndex >= 0 && raw.viewport.width > 0) {
    const main = kept[mainIndex];
    const leftGutter = main.left;
    const rightGutter = raw.viewport.width - (main.left + main.width);
    centered = leftGutter > 0 && Math.abs(leftGutter - rightGutter) <= 8;
  }

  return {
    flow,
    gridColumns,
    stickyHeader: raw.stickyHeader,
    centered,
    viewport: raw.viewport,
    docHeight,
  };
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

/**
 * 实测页面几何。
 *
 * ⚠️ **调用顺序约束**：必须在任何交互采集（点击 / 滚动 / 展开菜单）**之前**执行。
 * 交互会改变页面状态，之后再测出来的几何是脏的。
 */
export async function probeLayout(
  page: PageController,
  options?: LayoutProbeOptions,
): Promise<LayoutProbeResult> {
  const raw = await page.evaluate<RawLayoutProbe>(collectGeometry);
  return buildLayoutResult(raw, options);
}
