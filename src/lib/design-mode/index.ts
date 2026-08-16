/**
 * Design Mode System — Public API
 * 统一导出模式配置、增强规则、模式提示词与规范化工具。
 */

export {
  GENERATION_MODES,
  DEFAULT_MODE,
  ENHANCEMENT_RULES,
} from './mode-config';
export type { GenerationModeConfig, EnhancementRule } from './mode-config';

export {
  buildModeControlPrompt,
  formatEnhancementPlanContext,
  buildEnhancementSystemPrompt,
  buildEnhancementUserMessage,
} from './mode-prompts';

export { normalizeEnhancementPlan } from './schema';
