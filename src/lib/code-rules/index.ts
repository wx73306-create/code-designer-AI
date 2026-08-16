/**
 * Premium Code Generation Rules System — Public API
 * 统一导出规则数据、Rules Engine 与 Code Validator。
 */

export {
  PREMIUM_GENERATION_RULES,
  PREMIUM_RULES,
  GRADIENT_ALLOWED_STYLES,
  isGradientAllowed,
} from './premium-rules';
export type { PremiumRule, RuleCategory } from './premium-rules';

export {
  buildPremiumIdentityPrompt,
  formatPremiumRulesContext,
} from './rules-engine';

export { validateGeneratedCode } from './validator';
export type {
  CodeValidationResult,
  RuleViolation,
  ViolationSeverity,
} from './validator';
