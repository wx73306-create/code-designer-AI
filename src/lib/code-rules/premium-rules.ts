/**
 * Premium Code Generation Rules — 规则数据
 * 高级网页代码生成规则系统（开发规范 V1.0）。
 * 给 Code Agent 增加"高级 UI 设计师的审美约束层"。
 */

// ---------------------------------------------------------------------------
// 顶级规则文件（premium-generation-rules.json 的 TypeScript 形态）
// ---------------------------------------------------------------------------

export const PREMIUM_GENERATION_RULES = {
  forbidden: [
    'excessive_cards',    // 大量 Card 组件堆叠
    'random_gradient',    // 随机渐变
    'too_many_icons',     // 无意义 Icon
    'heavy_shadow',       // 过重阴影
    'small_hero',         // 过小的 Hero
    'template_layout',    // 模板化布局（Navbar→Hero→4Card→6Card→3Card→Footer）
  ],
  mandatory: [
    'hero_first',          // Hero 优先
    'image_priority',      // 图片优先
    'large_spacing',       // 大留白
    'clear_hierarchy',     // 清晰层级
    'premium_typography',  // 高级字体
  ],
  limits: {
    max_visual_focus: 3,   // 一个页面最多 3 个视觉重点
    max_cards: 3,          // 一个页面最多 3 个 Card
    hero_min_height: '40%',
  },
} as const;

// ---------------------------------------------------------------------------
// 详细规则（逐条，供 Validator 检测与提示词引用）
// ---------------------------------------------------------------------------

export type RuleCategory = 'component' | 'layout' | 'visual' | 'typography' | 'asset' | 'animation';

export interface PremiumRule {
  id: string;
  category: RuleCategory;
  name: string;
  rule: string;
  /** 用于 Validator 检测的特征 */
  detect?: {
    type: 'card-count' | 'radius' | 'gradient' | 'hero-height' | 'icon-count';
    threshold?: number;
  };
}

export const PREMIUM_RULES: PremiumRule[] = [
  // ---- Component Rules ----
  {
    id: 'COMP-001',
    category: 'component',
    name: '禁止组件堆叠',
    rule: '页面组件必须有层级：Primary Focus → Secondary Content → Supporting Content。禁止大量平级 Card 堆叠（信息平级、没有主次、缺少叙事）。',
    detect: { type: 'card-count', threshold: 6 },
  },
  {
    id: 'COMP-002',
    category: 'component',
    name: 'Card 使用限制',
    rule: '一个页面最多 3 个 Card，且只能用于 Supporting Content。Feature 区域优先使用 SplitLayout / ImageTextSection / Timeline / Gallery，数据展示用 LargeNumber / Chart，而非 StatisticCard 堆叠。',
    detect: { type: 'card-count', threshold: 3 },
  },
  {
    id: 'COMP-003',
    category: 'component',
    name: '视觉重点限制',
    rule: '一个页面最多 3 个视觉重点（Hero / Main Product / CTA）。禁止 Hero 之后连续 5 个平级 Feature。',
  },
  {
    id: 'COMP-004',
    category: 'component',
    name: '组件替换规则',
    rule: '发现 CardGrid（4+ Card）时自动转换为 Editorial Layout：<section><Image/><Text/></section> 叙事结构。',
  },

  // ---- Layout Rules ----
  {
    id: 'LAY-001',
    category: 'layout',
    name: 'Hero 高度规则',
    rule: 'Hero 必须占页面高度 40%-80%（推荐 60vh）。禁止 300px 这类没有视觉冲击的小 Hero。',
    detect: { type: 'hero-height', threshold: 40 },
  },
  {
    id: 'LAY-002',
    category: 'layout',
    name: 'Hero 结构规则',
    rule: 'Hero 必须包含：至少 1 个视觉主体（Image）+ 1 个核心标题（Headline）+ 1 个行动按钮（Action）。',
  },
  {
    id: 'LAY-003',
    category: 'layout',
    name: '留白优先',
    rule: 'Section 之间最小间距 80px，Hero 内边距 120px+，内容最大宽度 1200px。高级设计的核心是空间控制，不是更多内容。',
  },

  // ---- Visual Rules ----
  {
    id: 'VIS-001',
    category: 'visual',
    name: '禁止随机渐变',
    rule: '禁止 purple→blue→pink 这类廉价渐变。仅当设计体系为 Stripe / Gaming / Futuristic 时允许品牌渐变。',
    detect: { type: 'gradient' },
  },
  {
    id: 'VIS-002',
    category: 'visual',
    name: '禁止过度圆角',
    rule: '圆角默认 12px，最大 20px。禁止 border-radius:40px（儿童 App 感）和按钮 9999px 药丸圆角（标签除外）。',
    detect: { type: 'radius', threshold: 20 },
  },
  {
    id: 'VIS-003',
    category: 'visual',
    name: '禁止随机 Icon',
    rule: 'Icon 只能用于：辅助理解 / 导航 / 状态提示。禁止"每个 Feature 一个 Icon"（🚀快速 🔥高效 ⭐强大 💎高级 = 国产 SaaS 风）。每个 Section 最多 3 个 Icon。',
    detect: { type: 'icon-count', threshold: 3 },
  },
  {
    id: 'VIS-004',
    category: 'visual',
    name: '图片优先原则',
    rule: '视觉优先级：Image → Headline → Interaction → Text。优先产品图 / 真实摄影 / 3D 模型 / 高质量插画；禁止随机 AI 插图、低质量 icon、无意义背景。',
  },

  // ---- Animation Rules ----
  {
    id: 'ANI-001',
    category: 'animation',
    name: '动画少而精准',
    rule: '动画原则：少、慢、精准。允许 Fade / Slide / Scale / Parallax；禁止无限旋转、疯狂弹跳、自动闪烁。单页动效最多 3 种，时长约 300ms。',
  },
];

// ---------------------------------------------------------------------------
// 风格感知的渐变许可
// ---------------------------------------------------------------------------

/** 允许使用品牌渐变的设计体系 */
export const GRADIENT_ALLOWED_STYLES = ['stripe', 'gaming', 'futuristic', 'cyber'];

export function isGradientAllowed(styleName?: string): boolean {
  if (!styleName) return false;
  const lower = styleName.toLowerCase();
  return GRADIENT_ALLOWED_STYLES.some((s) => lower.includes(s));
}
