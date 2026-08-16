/**
 * Design Mode System — EnhancementPlan 规范化
 */

import type { EnhancementPlan, EnhancementItem } from '@/types/agent';

const VALID_CATEGORIES = new Set([
  'layout', 'typography', 'image', 'animation', 'spacing', 'component', 'color',
]);

/** 规范化 AI 返回的 EnhancementPlan，保证字段可用。 */
export function normalizeEnhancementPlan(raw: unknown): EnhancementPlan {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const preserveSrc = (obj.preserve && typeof obj.preserve === 'object'
    ? obj.preserve
    : {}) as Record<string, unknown>;

  const preserve = {
    layout: typeof preserveSrc.layout === 'string' && preserveSrc.layout.trim()
      ? preserveSrc.layout.trim()
      : '保持原有布局结构',
    style: typeof preserveSrc.style === 'string' && preserveSrc.style.trim()
      ? preserveSrc.style.trim()
      : '保持原有设计风格',
  };

  const rawImprove = Array.isArray(obj.improve) ? obj.improve : [];
  const improve: EnhancementItem[] = rawImprove
    .map((it) => {
      const item = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
      const category = typeof item.category === 'string' && VALID_CATEGORIES.has(item.category)
        ? (item.category as EnhancementItem['category'])
        : 'layout';
      const before = typeof item.before === 'string' ? item.before.trim() : '';
      const after = typeof item.after === 'string' ? item.after.trim() : '';
      return after ? { category, before, after } : null;
    })
    .filter((it): it is EnhancementItem => it !== null)
    .slice(0, 10);

  return { preserve, improve };
}
