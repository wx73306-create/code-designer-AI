// =====================================================================
// Design Rules Library — Design Critic Agent 评审规则库
// 规则注入 Critic 提示词，指导 AI 做出专业设计判断
// =====================================================================

export interface DesignRule {
  id: string;
  name: string;
  category: 'layout' | 'visual' | 'typography' | 'color' | 'asset';
  severity: 'error' | 'warning';
  /** 违规描述 — 什么样的设计会触发该规则 */
  violation: string;
  /** 优化建议 — 正确的做法 */
  recommendation: string;
  /** 示例 */
  example?: string;
}

// =====================================================================
// 核心规则集 (V1.0 — 5 条)
// =====================================================================

export const DESIGN_RULES: DesignRule[] = [
  {
    id: 'RULE-001',
    name: '避免卡片堆叠',
    category: 'layout',
    severity: 'error',
    violation: '页面出现大量重复的 feature card（超过 4-6 个同构卡片并列），信息密度过高，视觉疲劳',
    recommendation: '提炼 3 个核心 feature，用大尺寸视觉区块替代密集卡片网格；次要信息折叠或移至子页面',
    example: '错误：10 个 feature card 平铺 → 正确：3 个核心 feature 大区块 + 辅助链接',
  },
  {
    id: 'RULE-002',
    name: 'Hero 优先',
    category: 'layout',
    severity: 'error',
    violation: 'Hero 区域过小（低于视口 40%），首屏被导航、公告、密集内容挤占',
    recommendation: 'Hero 占页面首屏 40%-60%，确保第一视觉焦点清晰；大标题 + 主视觉 + 双 CTA',
    example: '正确：全视口 Hero，居中 60px+ 标题，产品图占位 50% 高度',
  },
  {
    id: 'RULE-003',
    name: '减少圆角',
    category: 'visual',
    severity: 'warning',
    violation: '使用过大圆角（border-radius > 24px），产生廉价模板感',
    recommendation: '推荐 12-20px 圆角；按钮可用 rounded-full，但容器/卡片保持克制',
    example: '禁止：border-radius: 40px → 推荐：12-20px',
  },
  {
    id: 'RULE-004',
    name: '减少渐变',
    category: 'color',
    severity: 'warning',
    violation: '使用随机彩色渐变（多色 rainbow gradient、与品牌无关的紫粉渐变），AI 生成感强烈',
    recommendation: '仅在品牌色体系内使用微妙渐变（同色系明度变化）；优先纯色 + 光影层次',
    example: '禁止：linear-gradient(135deg, #667eea, #764ba2, #f093fb) → 推荐：单色背景 + subtle radial highlight',
  },
  {
    id: 'RULE-005',
    name: '增加真实视觉资产',
    category: 'asset',
    severity: 'warning',
    violation: '使用占位色块、emoji 图标、低质量素材充当主视觉',
    recommendation: '优先使用产品实拍图、专业摄影图、3D 渲染模型；图片区域保持正确宽高比和高质量',
    example: '正确：产品渲染图 + 场景摄影 + 细节特写三层视觉资产',
  },
];

// =====================================================================
// 评分维度定义 (高级感评分模型 — 总分 100)
// =====================================================================

export interface ScoreDimension {
  key: 'layout' | 'typography' | 'color' | 'image' | 'premium';
  label: string;
  maxScore: number;
  criteria: string[];
}

export const SCORE_DIMENSIONS: ScoreDimension[] = [
  {
    key: 'layout',
    label: '布局',
    maxScore: 20,
    criteria: ['视觉平衡', '留白节奏', '信息密度', '网格一致性'],
  },
  {
    key: 'typography',
    label: '字体',
    maxScore: 20,
    criteria: ['标题比例', '字重层次', '行距舒适度', '字体品质'],
  },
  {
    key: 'color',
    label: '颜色',
    maxScore: 20,
    criteria: ['主色明确', '对比度', '层次分明', '品牌一致'],
  },
  {
    key: 'image',
    label: '图片',
    maxScore: 20,
    criteria: ['图片质量', '主视觉冲击力', '宽高比规范', '加载策略'],
  },
  {
    key: 'premium',
    label: '高级感',
    maxScore: 20,
    criteria: ['非模板感', '非 AI 感', '细节打磨', '品牌调性'],
  },
];

// =====================================================================
// Prompt 注入格式化
// =====================================================================

/** 将规则库格式化为可注入 AI 提示词的文本 */
export function formatDesignRules(): string {
  const lines = DESIGN_RULES.map(
    (r) =>
      `${r.id} [${r.name}] (${r.severity === 'error' ? '禁止' : '警告'})\n` +
      `  违规: ${r.violation}\n` +
      `  要求: ${r.recommendation}` +
      (r.example ? `\n  示例: ${r.example}` : '')
  );
  return `## 设计评审规则库\n\n${lines.join('\n\n')}`;
}

/** 将评分维度格式化为提示词文本 */
export function formatScoreModel(): string {
  const dims = SCORE_DIMENSIONS.map(
    (d) => `- ${d.label} (${d.maxScore}分): 检查 ${d.criteria.join('、')}`
  );
  return `## 高级感评分模型 (总分100)\n\n${dims.join('\n')}`;
}
