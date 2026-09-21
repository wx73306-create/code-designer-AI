/**
 * element-detector — 候选交互元素提取
 * ===================================================================
 * 目标：不是「找到所有 button 就点」，而是先圈出**值得交互的**元素。
 *
 * 分层：
 *   - DOM 查询在浏览器上下文执行（本文件的 ELEMENT_SCAN_SCRIPT）
 *   - 过滤 / 去重 / 排序在 Node 侧执行（本文件的纯函数）——这部分可单测
 */

import type { DetectedElement, ElementType } from './types';

/** 浏览器侧扫描脚本：返回原始候选元素列表。 */
export const ELEMENT_SCAN_SCRIPT = `(() => {
  const SEL = 'button, a[href], [role=button], [role=tab], [aria-expanded], summary, select';
  const nodes = Array.from(document.querySelectorAll(SEL));
  const out = [];
  for (let i = 0; i < nodes.length && out.length < 120; i++) {
    const el = nodes[i];
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const visible = rect.width > 0 && rect.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
    if (!visible) continue;
    const ariaExpanded = el.getAttribute('aria-expanded');
    out.push({
      tag: (el.tagName || '').toLowerCase(),
      // 图标类按钮（Apple 的 globalnav 菜单按钮）没有 textContent，
      // 只有 aria-label —— 不回退的话 interaction.json 里的 target.text 全是空串
      text: ((el.textContent || '').trim() || el.getAttribute('aria-label') || '').trim().slice(0, 80),
      id: el.id || '',
      cls: typeof el.className === 'string' ? el.className.trim() : '',
      href: el.getAttribute('href') || '',
      role: el.getAttribute('role') || '',
      ariaExpanded: ariaExpanded === null ? null : ariaExpanded === 'true',
      ariaHaspopup: el.getAttribute('aria-haspopup') || '',
      inHeaderNav: !!el.closest('header nav, nav'),
      inFooter: !!el.closest('footer'),
      isSubmit: (el.getAttribute('type') || '') === 'submit' || !!el.closest('form'),
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
      // 供 selector 生成优先级使用
      dataAttrs: Array.from(el.attributes).filter(a => a.name.startsWith('data-')).slice(0, 2).map(a => a.name),
    });
  }
  return out;
})()`;

/** 浏览器扫描返回的原始形状（未分级）。 */
export interface RawElement {
  tag: string;
  text: string;
  id: string;
  cls: string;
  href: string;
  role: string;
  ariaExpanded: boolean | null;
  ariaHaspopup: string;
  inHeaderNav: boolean;
  inFooter: boolean;
  isSubmit: boolean;
  x: number;
  y: number;
  dataAttrs: string[];
}

/**
 * 推断元素语义类型。
 *
 * 判定顺序按「信号强度」从强到弱：`aria-expanded` 与 `role=tab`
 * 是开发者显式声明的，比 class 名可靠得多。
 */
export function inferElementType(raw: RawElement): ElementType {
  if (raw.role === 'tab') return 'tab';
  if (raw.ariaExpanded !== null) {
    // aria-expanded + 在导航内 → 菜单；否则多半是手风琴
    return raw.inHeaderNav ? 'menu' : 'accordion';
  }
  if (raw.ariaHaspopup === 'true' || raw.ariaHaspopup === 'menu' || raw.ariaHaspopup === 'listbox') {
    return 'dropdown';
  }
  if (raw.tag === 'summary') return 'accordion';
  if (raw.tag === 'select') return 'select';
  if (raw.inHeaderNav && raw.tag === 'a') return 'nav';
  if (raw.tag === 'a') return 'link';
  if (raw.tag === 'button') return 'button';
  return 'unknown';
}

/**
 * 框架运行时生成的 id 特征（React 18 `useId` / Radix / Base UI）。
 *
 * 这类 id 每次渲染都会变（真机在 linear.app 采到 `#base-ui-_R_3apaki1lqiplei_`），
 * 写进 interaction.json 后**无法复现** —— Sprint 3 的 Code / Animation Agent
 * 拿到它定位不到任何元素。宁可退化到 `tag.class` 也不要用它。
 */
const GENERATED_ID = /(^|[_-])_R_|^:[a-z0-9]+:$|^(radix|base-ui|headlessui)-/i;

/** id 是否稳定到可以写进交付产物。 */
export function isStableId(id: string): boolean {
  if (!id) return false;
  return !GENERATED_ID.test(id);
}

/**
 * 生成一个可再次定位的 selector。
 *
 * 优先级：`#id`（仅限稳定 id） > `[data-*]` > `tag.class（取前 2 个 class）` > `tag`。
 * 刻意不用 nth-child —— 页面结构一变就定位错。
 */
export function buildSelector(raw: RawElement): string {
  if (isStableId(raw.id)) return `#${raw.id}`;

  if (raw.dataAttrs.length > 0) {
    // 只用属性名做存在性匹配，避免值里含引号导致 selector 失效
    return `${raw.tag}[${raw.dataAttrs[0]}]`;
  }

  const classes = raw.cls.split(/\s+/).filter(Boolean).slice(0, 2);
  if (classes.length > 0) {
    return `${raw.tag}.${classes.join('.')}`;
  }
  return raw.tag;
}

/**
 * 把浏览器返回的原始列表整理成候选元素（**尚未分级**，风险由 policy 填）。
 *
 * 去重：同 selector + 同 text 只保留第一个——页面上同一组件常重复出现，
 * 全点一遍既浪费又容易触发副作用。
 */
export function normalizeElements(raws: RawElement[]): Array<Omit<DetectedElement, 'risk'>> {
  const seen = new Set<string>();
  const out: Array<Omit<DetectedElement, 'risk'>> = [];

  raws.forEach((raw, i) => {
    const selector = buildSelector(raw);
    const text = raw.text || '';
    const key = `${selector}::${text}`;
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      id: `element-${String(i + 1).padStart(3, '0')}`,
      type: inferElementType(raw),
      text,
      selector,
      position: { x: raw.x, y: raw.y },
      visible: true,
      // 区域必须在扫描时就判定 —— 到了 Node 侧只剩 selector，无从判断
      region: raw.inFooter ? 'footer' : raw.inHeaderNav ? 'header' : 'main',
      ...(raw.href ? { href: raw.href } : {}),
      ...(raw.ariaExpanded !== null ? { ariaExpanded: raw.ariaExpanded } : {}),
    });
  });

  return out;
}

/**
 * 排序：优先「信号强、风险低、在首屏」的元素。
 *
 * 为什么要排序：一次采集最多点 6 次（安全策略上限），
 * 必须让最有可能产出有效交互的排在前面。
 */
export function rankElements(
  elements: Array<Omit<DetectedElement, 'risk'>>,
  options: { viewportHeight: number } = { viewportHeight: 900 },
): Array<Omit<DetectedElement, 'risk'>> {
  // 语义价值权重：aria 显式声明的交互最值得点
  const typeScore: Record<ElementType, number> = {
    menu: 100,
    tab: 95,
    dropdown: 90,
    accordion: 85,
    'modal-trigger': 80,
    nav: 60,
    select: 40,
    button: 30,
    link: 20,
    unknown: 0,
  };

  return [...elements].sort((a, b) => {
    const sa = typeScore[a.type] ?? 0;
    const sb = typeScore[b.type] ?? 0;
    if (sa !== sb) return sb - sa;

    // 同类型：首屏内优先（滚动到不可见区域点击容易采到空状态）
    const aIn = a.position.y >= 0 && a.position.y <= options.viewportHeight ? 0 : 1;
    const bIn = b.position.y >= 0 && b.position.y <= options.viewportHeight ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;

    return a.position.y - b.position.y;
  });
}
