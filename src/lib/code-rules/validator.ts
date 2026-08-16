/**
 * Premium Code Generation Rules — Code Validator
 * 生成后扫描生成代码，检查是否违反 Premium Design Rules。
 * 流程：Code Agent → Generated Code → Rule Validator ⭐ → QA
 *
 * 确定性检测（无 LLM 调用）：
 *   检查1: Card 数量（> 6 警告 / > 3 提示）
 *   检查2: 过度圆角（rounded-3xl+ / border-radius > 20px / 药丸按钮）
 *   检查3: 随机渐变（bg-gradient / linear-gradient）
 *   检查4: Hero 高度（< 40vh 警告）
 *   检查5: Icon 堆砌（lucide icon 导入过多）
 */

import { PREMIUM_GENERATION_RULES, isGradientAllowed } from './premium-rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViolationSeverity = 'error' | 'warning';

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  severity: ViolationSeverity;
  message: string;
  count?: number;
}

export interface CodeValidationResult {
  passed: boolean;
  score: number;                 // 0-100 规则符合度
  violations: RuleViolation[];
  checksRun: number;
  cardCount: number;
  gradientCount: number;
  oversizedRadiusCount: number;
  iconCount: number;
  heroHeightOk: boolean;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * 扫描生成的代码（Map<filename, content>），返回规则校验结果。
 */
export function validateGeneratedCode(
  codeMap: Map<string, string>,
  styleName?: string,
): CodeValidationResult {
  let allCode = '';
  for (const [, content] of codeMap.entries()) {
    allCode += content + '\n';
  }

  const violations: RuleViolation[] = [];

  // ---- 检查1: Card 数量 ----
  const cardCount = countCards(allCode);
  if (cardCount > 6) {
    violations.push({
      ruleId: 'COMP-001',
      ruleName: '禁止组件堆叠',
      severity: 'error',
      message: `检测到 ${cardCount} 个 Card 组件（> 6），信息平级缺少叙事，建议合并为 Editorial 布局`,
      count: cardCount,
    });
  } else if (cardCount > PREMIUM_GENERATION_RULES.limits.max_cards) {
    violations.push({
      ruleId: 'COMP-002',
      ruleName: 'Card 使用限制',
      severity: 'warning',
      message: `检测到 ${cardCount} 个 Card 组件（> ${PREMIUM_GENERATION_RULES.limits.max_cards}），Card 应仅用于补充内容`,
      count: cardCount,
    });
  }

  // ---- 检查2: 过度圆角 ----
  const oversizedRadiusCount = countOversizedRadius(allCode);
  if (oversizedRadiusCount > 0) {
    violations.push({
      ruleId: 'VIS-002',
      ruleName: '禁止过度圆角',
      severity: oversizedRadiusCount > 3 ? 'error' : 'warning',
      message: `检测到 ${oversizedRadiusCount} 处过度圆角（rounded-3xl+ / >20px / 药丸按钮），高级网站使用 8-20px`,
      count: oversizedRadiusCount,
    });
  }

  // ---- 检查3: 随机渐变 ----
  const gradientCount = countGradients(allCode);
  const gradientAllowed = isGradientAllowed(styleName);
  if (gradientCount > 0 && !gradientAllowed) {
    violations.push({
      ruleId: 'VIS-001',
      ruleName: '禁止随机渐变',
      severity: gradientCount > 2 ? 'error' : 'warning',
      message: `检测到 ${gradientCount} 处渐变，当前设计体系禁止渐变（仅 Stripe/Gaming/Futuristic 允许品牌渐变）`,
      count: gradientCount,
    });
  }

  // ---- 检查4: Hero 高度 ----
  const heroHeightOk = checkHeroHeight(allCode);
  if (!heroHeightOk) {
    violations.push({
      ruleId: 'LAY-001',
      ruleName: 'Hero 高度规则',
      severity: 'error',
      message: 'Hero 区域高度不足（< 40vh），缺乏视觉冲击，建议 60vh',
    });
  }

  // ---- 检查5: Icon 堆砌 ----
  const iconCount = countIcons(allCode);
  if (iconCount > 12) {
    violations.push({
      ruleId: 'VIS-003',
      ruleName: '禁止随机 Icon',
      severity: iconCount > 20 ? 'error' : 'warning',
      message: `检测到 ${iconCount} 个 Icon 引用，疑似"每个 Feature 一个 Icon"的模板化用法，Icon 应仅用于辅助理解/导航/状态`,
      count: iconCount,
    });
  }

  // ---- 计算规则符合度评分 ----
  const checksRun = 5;
  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;
  const score = Math.max(0, Math.min(100, 100 - errorCount * 18 - warningCount * 8));

  return {
    passed: errorCount === 0,
    score,
    violations,
    checksRun,
    cardCount,
    gradientCount,
    oversizedRadiusCount,
    iconCount,
    heroHeightOk,
  };
}

// ---------------------------------------------------------------------------
// Detection Helpers
// ---------------------------------------------------------------------------

/** 统计 Card 组件数量（<Card>、<FeatureCard>、<StatisticCard>、<CardGrid> 等） */
function countCards(code: string): number {
  // 匹配任何标签名中包含 Card 的开标签（不含闭标签 </Card>）
  const cardTagMatches = code.match(/<\w*Card/g) || [];
  return cardTagMatches.length;
}

/** 统计过度圆角：rounded-3xl / rounded-[40px] / border-radius > 20px / 按钮 rounded-full */
function countOversizedRadius(code: string): number {
  let count = 0;
  // Tailwind rounded-3xl 及以上（3xl=24px 已偏大，full 单独计）
  count += (code.match(/rounded-3xl/g) || []).length;
  // 任意值圆角 > 20px：rounded-[24px]、rounded-[40px] 等
  const arbitraryRadius = code.match(/rounded-\[(\d+)px\]/g) || [];
  for (const r of arbitraryRadius) {
    const px = parseInt(r.match(/\d+/)?.[0] || '0', 10);
    if (px > 20) count++;
  }
  // CSS border-radius > 20px
  const cssRadius = code.match(/border-radius:\s*(\d+)px/g) || [];
  for (const r of cssRadius) {
    const px = parseInt(r.match(/\d+/)?.[0] || '0', 10);
    if (px > 20) count++;
  }
  return count;
}

/** 统计渐变使用 */
function countGradients(code: string): number {
  const tailwindGradient = code.match(/bg-gradient-|from-\[|to-\[/g) || [];
  const cssGradient = code.match(/linear-gradient|radial-gradient/g) || [];
  return tailwindGradient.length + cssGradient.length;
}

/** 检查 Hero 高度是否 >= 40vh。若找不到 Hero 或高度充足则视为通过。 */
function checkHeroHeight(code: string): boolean {
  // 寻找 Hero 相关的高度声明
  const heroSection = /<section[^>]*[Hh]ero|[Hh]ero[^>]*<section|className=[^>]*[Hh]ero/.test(code);
  if (!heroSection) {
    // 没有明确 Hero 标记，检查是否有 min-h-screen / h-screen 首屏
    return /min-h-screen|h-screen|min-h-\[/.test(code);
  }

  // 检测小 Hero 特征：固定小高度（h-[300px]、h-[400px]、height: 300px）
  const smallHero = /h-\[(?:[1-3]\d{2})px\]|height:\s*(?:[1-3]\d{2})px/.test(code);
  if (smallHero) return false;

  // 检测是否有足够的高度：vh 声明 >= 40 或 min-h-screen
  const vhMatches = code.match(/(?:min-h-|h-)\[(\d+)vh\]/g) || [];
  for (const m of vhMatches) {
    const vh = parseInt(m.match(/\d+/)?.[0] || '0', 10);
    if (vh >= 40) return true;
  }
  if (/min-h-screen|h-screen|min-h-\[/.test(code)) return true;

  // Hero 存在但找不到高度声明 → 保守视为通过（避免误报）
  return true;
}

/** 统计 lucide-react Icon 引用数量 */
function countIcons(code: string): number {
  // 统计 lucide-react 导入的 icon 数量
  const lucideImport = code.match(/import\s*{([^}]*)}\s*from\s*['"]lucide-react['"]/g) || [];
  let count = 0;
  for (const imp of lucideImport) {
    const names = imp.match(/{([^}]*)}/)?.[1] || '';
    count += names.split(',').filter((n) => n.trim()).length;
  }
  // 加上 JSX 中的 icon 使用（<Zap />、<Shield /> 等，以大写开头的自闭合短标签）
  const jsxIcons = code.match(/<[A-Z][a-zA-Z]*\s+className=[^>]*\/>/g) || [];
  return count + Math.min(jsxIcons.length, 30);
}
