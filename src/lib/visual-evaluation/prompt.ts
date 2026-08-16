/**
 * Visual Evaluation — Prompts
 * 视觉评价 Prompt（规范第十一节）+ 优化方案 Prompt。
 */

// ---------------------------------------------------------------------------
// Visual Evaluation Prompt（世界顶级网页设计评审专家）
// ---------------------------------------------------------------------------

/**
 * 构建视觉评价系统提示词。
 * AI 评价的是「视觉效果」而非代码。
 */
export function buildVisualEvaluationSystemPrompt(): string {
  return `你是一名世界顶级网页设计评审专家。

你的任务不是评价代码。
你的任务是评价网页视觉质量。

参考 Apple、Linear、Stripe、Tesla 等优秀网站的设计水准。

从以下六个维度评分（每项 0-100 分）：
1. layout_score（布局）：页面结构、对齐、比例、信息密度。优秀标准：Hero 视觉占比合理、内容层级清晰、左右平衡。扣分项：元素拥挤、布局混乱、视觉中心不明确。
2. visual_balance（视觉平衡）：图片文字比例、左右重量、空间分布。扣分项：一边大量文字另一边小图片等失衡情况。
3. spacing_score（空间）：留白、Padding、Margin、Section 距离。高级网站有大量呼吸感；元素贴在一起则低分。
4. color_score（颜色）：色彩一致性、对比度、品牌匹配。错误示例：Apple 风格却出现随机紫色渐变。
5. typography_score（字体）：标题比例、字重、行距、层级（H1/H2/Body/Button）。
6. premium_score（高级感）⭐ 最重要：像不像 Apple/Tesla/Linear/Stripe 的水准。加分因素：留白、真实图片、精致动画、统一字体、克制颜色。减分因素：模板感、卡片堆叠、廉价渐变、默认组件。

同时：
- 指出具体视觉问题（problems 数组，每个含 type 和 description）
- 给出可执行的修改方案
- 不要泛泛评价

必须严格输出如下 JSON（不要输出其他内容）：
{
  "scores": {
    "layout_score": 85,
    "visual_balance": 75,
    "spacing_score": 80,
    "color_score": 90,
    "typography_score": 88,
    "premium_score": 65
  },
  "problems": [
    { "type": "premium", "description": "页面过于模板化，大量卡片布局" },
    { "type": "spacing", "description": "内容区域间距不足" }
  ]
}`;
}

/**
 * 构建视觉评价用户消息。
 * 输入：网页预览 HTML + Design Analysis Report + Design System。
 */
export function buildVisualEvaluationUserMessage(
  previewHtml: string,
  designAnalysisSummary: string,
  designSystemSummary: string,
  round?: number,
): string {
  let msg = `请评价以下生成网页的视觉质量。\n\n`;

  msg += `## 网页渲染结果（HTML 结构）\n\`\`\`html\n${previewHtml.slice(0, 12000)}\n\`\`\`\n\n`;

  if (designAnalysisSummary) {
    msg += `## 原网页设计分析报告（Design Analysis Report）\n${designAnalysisSummary}\n\n`;
  }

  if (designSystemSummary) {
    msg += `## 匹配的设计体系（Design System）\n${designSystemSummary}\n\n`;
  }

  if (round && round > 1) {
    msg += `## 优化轮次\n这是第 ${round} 轮优化后的重新评分。请对比上一轮问题，确认是否已改善，并给出最新评分。\n\n`;
  }

  msg += `请输出 VisualScore JSON（含六维评分与具体问题）。`;
  return msg;
}

// ---------------------------------------------------------------------------
// Optimization Plan Prompt（Optimization Agent）
// ---------------------------------------------------------------------------

/**
 * 构建优化方案系统提示词。
 */
export function buildOptimizationPlanSystemPrompt(): string {
  return `你是一名资深前端视觉优化工程师。

根据视觉评分结果中暴露的问题，生成具体、可执行的代码优化方案。

优化原则：
- 针对 premium_score 低：减少卡片堆叠，改为叙事性 section；增强 Hero；使用真实图片；克制颜色；统一字体。
- 针对 layout_score 低：调整布局结构、对齐、比例、信息密度。
- 针对 color_score 低：统一配色，移除随机渐变，匹配品牌色。
- 针对 typography_score 低：放大标题、调整字重与行距、建立清晰层级。
- 针对 spacing_score 低：增加留白、Padding、Section 间距。

必须严格输出如下 JSON（不要输出其他内容）：
{
  "issues": [
    { "problem": "too many cards", "solution": "merge cards into storytelling section" },
    { "problem": "weak hero", "solution": "increase hero height to 70vh" }
  ]
}`;
}

/**
 * 构建优化方案用户消息。
 */
export function buildOptimizationPlanUserMessage(
  visualScoreJson: string,
  round: number,
): string {
  return `当前视觉评分结果（第 ${round} 轮）：\n${visualScoreJson}\n\n` +
    `请分析评分中暴露的视觉问题，生成 OptimizationPlan JSON（issues 数组，每项含 problem 与 solution）。`;
}
