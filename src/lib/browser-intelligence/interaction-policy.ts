/**
 * interaction-policy — 交互风险分级
 * ===================================================================
 * Sprint 2 不重写 Sprint 1 的 `DEFAULT_CLICK_SAFETY`，而是在其上加一层
 * **风险分级**：把「能不能点」从布尔判断升级为三档，
 * 让 click-explorer 知道「点之前要不要特别小心、点完怎么恢复」。
 *
 * 判定顺序刻意「先严后宽」：任何一条黑名单命中就是 BLOCKED，
 * 只有在明确符合白名单特征时才给 SAFE。
 */

import type { ClickSafetyPolicy, DetectedElement } from './types';
import { DEFAULT_CLICK_SAFETY, RISK } from './types';

/** 触发 BLOCKED 的文本关键词（Sprint 1 已冻结，这里只做匹配执行）。 */
function matchesTextBlacklist(text: string, patterns: string[]): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const pattern of patterns) {
    if (lower.includes(pattern.toLowerCase())) return pattern;
  }
  return null;
}

/** 粗略的 selector 包含匹配 —— 只处理 `tag`、`tag[attr=val]`、`.class` 这三类。 */
function matchesSelector(selector: string, patterns: string[]): string | null {
  const lower = selector.toLowerCase();
  for (const pattern of patterns) {
    const p = pattern.toLowerCase();
    // 完整片段匹配：'footer a' 应命中 'footer a.menu'，不应命中 'a'
    if (p.includes(' ') || p.includes('[') || p.includes('=')) {
      // 复合 selector：逐段比较，要求 selector 含有该片段
      const segments = p.split(/\s+/);
      if (segments.every((seg) => lower.includes(seg))) return pattern;
    } else if (lower.includes(p)) {
      return pattern;
    }
  }
  return null;
}

/**
 * 给单个元素定级。
 *
 * @returns 带 risk / riskReason 的完整 DetectedElement
 */
export function classifyElement(
  element: Omit<DetectedElement, 'risk'>,
  policy: ClickSafetyPolicy = DEFAULT_CLICK_SAFETY,
  options: { pageHost?: string } = {},
): DetectedElement {
  // ---- 1. 文本黑名单（最高优先级）----
  const badWord = matchesTextBlacklist(element.text, policy.excludeTextPatterns);
  if (badWord) {
    return { ...element, risk: RISK.BLOCKED, riskReason: `text-blacklist:${badWord}` };
  }

  // ---- 2. 区域黑名单 ----
  // 必须早于 selector 黑名单：detector 产出的 selector 不含祖先信息，
  // 靠 'footer a' 这类 selector 规则根本匹配不到（真机验证过的坑）。
  if (element.region === 'footer') {
    return { ...element, risk: RISK.BLOCKED, riskReason: 'region:footer' };
  }

  // ---- 3. selector 黑名单 ----
  const badSel = matchesSelector(element.selector, policy.excludeSelectors);
  if (badSel) {
    return { ...element, risk: RISK.BLOCKED, riskReason: `selector-blacklist:${badSel}` };
  }

  // ---- 3. 表单提交类：即便文本没命中黑名单也不点 ----
  if (element.type === 'select') {
    return { ...element, risk: RISK.CAUTION, riskReason: 'select-widget' };
  }

  // ---- 4. 明确安全的交互控件 ----
  const safeTypes = ['menu', 'tab', 'dropdown', 'accordion', 'modal-trigger', 'nav'];
  if (safeTypes.includes(element.type)) {
    return { ...element, risk: RISK.SAFE, riskReason: `type:${element.type}` };
  }

  // ---- 5. 外域链接：会跳走，需 history-back 恢复 ----
  if (element.href && options.pageHost) {
    try {
      const host = new URL(element.href, `https://${options.pageHost}`).hostname;
      if (host && host !== options.pageHost) {
        return { ...element, risk: RISK.CAUTION, riskReason: `external-link:${host}` };
      }
    } catch {
      return { ...element, risk: RISK.CAUTION, riskReason: 'unparsable-href' };
    }
  }

  // ---- 6. 其余一律谨慎 —— 宁可不点 ----
  return { ...element, risk: RISK.CAUTION, riskReason: 'default-caution' };
}

/** 是否允许点击（BLOCKED 之外都允许，但 CAUTION 需要恢复策略兜底）。 */
export function isClickable(element: DetectedElement): boolean {
  return element.risk !== RISK.BLOCKED;
}

/**
 * 从候选列表里挑出本次真正要点的元素。
 *
 * 排序沿用 detector 的 rankElements 结果（已按语义价值排序），
 * 这里只做「过滤 + 截断」。
 */
export function selectClickTargets(
  elements: DetectedElement[],
  policy: ClickSafetyPolicy = DEFAULT_CLICK_SAFETY,
): DetectedElement[] {
  const max = policy.maxClicks ?? 6;
  return elements.filter(isClickable).slice(0, max);
}

/**
 * 建议的恢复策略 —— 决定「点完之后怎么回到原状态」。
 *
 * 这个判断直接影响数据质量：恢复失败的话，后续候选元素会基于
 * 「已展开」的错误状态被点击，采到的全是脏数据。
 */
export function suggestRecovery(element: DetectedElement): import('./types').RecoveryStrategy {
  // toggle 类控件：再点一次即可收起
  if (element.type === 'menu' || element.type === 'accordion' || element.type === 'dropdown') {
    return { method: 're-click', selector: element.selector };
  }
  if (element.type === 'modal-trigger') {
    return { method: 'escape' };
  }
  // 导航/链接：可能真的跳走
  if (element.type === 'nav' || element.type === 'link') {
    return { method: 'history-back' };
  }
  return { method: 'reload' };
}
