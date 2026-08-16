/**
 * Premium Code Generation Rules — Rules Engine
 * 在 Code Agent 生成前注入 Premium Design Rules（审美约束层）。
 * 流程：Design System → Rules Engine ⭐ → Code Agent
 */

import {
  PREMIUM_GENERATION_RULES,
  PREMIUM_RULES,
  isGradientAllowed,
} from './premium-rules';

// ---------------------------------------------------------------------------
// Code Agent System Prompt 升级（规范第十六节）
// ---------------------------------------------------------------------------

/**
 * Code Agent 身份升级提示词。
 * 从"根据截图写网页"升级为"根据设计原则生成商业级网页"。
 */
export function buildPremiumIdentityPrompt(): string {
  return `## 🎨 高级设计工程师身份
你现在不是普通前端开发 AI。你是一名高级网页设计工程师。
生成网页时必须遵守 Premium Design Rules。

禁止：
1. 大量 Card 组件堆叠
2. 默认 SaaS 后台布局
3. 随机渐变
4. 过度圆角
5. 无意义 Icon
6. 过多按钮

必须：
1. 一个页面最多三个视觉重点
2. Hero 占页面 40% 以上
3. 图片优先
4. 留白优先
5. 高质量真实素材
6. 动画少而精准
7. 保持品牌设计语言

如果组件数量过多，优先合并。如果内容过密，优先减少。
目标：生成类似 Apple、Linear、Stripe、Tesla 级别的商业网站。`;
}

// ---------------------------------------------------------------------------
// Premium Rules 上下文（注入 Code Agent user message）
// ---------------------------------------------------------------------------

/**
 * 将 Premium Design Rules 格式化为可注入的上下文。
 * 风格感知：根据匹配的设计体系决定是否允许渐变。
 */
export function formatPremiumRulesContext(styleName?: string): string {
  const gradientAllowed = isGradientAllowed(styleName);
  const lines: string[] = [];

  lines.push('## 📐 Premium Design Rules（高级设计规则，必须遵守）');
  lines.push('');

  // 禁止事项
  lines.push('### 禁止 (Forbidden)');
  const forbiddenLabels: Record<string, string> = {
    excessive_cards: '大量 Card 组件堆叠（模板化、信息平级）',
    random_gradient: gradientAllowed ? '与品牌无关的随机渐变（本设计体系允许品牌渐变）' : '任何随机渐变（本设计体系禁止渐变）',
    too_many_icons: '无意义 Icon 堆砌（每个 Feature 一个 Icon）',
    heavy_shadow: '过重的阴影',
    small_hero: '过小的 Hero（< 40vh，缺乏视觉冲击）',
    template_layout: '模板化布局（Navbar→Hero→4Card→6Card→3Card→Footer）',
  };
  for (const f of PREMIUM_GENERATION_RULES.forbidden) {
    lines.push(`- ${forbiddenLabels[f] || f}`);
  }
  lines.push('');

  // 必须事项
  lines.push('### 必须 (Mandatory)');
  const mandatoryLabels: Record<string, string> = {
    hero_first: 'Hero 优先，占页面 40%-80%（推荐 60vh），含视觉主体+核心标题+行动按钮',
    image_priority: '图片优先：视觉优先级 Image → Headline → Interaction → Text',
    large_spacing: '大留白：Section 间距 ≥80px，Hero 内边距 120px+，内容宽度 ≤1200px',
    clear_hierarchy: '清晰层级：Primary Focus → Secondary → Supporting，最多 3 个视觉重点',
    premium_typography: '高级字体：建立 H1/H2/Body/Button 清晰字阶，克制字重',
  };
  for (const m of PREMIUM_GENERATION_RULES.mandatory) {
    lines.push(`- ${mandatoryLabels[m] || m}`);
  }
  lines.push('');

  // 硬性限制
  lines.push('### 硬性限制 (Limits)');
  lines.push(`- 视觉重点 ≤ ${PREMIUM_GENERATION_RULES.limits.max_visual_focus} 个`);
  lines.push(`- Card 数量 ≤ ${PREMIUM_GENERATION_RULES.limits.max_cards} 个（仅用于补充内容）`);
  lines.push(`- Hero 最小高度 ${PREMIUM_GENERATION_RULES.limits.hero_min_height}`);
  lines.push(`- 圆角 8-20px（禁止 40px+ 和药丸按钮）`);
  lines.push(`- 每个 Section Icon ≤ 3 个（仅辅助理解/导航/状态）`);
  lines.push(`- 动效 ≤ 3 种（Fade/Slide/Scale/Parallax，时长 ~300ms）`);
  lines.push('');

  // 组件选型指引
  lines.push('### 组件选型指引');
  lines.push('- Hero：HeroSection / ProductShowcase / ImmersiveBanner');
  lines.push('- Feature：SplitLayout / ImageTextSection / Timeline / Gallery（不要用 CardGrid）');
  lines.push('- 数据：LargeNumber / Chart / Visualization（不要用 StatisticCard 堆叠）');
  lines.push('- 发现 4+ Card 的 CardGrid 时，改写为 <section><Image/><Text/></section> 叙事结构');

  return lines.join('\n');
}
