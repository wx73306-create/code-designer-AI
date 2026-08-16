/**
 * Web Design Knowledge Base — Public API
 * 统一导出风格档案、匹配器、设计系统生成器和格式化工具。
 */

export { STYLE_PROFILES, getProfileById, getAllProfileIds } from './style-profiles';
export type { StyleProfile } from './style-profiles';

export { calculateStyleScore, matchStyle } from './style-matcher';
export type { StyleMatcherInput } from './style-matcher';

export { generateDesignSystem, formatStyleContext, formatStyleContextCompact } from './design-system';
