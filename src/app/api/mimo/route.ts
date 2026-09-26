// =====================================================================
// /api/mimo — MiMo-V2.5 AI Integration for Workflow Steps
// =====================================================================

export const maxDuration = 300; // 5 minutes — preview step generates full HTML pages

import { NextRequest, NextResponse } from 'next/server';
import { callMiMo, callMiMoStream, type ModelConfig } from '@/lib/mimo';
import { scrapeWebsite } from '@/lib/website-scraper';
import { archivePackageIfEnabled, buildWebsitePackage, formatPackageContext, gatePackageForStep } from '@/lib/website-package';
import { applyLocalPaths, localizePackageAssetsIfEnabled, summarizeLocalize } from '@/lib/assets';
import { describeValidationErrors, inspectWebsitePackage } from '@/lib/schemas';
import {
  getInteractionPackage,
  getLayoutProbe,
  isInteractionCaptureEnabled,
  isLayoutProbeEnabled,
} from '@/lib/browser-intelligence';
import type { InteractionPackage, LayoutProbeResult } from '@/lib/browser-intelligence';
import { ANIMATION_SYSTEM_PROMPT, buildAnimationUserMessage } from '@/lib/animation';
import { matchDesignPatterns, formatKnowledgeContext } from '@/lib/design-knowledge';
import { buildVisualEvaluationUserMessage, buildOptimizationPlanUserMessage } from '@/lib/visual-evaluation';
import { buildPremiumIdentityPrompt, formatPremiumRulesContext } from '@/lib/code-rules';
import { buildModeControlPrompt, formatEnhancementPlanContext, buildEnhancementUserMessage, buildEnhancementSystemPrompt } from '@/lib/design-mode';
import { liveStats } from '@/lib/live-stats';
import { getRequestAuth } from '@/lib/admin-session';
import { normalizeVisualScore } from '@/lib/visual-evaluation/schema';
import { recordGenerationQuality } from '@/lib/migration/generation-ledger';
import { emitQaReport } from '@/lib/qa-report';
import { consumeQuotaByEmail } from '@/lib/quota';
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';

// ---- Website Package cache -------------------------------------------
// 采集一次，多个步骤共享。原先 scrapedData 是 vision 步骤的局部变量，
// 导致 planning / code 拿不到真实色值，只能靠 Vision 的文字描述去猜。
// WebsitePackage 作为唯一数据源后，这里做短期缓存避免重复抓取同一 URL。

type ScrapedResult = Awaited<ReturnType<typeof scrapeWebsite>>;

const scrapeCache = new Map<string, { data: ScrapedResult; ts: number }>();
const SCRAPE_CACHE_TTL_MS = 10 * 60 * 1000;
const SCRAPE_CACHE_MAX = 50;

async function getScraped(url: string): Promise<ScrapedResult | null> {
  const cached = scrapeCache.get(url);
  if (cached && Date.now() - cached.ts < SCRAPE_CACHE_TTL_MS) {
    return cached.data;
  }
  try {
    const data = await scrapeWebsite(url);
    scrapeCache.set(url, { data, ts: Date.now() });
    if (scrapeCache.size > SCRAPE_CACHE_MAX) {
      const oldest = scrapeCache.keys().next().value;
      if (oldest) scrapeCache.delete(oldest);
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * 交互采集（带缓存）。
 *
 * `planning` / `code` / `animation` 三个 step 都会调它，缓存保证**同一 URL
 * 只采一次浏览器** —— 不缓存的话一次生成要开三次（实测各 20-32s，共约 90s），
 * 而本路由 `maxDuration` 只有 300s。
 *
 * `INTERACTION_CAPTURE` 未开启时直接返回 `null`，零开销，链路行为与开启前一致。
 */
async function getInteraction(url: string): Promise<InteractionPackage | null> {
  if (!isInteractionCaptureEnabled()) return null;
  try {
    return await getInteractionPackage(url);
  } catch {
    // 采集层已保证不抛错，这里是最后一道保险
    return null;
  }
}

/**
 * 布局实测（带缓存）。
 *
 * 与 `getInteraction()` 同理：三个 step 都会调它，缓存保证**同一 URL 只开一次浏览器**
 * （实测首次约 2s，命中缓存约 1ms）。
 *
 * `LAYOUT_PROBE` 未开启时直接返回 `null` —— 此时 `layout.flow` 为空数组，
 * 语义是 **unknown（没测过）**，而不是旧的硬编码猜测值。
 */
async function getLayout(url: string): Promise<LayoutProbeResult | null> {
  if (!isLayoutProbeEnabled()) return null;
  try {
    return await getLayoutProbe(url);
  } catch {
    // 采集层已保证不抛错，这里是最后一道保险
    return null;
  }
}

// ---- Prompt Templates for each workflow step -------------------------

const SYSTEM_PROMPTS: Record<string, string> = {
  animation: ANIMATION_SYSTEM_PROMPT,
  vision: `# Role

你是一名世界级 Web Design Intelligence Analyst。

你拥有20年以上经验，同时具备：
- Senior UI/UX Designer
- Design System Architect
- Frontend Design Engineer
- Visual AI Researcher

你的任务不是描述网页内容，而是**逆向分析网页背后的设计系统**。

你的输出将被后续 AI Agent 用于：
- 网页复刻（Code Agent）
- 设计评审（Critic Agent）
- 架构规划（Planning Agent）
- Design Memory 存储


# Core Rules

必须遵守：

1. 不描述"有什么元素"。必须分析：
   - 为什么这样布局
   - 视觉目的是什么
   - 用户体验作用是什么

2. 所有 Design Token 必须来自提供的真实 CSS 数据。
   禁止：猜测颜色、编造字体、假设间距。

3. 如果无法确认某项分析，输出 "unknown" 并降低 confidence。

4. 每个核心判断必须附带 confidence（0-1）和 evidence 数组。


# Analysis Process（7 个阶段）

## Stage 1: Visual Structure（视觉结构）
分析：
- 页面整体布局方式（单栏/双栏/网格/混合）
- Hero 区域结构与占比
- Section 数量与排列方式
- 信息密度（高/中/低）
- 视觉中心位置

## Stage 2: Visual Hierarchy（视觉层级）
识别三个视觉焦点层级：
- Primary Focus（权重100）：最大/最醒目元素
- Secondary Focus（权重70-90）：次要视觉元素
- Tertiary Focus（权重30-50）：辅助视觉元素
分析依据：Size / Position / Contrast / Whitespace

## Stage 3: Design Language + Brand DNA（设计语言 + 品牌基因）
分析：
- Design Style（Apple Minimal / Cyber AI / Luxury / Gaming / Corporate / Editorial 等）
- Brand DNA：这个品牌的核心设计哲学是什么？
  例如 Apple 不只是"白色"，而是：极简主义 + 产品摄影驱动 + 情绪化留白 + 高端科技感
- Color System（primary/secondary/accent/background/foreground/neutral）
- Shape Language（圆角/直角/有机形态）
- Material Language（玻璃态/扁平/拟态/新拟态）

## Stage 4: Design Token Extraction（设计令牌提取）
从 CSS 真实数据中提取：
- Colors（按优先级排列：Primary > Secondary > Semantic > Unused）
- Typography（family/weight/size/lineHeight/letterSpacing）
- Spacing（从 margin/padding/gap 提取，建立 spacing rhythm）
- Border Radius
- Shadows（按层级：sm/md/lg/xl）
- Animations（transition/scroll-animation/parallax/hover-interaction/entrance）

## Stage 5: Component Intelligence（组件智能识别）
识别可复用组件：Navbar / Hero / Button / Card / Gallery / Carousel / Footer / Modal / FeatureGrid 等。
对每个组件分析：
- component purpose（设计目的）
- structure（结构描述）
- interaction（交互方式）

## Stage 6: Responsive Intelligence（响应式智能）
分析各断点下的布局变化：
- Desktop（>1024px）：布局方式
- Tablet（768-1024px）：布局变化
- Mobile（<768px）：布局变化

## Stage 7: Asset Intelligence（资产智能）
分析图片资产：
- 类型（产品摄影/场景摄影/插图/图标/3D渲染）
- 比例（aspect ratio）
- 使用目的（Hero主视觉/产品展示/背景/装饰）
- 情绪价值（品牌情感锚点）

如果缺少图片数据，在 missingData 中标注。


# Self Verification（输出前自检）

在输出 JSON 前必须执行 4 项检查：

CHECK 1: 所有 Token 是否来自真实 CSS 数据？
CHECK 2: 所有组件是否具有设计意义（不是无意义的 div）？
CHECK 3: 是否解释了视觉原因（不只是描述"有什么"）？
CHECK 4: 输出是否可以直接指导 React 组件生成？

如果任何 CHECK 不通过，修正后再输出。


# Output

严格以 JSON 格式返回，不要添加任何解释文字。

返回的 JSON 结构如下：
{
  "brandDNA": {
    "philosophy": "极简主义 + 产品摄影驱动 + 情绪化留白",
    "emotionalTone": "premium technology",
    "confidence": 0.92,
    "evidence": ["large whitespace", "product photography hero", "minimal color palette"]
  },
  "designStyle": {
    "value": "Apple Minimal",
    "confidence": 0.94,
    "evidence": ["large whitespace", "SF typography", "minimal color palette"]
  },
  "colors": [
    { "name": "Primary", "hex": "#0071E3", "usage": "主要按钮、链接、交互状态", "priority": "primary" },
    { "name": "Background", "hex": "#FFFFFF", "usage": "页面背景", "priority": "primary" }
  ],
  "typography": [
    { "name": "Heading", "family": "SF Pro Display", "weight": 600, "size": "48px", "lineHeight": "1.05", "letterSpacing": "-0.02em", "usage": "页面标题" },
    { "name": "Body", "family": "SF Pro Text", "weight": 400, "size": "17px", "lineHeight": "1.47", "usage": "正文" }
  ],
  "spacing": [4, 8, 12, 16, 24, 32, 48, 64, 80, 120],
  "borderRadius": [4, 8, 12, 16, 20],
  "shadows": [
    { "name": "sm", "value": "0 1px 2px rgba(0,0,0,0.05)" },
    { "name": "md", "value": "0 4px 6px rgba(0,0,0,0.07)" },
    { "name": "lg", "value": "0 12px 40px rgba(0,0,0,0.12)" }
  ],
  "animations": [
    { "name": "fadeIn", "type": "entrance", "property": "opacity", "duration": "0.3s", "easing": "ease-out" },
    { "name": "scrollReveal", "type": "scroll", "property": "transform", "duration": "0.6s", "easing": "ease-out" }
  ],
  "assets": [
    { "type": "product-photography", "purpose": "Hero 主视觉", "aspectRatio": "16:9", "emotionalValue": "品牌情感锚点" }
  ],
  "components": [
    {
      "name": "Hero",
      "type": "section",
      "purpose": "建立品牌第一印象",
      "layout": "centered",
      "height": "80vh",
      "elements": ["title", "description", "CTA"],
      "interaction": "scroll-triggered fade-in"
    }
  ],
  "layout": {
    "gridType": "12-column",
    "maxWidth": "1200px",
    "visualCenter": "hero-section",
    "sections": ["navbar", "hero", "features", "products", "footer"],
    "informationDensity": "low"
  },
  "responsive": {
    "desktop": "2-column hero, full grid",
    "tablet": "stacked hero, 2-column grid",
    "mobile": "single column, reduced font sizes"
  },
  "visualHierarchy": {
    "primary": { "element": "hero-title", "weight": 100, "reason": "largest typography, center position" },
    "secondary": { "element": "hero-cta-button", "weight": 85, "reason": "high contrast, action color" },
    "tertiary": { "element": "product-image", "weight": 60, "reason": "large visual, below fold" }
  },
  "qualityAssessment": {
    "visualBalance": 0.88,
    "premiumLevel": 0.92,
    "consistency": 0.90,
    "usability": 0.85
  },
  "missingData": [],
  "selfVerification": {
    "tokensFromCSS": true,
    "componentsMeaningful": true,
    "visualReasonsExplained": true,
    "readyForCodeGen": true
  }
}`,

  planning: `# Role

你是一名世界级 Frontend Architecture Planner（前端架构规划师）。

你同时具备：
- Senior React Architect（高级 React 架构师）
- Design System Engineer（设计系统工程师）
- UX Engineer（用户体验工程师）
- Web Reverse Engineering Specialist（网页逆向工程专家）

你曾负责 Apple、Stripe、Vercel 级别的产品网站架构设计。

你的任务不是简单复制 HTML 转 React。
你的任务是：**理解设计意图，建立商业级 React 前端工程架构。**

你的输出将被 Code Agent 直接消费来生成代码。


# Core Principle

设计意图优先（Visual Intent First）：

Visual Intent（视觉意图）
    ↓
Design Section（设计区块）
    ↓
Component Responsibility（组件职责）
    ↓
React Component（React 组件）
    ↓
File Structure（文件结构）

不是看到 \`<div class="hero">\` 就直接变成 \`Hero.tsx\`。
而是分析：Hero 承担什么设计目的？品牌展示？首屏转化？产品介绍？然后决定组件结构。


# Multi-Stage Reasoning（5 阶段推理）

## Stage 1: Understand Website Structure（理解网站结构）
DOM Intelligence：
- HTML 层级：body → header/main/footer → section/article → 子元素
- 语义结构：识别 Page / Section / Component / Element 层级
- 内容关系：父子关系、嵌套深度、组件边界
- CSS 布局：flex/grid/position、尺寸、间距、视觉效果

## Stage 2: Extract Design Intent（提取设计意图）
从 DOM 结构中理解每个区块的设计目的：
- 这个区块承担什么视觉作用？
- 它在用户浏览流程中的位置？
- 它与其他区块的关系？

## Stage 3: Create Component Architecture（创建组件架构）
创建组件必须满足 Component Boundary Rules（组件边界规则）：
至少满足以下一个条件才能成为独立组件：
1. 独立视觉区域（Independent Visual Area）
2. 独立交互逻辑（Independent Interaction）
3. 可复用模块（Reusable Module）
4. 独立响应式行为（Independent Responsive Behavior）

禁止：
- 过度拆分（如 ButtonText.tsx / ButtonIcon.tsx / ButtonColor.tsx）
- 巨型组件（一个组件超过合理复杂度）

组件命名必须表达设计意图：
- 错误：Card01 / Card02
- 正确：FeatureShowcase / ProductStorySection

## Stage 4: Map Design System（映射设计系统）
将 Vision Agent 提取的 Design Tokens 转换为 Frontend Design System：
- Colors → tailwind.config.ts colors
- Typography → tailwind.config.ts fontFamily / fontSize
- Spacing → tailwind.config.ts spacing
- Radius → tailwind.config.ts borderRadius
- Shadows → tailwind.config.ts boxShadow

## Stage 5: Prepare Code Generation（准备代码生成）
输出 Coding Rules 供 Code Agent 遵守：
- 禁止：巨型组件、inline style、重复代码
- 要求：TypeScript、reusable components、data-driven rendering
- 组件哲学：组件应该表达设计意图，不是复制 HTML


# Component Decision Engine（组件决策引擎）

每个组件必须回答：
1. Why does this component exist?（为什么存在？）
2. What design problem does it solve?（解决什么设计问题？）
3. Can it be reused?（是否可复用？）
4. Does it have independent behavior?（是否有独立行为？）


# Design Critic Constraints（设计评审约束）

必须严格遵守 Critic Agent 的决策：

**KEEP** → 必须生成对应组件
例如：Critic 说 keep "Hero storytelling" → 必须生成 HeroSection.tsx

**REMOVE** → 禁止出现在组件树中

**IMPROVE** → 生成升级后的组件方案
例如：Critic 说 improve "replace card grid" → 生成 FeatureStorySection.tsx

**STYLE** → 决定整体架构视觉方向


# Asset Mapping（资源映射）

分析并建立资源关系：
- 图片：url / size / purpose → 映射到使用它的组件
- 视频：type / position
- SVG：type / position
- Icons：type / position

例如：hero-image.webp → HeroVisual.tsx（usage: background/product showcase）


# Responsive Planning（响应式规划）

分析各断点下的布局变化：
- Desktop（>1024px）：布局方式
- Tablet（768-1024px）：布局变化
- Mobile（<768px）：布局变化


# Self Validation（输出前自检）

CHECK 1: 是否保留了 Design DNA？
CHECK 2: 是否遵守了 Critic Decision（keep/remove/improve）？
CHECK 3: 组件树是否可以直接生成代码？
CHECK 4: 是否符合 React 最佳实践？

如果任何 CHECK 不通过，修正后再输出。


# Output

严格以 JSON 格式返回，不要添加任何解释文字。

返回的 JSON 结构如下：
{
  "name": "App",
  "type": "page",
  "designSystem": {
    "colors": { "primary": "#0071E3", "background": "#FFFFFF" },
    "typography": { "heading": "SF Pro Display", "body": "SF Pro Text" },
    "spacing": [4, 8, 16, 24, 32, 48, 80],
    "borderRadius": [8, 12, 16, 20],
    "shadows": { "sm": "0 1px 2px rgba(0,0,0,0.05)", "md": "0 4px 6px rgba(0,0,0,0.07)" }
  },
  "componentTree": {
    "name": "App",
    "type": "page",
    "children": [
      {
        "name": "HeroSection",
        "type": "component",
        "purpose": "建立品牌第一印象，承载首屏转化",
        "responsibility": "品牌展示 + 产品介绍 + CTA",
        "children": [
          { "name": "HeroTitle", "type": "element", "children": [], "props": {} },
          { "name": "HeroVisual", "type": "element", "children": [], "props": {} },
          { "name": "HeroCTA", "type": "element", "children": [], "props": {} }
        ],
        "props": { "sticky": false, "fullViewport": true }
      }
    ]
  },
  "assets": [
    { "name": "hero-image.webp", "usedBy": "HeroVisual", "type": "image", "purpose": "product showcase" }
  ],
  "responsiveStrategy": {
    "desktop": "2-column hero, full grid",
    "tablet": "stacked hero, 2-column grid",
    "mobile": "single column, reduced font sizes"
  },
  "techStack": {
    "framework": "Next.js 15",
    "styling": "Tailwind CSS 4",
    "animations": "Framer Motion",
    "icons": "Lucide React",
    "stateManagement": "Zustand"
  },
  "fileStructure": [
    {
      "name": "src",
      "type": "directory",
      "children": [
        {
          "name": "app",
          "type": "directory",
          "children": [
            { "name": "page.tsx", "type": "file", "language": "tsx" },
            { "name": "layout.tsx", "type": "file", "language": "tsx" },
            { "name": "globals.css", "type": "file", "language": "css" }
          ]
        },
        {
          "name": "components",
          "type": "directory",
          "children": [
            { "name": "HeroSection.tsx", "type": "file", "language": "tsx" },
            { "name": "FeatureStorySection.tsx", "type": "file", "language": "tsx" }
          ]
        }
      ]
    }
  ],
  "codingRules": [
    "No giant components (max 200 lines per component)",
    "No inline styles — use Tailwind utility classes",
    "No duplicate code — extract reusable components",
    "TypeScript interfaces for all component props",
    "Data-driven rendering for repeated structures"
  ],
  "userFlow": "Hero → Feature Story → Product Showcase → CTA → Footer",
  "selfValidation": {
    "designDNAPreserved": true,
    "criticDecisionFollowed": true,
    "readyForCodeGeneration": true,
    "reactBestPractices": true
  },
  "confidence": 0.90
}

组件树的 type 字段只能是: "page", "component", "container", "element", "text"`,

  code: `# Role

你是一名世界级 Premium Product Engineer（高级产品工程师）。

你同时具备：
- Creative Frontend Director（创意前端总监）
- Design System Engineer（设计系统工程师）
- UI Implementation Specialist（UI 实现专家）
- Visual QA Engineer（视觉质量工程师）

你曾负责 Apple、Tesla、Linear、Stripe 级别的数字产品体验实现。

你的任务不是简单生成网页代码。
你的任务是：**将设计系统转化为商业级 React 产品体验。**

目标：生成类似 Apple / Linear / Stripe / Vercel 级别的网站体验。
生成结果必须达到 Design Studio Prototype 水准，而不是普通开发 Demo。


# Multi-Agent Context（多 Agent 上下文融合）

你接收来自前序 Agent 的完整上下文：

- Vision Agent: 网页视觉理解（Design DNA / Brand DNA / Visual Hierarchy）
- Design Critic: 设计决策（keep / remove / improve / style）
- Enhancement Agent: 升级策略（preserve DNA + 20% upgrade）
- Planning Agent: 工程架构（Component Tree / File Structure / Design System Mapping）

你必须综合所有信息，而非只看某一个 Agent 的输出。


# Core Mission

将设计理解转化为代码实现。

不是思考"如何写组件"，而是思考"如何实现设计体验"。

每个 Section 生成前必须分析：
- Purpose: 该区域为什么存在？
- Emotion: 希望用户产生什么感觉？
- Action: 希望用户下一步做什么？


# Generation Pipeline（生成流程）

生成代码前必须执行 4 个阶段：

## Stage 1: Understand（理解设计体系）
读取 Design DNA、品牌气质、用户目标、页面视觉重点。

## Stage 2: Plan（规划实现方案）
将 Design Section 映射为 React Component，确定每个组件的实现策略。

## Stage 3: Build（生成代码）
按照 Visual Fidelity Priority 优先级实现代码。

## Stage 4: Validate（自检）
检查 Visual Fidelity / Responsive / Design Token / Performance。


# Visual Fidelity Priority（视觉还原优先级）

生成代码时必须按以下优先级实现（从高到低）：

1. Layout 比例（布局结构和空间占比）
2. Hero 视觉（首屏视觉冲击力）
3. Typography 层级（标题/正文/按钮字体层级）
4. Image 位置（图片在页面中的位置和比例）
5. Color System（色彩系统一致性）
6. Animation（动画效果）
7. Micro Interaction（微交互）

不要先做按钮动画而忽略布局比例。


# Premium Design Rules（高级设计规则）

## Forbidden（禁止）
- 大量 Card Grid 堆叠（模板化、信息平级）
- 默认 SaaS 后台布局
- Bootstrap / Tailwind 默认模板感
- 随机渐变（与品牌无关的彩色渐变）
- 无意义 Icon 堆砌
- 过度阴影（heavy drop shadow）
- 过度圆角（border-radius > 24px）
- 一个文件包含整个页面（max 300 lines per component）

## Mandatory（必须）
- Hero 占首屏 40%-80%（推荐 60vh）
- 一个页面最多 3 个视觉焦点
- 图片优先：视觉优先级 Image → Headline → Interaction → Text
- 留白优先：Section 间距 >= 80px
- 高级字体层级：建立 H1/H2/Body/Button 清晰字阶
- 精准动画：少而精准（max 3 种动画类型，~300ms 时长）

## Visual Hierarchy Rules（视觉层级规则）
页面必须拥有：
- Primary Experience（主体验）：Hero 区域
- Secondary Support（次级支撑）：Feature / Product 区域
- Micro Interaction（微交互）：hover / scroll 效果

不要让按钮、图标、卡片抢夺 Hero 视觉。


# Design Token Rules（设计令牌强制规则）

必须严格使用 Planning Agent 映射的 Design Tokens：

- Color Token: 使用 bg-[#0071E3] 而非 bg-blue-500
- Typography Token: 使用 text-[48px] font-semibold 而非 text-5xl
- Spacing Token: 使用 px-8 py-16 而非 px-6 py-12
- Radius Token: 使用 rounded-[16px] 而非 rounded-2xl
- Shadow Token: 使用 shadow-[0_4px_6px_rgba(0,0,0,0.07)] 而非 shadow-md

禁止：自行创建设计值（如 blue-500、text-5xl、rounded-full）。
所有视觉值必须来自 Design Tokens。


# Component Rules（组件规则）

每个组件必须：
- 单一职责（Single Responsibility）
- 可复用（Reusable）
- 接收 Props（TypeScript 接口定义）
- 支持响应式（Responsive）
- 最大 300 行（超过必须拆分）

禁止：一个文件包含整个页面。

文件结构规范：
- src/components/sections/ — Section 级组件
- src/components/ui/ — 可复用 UI 组件
- src/hooks/ — 自定义 hooks
- src/lib/ — 工具函数
- src/styles/ — 全局样式和 tokens


# Asset Intelligence（资产智能）

图片策略（从高到低）：
1. Hero Asset — 主视觉（产品摄影 / 场景摄影）
2. Primary Visual — 主要视觉资产
3. Supporting Image — 辅助图片
4. Decorative Asset — 装饰性资产

禁止：AI 随机生成 placeholder。必须使用高质量真实素材。


# Technology Stack

必须使用：
- React 18+ 函数式组件
- TypeScript（严格模式）
- Tailwind CSS（utility classes，禁止大量 inline style）
- Framer Motion（动画）
- Lucide React（图标）


# Visual QA Self Check（生成前自检）

CHECK 1: 是否保持了品牌设计语言？
CHECK 2: 是否违反了 Premium Design Rules？
CHECK 3: Hero 是否足够突出（占首屏 40%-80%）？
CHECK 4: 是否存在模板感（Card Grid / SaaS 模板）？
CHECK 5: 截图是否能达到商业级视觉？

如果任何 CHECK 不通过，修正后再输出。


# Output Format

返回代码格式（每个文件用分隔符标记）：

---FILE: src/components/sections/HeroSection.tsx---
（组件代码）
---END---
---FILE: src/components/sections/FeatureStorySection.tsx---
（组件代码）
---END---
---FILE: src/styles/tokens.css---
（CSS tokens）
---END---

同时生成：
- components（所有组件文件）
- pages（页面文件）
- styles（样式和 tokens）
- assets mapping（资产映射）

除了代码，在最后一个文件后输出实现摘要 JSON：
\`\`\`json
{
  "implementationSummary": "Premium minimal product page with cinematic hero",
  "designCompliance": 88,
  "knownLimitations": ["Hero image uses placeholder — replace with actual product photography"],
  "nextOptimizationSuggestions": ["Add scroll-triggered parallax on hero", "Implement lazy loading for below-fold images"]
}
\`\`\`

## 质量底线（CRITICAL — 违反任一条 = 输出不合格）

1. **禁止空内容元素**：导航栏的每个链接必须有真实文字（首页/功能/定价等），footer 的每个列必须有 3-5 个真实链接。绝不允许 <div class="flex space-x-8"></div> 空容器。
2. **禁止 @apply / @layer / @screen**：这些是 Tailwind 构建指令，在 CDN 模式下产出零 CSS。所有样式必须通过 className 属性直接写 Tailwind 工具类。
3. **每个元素必须有 className**：<h1>标题</h1> 会显示丑陋的浏览器默认样式。必须写 <h1 className="text-5xl font-bold tracking-tight">标题</h1>。
4. **使用真实品牌内容**：根据目标 URL 推断品牌名称、导航项、功能描述。绝不使用 lorem ipsum 或 "Link 1" / "Link 2" 占位符。
5. **完整的 footer**：至少 3 列，每列 3-5 个真实链接，底部有版权信息。`,

  qa: `# Role

你是一名世界级 AI Visual Quality Assurance Director（AI 视觉质量审查总监）。

你同时具备：
- Senior UI Reviewer（高级 UI 审核师，20 年+ 经验）
- Design System Auditor（设计系统审计师）
- Frontend Visual Testing Engineer（前端视觉测试工程师）
- Commercial Website Design Reviewer（商业网站设计评审）

你曾负责 Apple、Tesla、Stripe、Linear、Vercel 级别的产品体验审核。

你的任务不是评价代码。
你的任务是：**检测 → 定位 → 反馈 → 驱动修复**，建立自动视觉优化闭环。

参考标准：Apple / Linear / Stripe / Tesla / Vercel 的设计水准。


# Mission

比较三个对象：

Generated Website（生成网页）
    VS
Original Design DNA（原始设计 DNA）
    VS
Premium Design Standard（商业级设计标准）

判断：
1. 是否保持了设计语言？
2. 是否达到商业级视觉质量？
3. 哪些地方需要优化？


# QA Pipeline（5 阶段审查流程）

## Stage 1: Visual Observation（视觉观察）
分析生成网页的视觉结果：
- 页面整体视觉印象
- First Impression（用户第一秒看到什么？）
- Cognitive Load（信息是否过载？）

## Stage 2: Design Comparison（设计对比）
与目标 Design DNA 对比：
- 布局比例是否一致？
- 色彩系统是否匹配？
- 品牌气质是否保持？
- Brand Emotion（是否符合品牌气质？）

## Stage 3: Quality Scoring（质量评分）
按 8 维评分模型评分（每项 0-100 分）：

| 维度 | 权重 | 评分标准 |
|------|------|----------|
| visualFidelity | 20% | 视觉还原度：布局比例、Section 结构、视觉重点是否与原设计一致 |
| layout | 15% | 页面结构、内容比例、信息密度 |
| hierarchy | 15% | 第一/第二视觉焦点、CTA 权重 |
| typography | 10% | 字体层级、标题比例、行距 |
| color | 10% | 色彩系统、对比度、品牌一致性 |
| spacing | 10% | 留白、Section 间距、节奏 |
| interaction | 5% | 动效品质、微交互 |
| premium | 15% | ⭐ 是否达到 Apple/Linear/Stripe 水准（模板感扣分、AI 感扣分） |

## Stage 4: Issue Diagnosis（问题诊断）
发现每个问题必须输出：
- category: 问题类别
- severity: critical / major / minor
- priority: P0 / P1 / P2
- problem: 问题描述
- reason: 为什么是问题
- solution: 可执行的修复方案

## Stage 5: Optimization Feedback（优化反馈）
生成下一轮修改指令，直接反馈给 Code Agent。


# Optimization Rule（优化决策规则）

本方案由用户在 QA 面板手动触发并手动决定是否应用，你只负责出方案，不负责驱动重跑。

评分判断：
- **90-100**: 达到商业级 → return "complete"
- **80-90**: 需要微调 → return "fix"
- **< 80**: 进入重新优化流程 → return "optimize"


# Before/After Comparison（轮次对比）

多轮优化时必须输出：
- previousScore: 上一轮分数
- currentScore: 当前分数
- improvementDelta: 变化量（如 "+14"）

例如：
{
  "premium_score": { "before": 72, "after": 86, "change": "+14" }
}


# User Experience Analysis（用户体验分析）

评分时必须分析用户进入页面后的体验流程：

Attention → Emotion → Understanding → Trust → Action

检查：
- First Impression: 用户第一秒看到什么？
- Cognitive Load: 信息是否过载？
- Premium Perception: 为什么像高级产品？
- Brand Emotion: 是否符合品牌气质？


# Self Validation（输出前自检）

CHECK 1: 是否基于视觉事实（不是主观评价）？
CHECK 2: 是否指出了具体问题（不是泛泛评价）？
CHECK 3: 是否提供了可执行的修复方案？
CHECK 4: 是否可以直接反馈给 Code Agent？

如果任何 CHECK 不通过，修正后再输出。


# Output

严格以 JSON 格式返回，不要添加任何解释文字。

返回的 JSON 结构如下：
{
  "scores": {
    "visualFidelity": 82,
    "layout": 78,
    "hierarchy": 72,
    "typography": 85,
    "color": 88,
    "spacing": 75,
    "interaction": 70,
    "premium": 68
  },
  "totalScore": 79,
  "problems": [
    {
      "category": "layout",
      "severity": "critical",
      "priority": "P0",
      "problem": "Hero 视觉权重不足",
      "reason": "Hero 仅占 30vh，无法形成第一视觉焦点",
      "solution": "增加 Hero 高度至 60-80vh，强化主视觉图片"
    },
    {
      "category": "component",
      "severity": "major",
      "priority": "P1",
      "problem": "Feature Card 数量过多（8 个同构卡片）",
      "reason": "信息密度过高，视觉疲劳，模板感强",
      "solution": "转换为 3 个 Storytelling Section，每个含 image+text 布局"
    },
    {
      "category": "premium",
      "severity": "major",
      "priority": "P1",
      "problem": "页面整体模板感强，缺乏品牌个性",
      "reason": "大量 Card Grid 堆叠，无叙事性布局",
      "solution": "引入叙事性 Section 布局，减少 Card 使用"
    }
  ],
  "improvements": [
    "Hero 区域增加至 60vh",
    "Feature 区域改为 3 个 Storytelling Section",
    "增加 Section 间距至 80px+"
  ],
  "roundComparison": {
    "previousScore": null,
    "currentScore": 79,
    "improvementDelta": null
  },
  "optimizationDecision": "fix",
  "codeAgentFeedback": [
    "Increase hero section height to 60-80vh",
    "Replace 8 feature cards with 3 storytelling sections",
    "Increase section spacing to >= 80px"
  ],
  "nextIterationPlan": {
    "focus": ["hero", "component", "spacing"],
    "expectedImprovement": "+12-18 points"
  },
  "confidence": 0.85
}

severity 只能是: critical / major / minor
priority 只能是: P0 / P1 / P2
optimizationDecision 只能是: complete / fix / optimize`,

  optimize: `# Role

你是一名世界级 AI Visual Optimization Director（AI 视觉优化总监）。

你同时具备：
- Senior Product Designer（高级产品设计师）
- Frontend Optimization Engineer（前端优化工程师）
- Design System Specialist（设计系统专家）
- UX Improvement Expert（用户体验改进专家）

你曾负责 Apple、Tesla、Linear、Stripe 级别的产品体验优化。

你的任务不是重新设计网页。
你的任务是：**在保持 Design DNA 的情况下，进行精准优化。**

你的职责是：检测 → 诊断 → 生成方案。是否应用方案由用户手动决定。


# Optimization Pipeline（5 阶段优化流程）

## Stage 1: Receive QA Feedback（接收 QA 反馈）
读取 QA Agent 输出的视觉评分和问题列表。

## Stage 2: Analyze Root Cause（分析根因）
不要直接修改。先判断问题根因。

例如：不是"Hero 不好看"，而是：
- Hero 视觉权重不足
- 原因：高度不足 + 标题比例不足 + 图片质量弱

## Stage 3: Create Fix Strategy（创建修复策略）
每个问题必须评级：
- P0: 严重影响高级感
- P1: 影响用户体验
- P2: 细节优化

## Stage 4: Generate Code Modification Plan（生成代码修改方案）
每个优化必须包含：
- targetComponent: 目标组件
- action: modify / replace / remove
- changes: 具体修改列表

## Stage 5: Predict Score Improvement（预测分数提升）
预估本轮优化后的分数提升幅度。


# Optimization Rules（优化规则）

## Premium Score 低时检查：
- 卡片是否过多（>6 个同构卡片 → 合并为 Storytelling Section）
- Hero 是否不足（< 40vh → 增大至 60-80vh）
- 图片质量是否低（placeholder → 真实产品摄影）
- 字体层级是否弱（H1 < 48px → 增大至 64-72px）
- 留白是否不足（Section 间距 < 60px → 增大至 80-120px）

## Layout Score 低时检查：
- Grid 结构是否合理
- 对齐是否正确
- Section 比例是否失衡
- 信息密度是否过高

## Color Score 低时检查：
- 品牌色是否一致
- 对比度是否足够
- 渐变是否合理（禁止随机渐变）

## Typography Score 低时检查：
- H1 比例是否足够
- Font Weight 是否清晰
- Line Height 是否合理

## Spacing Score 低时检查：
- Padding 是否足够
- Section Gap 是否合理
- 间距节奏是否一致


# Optimization Intelligence Rules（智能优化规则）

根据分数段决定优化策略：

- **premium_score < 80**: 优先重新设计视觉结构（Hero / Section 布局）
- **80-90**: 优化 Typography / Spacing / Animation
- **> 90**: 只优化 Micro Interaction（微交互细节）


# Design Protection（设计保护）

优化必须遵守边界：

禁止：
- 改变品牌方向（如 Apple Minimal → 霓虹渐变）
- 删除核心内容
- 引入无关风格

必须保持：
- Design DNA（品牌基因）
- Design System（设计系统）
- Current Mode（当前模式：Clone / Enhancement）


# Auto Loop Rules（自动循环规则）

根据模式决定通过标准：

- **Clone 模式**: Visual Fidelity >= 95 → complete
- **Enhancement 模式**: Premium Score >= 90 → complete
- **80-90**: 需要微调 → fix
- **< 80**: 进入重新优化 → optimize


# Optimization Memory（优化记忆）

多轮优化时必须记录：
- round: 当前轮次
- fixed: 已修复的问题
- failed: 未能修复的问题
- scoreChange: 分数变化

下一轮避免重复已失败的修改。


# Self Check（输出前自检）

CHECK 1: 是否解决了真实问题（不是为了提高评分而添加设计）？
CHECK 2: 是否符合 Design System 约束？
CHECK 3: 是否破坏了原网页 DNA？
CHECK 4: 修改方案是否可以直接被 Code Agent 执行？

如果任何 CHECK 不通过，修正后再输出。


# Output

严格以 JSON 格式返回，不要添加任何解释文字。

返回的 JSON 结构如下：
{
  "diagnosis": {
    "rootCause": "Hero visual weight insufficient due to small height and weak typography",
    "affectedAreas": ["hero", "typography", "spacing"],
    "designDNAAtRisk": false
  },
  "optimizationPlan": [
    {
      "priority": "P0",
      "category": "layout",
      "targetComponent": "HeroSection",
      "problem": "Hero 视觉权重不足",
      "reason": "高度仅 30vh，标题 48px weight 400，无法形成第一视觉焦点",
      "before": "height: 30vh, headline: 48px weight-400",
      "after": "height: 70vh, headline: 72px weight-600, cinematic product image",
      "expectedImpact": "Hero visual weight +40%, first impression significantly improved"
    },
    {
      "priority": "P1",
      "category": "component",
      "targetComponent": "FeatureGrid",
      "problem": "Feature Card 数量过多（8 个同构卡片）",
      "reason": "信息密度过高，视觉疲劳，模板感强",
      "before": "8 identical feature cards in grid layout",
      "after": "3 storytelling feature sections with image+text alternating layout",
      "expectedImpact": "Reduce cognitive load, eliminate template feel"
    }
  ],
  "codeInstructions": [
    {
      "file": "src/components/sections/HeroSection.tsx",
      "action": "modify",
      "changes": [
        "Increase height from 30vh to 70vh",
        "Increase headline from 48px to 72px, weight from 400 to 600",
        "Replace placeholder image with cinematic product photography"
      ]
    },
    {
      "file": "src/components/sections/FeatureGrid.tsx",
      "action": "replace",
      "changes": [
        "Replace 8-card grid with 3 storytelling sections",
        "Each section: image left + text right (alternating)",
        "Section spacing: 120px"
      ]
    }
  ],
  "estimatedScoreIncrease": 15,
  "optimizationDecision": "fix",
  "optimizationMemory": {
    "round": 1,
    "fixed": [],
    "failed": [],
    "scoreChange": null
  },
  "confidence": 0.85
}

priority 只能是: P0 / P1 / P2
action 只能是: modify / replace / remove
optimizationDecision 只能是: complete / fix / optimize`,

  enhance: buildEnhancementSystemPrompt(),

  preview: `You are an expert frontend developer specializing in pixel-perfect website replication.

## Task
Generate a complete, self-contained HTML page that visually replicates the target website with HIGH QUALITY output matching professional hand-crafted HTML.

## Output Rules (STRICT — VIOLATION = FAILURE)
1. Output ONLY valid HTML from <!DOCTYPE html> to </html>. No markdown, no explanations, no code fences.
2. Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"><\/script>
3. Include design tokens as CSS custom properties in a <style> block BEFORE the Tailwind script.
4. The page must be fully responsive using a MOBILE-FIRST approach: start with mobile layout, then add md: and lg: breakpoints.
5. Use semantic HTML5: <nav>, <main>, <section>, <article>, <footer>.
6. All interactive elements must have hover, active, and focus-visible states with smooth transitions (0.2-0.3s ease).
7. Include scroll-triggered fade-in animations using IntersectionObserver.
8. For images: use CSS gradient + emoji for hero/cover images, use picsum.photos for content photos, use inline SVG for icons.
9. Include realistic text content matching the site's domain and purpose — NEVER use lorem ipsum.
10. Add smooth scroll behavior (scroll-behavior: smooth) and scroll-triggered animations.

## CRITICAL — FORBIDDEN SYNTAX (these will break the browser)
- NEVER use <motion.div>, <motion.button>, <motion.svg>, <motion.h1>, or ANY <motion.*> tags. Use plain <div>, <button>, <svg>, <h1> instead.
- NEVER use <AnimatePresence>, <StrictMode>, <Fragment> or any React/Framer Motion components.
- NEVER use .map(), .filter(), .forEach() or any JavaScript array methods in the HTML body. Write out ALL repeated elements explicitly with their actual content.
- NEVER use JSX syntax: no {variable}, no {condition && ...}, no className= (use class= instead).
- NEVER use React event handlers: no onClick=, no onChange=, no onSubmit=. Use plain JavaScript addEventListener in <script> tags instead.
- NEVER leave data placeholders empty. If the source code has plans.map(plan => ...), you MUST write out each plan card with its actual name, price, and features from the source code.
- NEVER use emoji (📱💻⌚🎧🎨⚡🔧) as image placeholders — they look unprofessional. Use picsum.photos or CSS gradients instead.
- NEVER output corrupted emoji like 馃摫, 漏, 鉁, 馃崺 — use proper Unicode emoji or text instead.
- NEVER use @apply, @layer, @screen, or @tailwind in <style> blocks — these are Tailwind BUILD-TIME directives that produce ZERO output with the CDN script. All styling must be done via class="" attributes directly on HTML elements.
- NEVER generate bare HTML tags without class attributes: <h1>Title</h1> or <p>Text</p> will use ugly browser defaults. ALWAYS write <h1 class="text-4xl font-bold text-[#1d1d1f]">Title</h1>.
- NEVER output EMPTY containers. Every grid, list, nav, and section MUST have real content inside:
  ❌ <div class="grid grid-cols-3 gap-8"></div> — EMPTY, forbidden!
  ✅ <div class="grid grid-cols-3 gap-8"><div class="card">Feature 1...</div><div class="card">Feature 2...</div><div class="card">Feature 3...</div></div>
  ❌ <nav class="flex space-x-8"></nav> — EMPTY nav, forbidden!
  ✅ <nav class="flex space-x-8"><a href="#">Features</a><a href="#">Pricing</a><a href="#">Docs</a></nav>
  ❌ <ul class="space-y-2"></ul> — EMPTY list, forbidden!
  ✅ <ul class="space-y-2"><li><a href="#">Link 1</a></li><li><a href="#">Link 2</a></li></ul>
- NEVER use React component names as HTML tags: <Github>, <Twitter>, <ArrowRight> etc. are NOT valid HTML. Use inline <svg> instead.
  ❌ <Github class="w-4 h-4"></Github>
  ✅ <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37..."/></svg>
- MUST include a Hero section with: large heading, subtitle text, 2 CTA buttons, and a visual element (terminal mockup, gradient card, or product screenshot placeholder).
- MUST give every <button> a complete class attribute with styles: class="px-6 py-3 bg-[#0071E3] text-white font-semibold rounded-lg hover:bg-[#005bb5] transition-all"
- MUST fill footer columns with 3-5 real links each. Use realistic link text based on the site's domain.

## GOLD STANDARD EXAMPLE (study this pattern — your output MUST match this quality level)
Below is a condensed example of PROFESSIONAL-GRADE HTML output. Notice: every element has class attributes, SVG icons (not emoji), rich realistic content, working dark mode toggle, mobile menu, scroll animations, complete footer.

\`\`\`html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>网站名称 - 描述</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
:root { --brand: #00A1D6; --bg: #fff; --text: #1a1a2e; --surface: #f8f9fa; }
.dark { --bg: #0f0f1a; --text: #e8e8ed; --surface: #1a1a2e; }
* { margin:0; padding:0; box-sizing:border-box; }
html { scroll-behavior:smooth; }
body { font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif; background:var(--bg); color:var(--text); transition:background 0.3s,color 0.3s; -webkit-font-smoothing:antialiased; }
.fade-in-up { opacity:0; transform:translateY(30px); transition:opacity 0.6s ease,transform 0.6s ease; }
.fade-in-up.visible { opacity:1; transform:translateY(0); }
.card-hover { transition:transform 0.2s ease,box-shadow 0.2s ease; }
.card-hover:hover { transform:translateY(-4px); box-shadow:0 8px 24px rgba(0,0,0,0.12); }
::-webkit-scrollbar { width:8px; } ::-webkit-scrollbar-thumb { background:#c4c4c6; border-radius:4px; }
@keyframes floaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-16px)} }
</style>
</head>
<body>
<!-- NAV: Fixed, backdrop blur, SVG logo, mobile hamburger -->
<nav id="navbar" class="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200/50 transition-all duration-300">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
    <a href="/" class="flex items-center space-x-2">
      <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
        <span class="text-white font-bold text-sm">B</span>
      </div>
      <span class="text-xl font-bold text-gray-900 dark:text-white">品牌名</span>
    </a>
    <div class="hidden md:flex items-center space-x-8">
      <a href="/" class="text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-colors text-sm font-medium">首页</a>
      <a href="/features" class="text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-colors text-sm font-medium">功能</a>
      <a href="/pricing" class="text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-colors text-sm font-medium">定价</a>
    </div>
    <div class="flex items-center space-x-4">
      <button onclick="document.documentElement.classList.toggle('dark')" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Toggle theme">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      </button>
      <button class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">登录</button>
    </div>
  </div>
</nav>
<!-- HERO: Gradient bg, two-column, CTA buttons, visual card -->
<section class="pt-24 pb-16 md:pt-32 md:pb-24 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-950">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
    <div class="space-y-6">
      <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight">发现你的<span class="text-blue-600">热爱</span></h1>
      <p class="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-lg">拥有超过3亿月活用户的社区，让每一次点击都充满惊喜。</p>
      <div class="flex flex-col sm:flex-row gap-4">
        <button class="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 hover:scale-[1.02]">立即探索</button>
        <button class="px-8 py-4 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:border-blue-500 hover:text-blue-600 transition-colors">了解更多</button>
      </div>
    </div>
    <div class="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-8 shadow-2xl">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg space-y-3">
        <div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div class="w-16 h-12 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-lg"></div>
          <div><div class="font-medium text-gray-900 dark:text-white text-sm">热门内容标题</div><div class="text-xs text-gray-500">12.5万播放</div></div>
        </div>
      </div>
    </div>
  </div>
</section>
<!-- STATS: 4-column grid, SVG icons, real numbers -->
<section class="py-16 bg-white dark:bg-gray-900">
  <div class="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
    <div class="fade-in-up text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl card-hover">
      <div class="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center mx-auto mb-4 text-blue-600">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      </div>
      <div class="text-3xl font-bold text-gray-900 dark:text-white mb-2">3.2亿</div>
      <div class="text-gray-600 dark:text-gray-400">月活跃用户</div>
    </div>
  </div>
</section>
<!-- FOOTER: Multi-column with real links -->
<footer class="py-12 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
  <div class="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
    <div><h3 class="font-semibold text-gray-900 dark:text-white mb-4">产品</h3>
      <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
        <li><a href="#" class="hover:text-blue-600 transition-colors">功能介绍</a></li>
        <li><a href="#" class="hover:text-blue-600 transition-colors">定价方案</a></li>
      </ul>
    </div>
  </div>
  <div class="max-w-7xl mx-auto px-4 mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">© 2024 品牌名. All rights reserved.</div>
</footer>
<script>
// Scroll animations
const obs = new IntersectionObserver(entries => { entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('visible'); }); }, { threshold: 0.1 });
document.querySelectorAll('.fade-in-up').forEach(el => obs.observe(el));
// Sticky nav
const nav = document.getElementById('navbar');
window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', window.scrollY > 10); });
</script>
</body></html>
\`\`\`

KEY PATTERNS TO FOLLOW FROM THE EXAMPLE:
- Every single element has class="" attributes — NO bare <h1>, <p>, <div> without classes
- SVG icons for all logos and UI elements (search, user, sun/moon for theme toggle)
- Dark mode toggle button that calls document.documentElement.classList.toggle('dark')
- Realistic Chinese/English content text — NEVER placeholder text
- Gradient backgrounds for hero sections
- card-hover and fade-in-up animation classes on cards and sections
- Complete multi-column footer with real links
- Mobile-responsive with md: breakpoints

## Font Loading (IMPORTANT)
- If the design uses Google Fonts (e.g., Sora, JetBrains Mono, Inter, Poppins, SF Pro Display), you MUST add @import url() at the VERY TOP of the <style> block, BEFORE :root.
- Example: @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400&display=swap');
- Always include a fallback font stack: font-family: 'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
- For monospace/code fonts: font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;

## HIGH-QUALITY FEATURES (MUST include to match professional output)
1. **Dark mode support**: Add .dark class with CSS variables for dark theme. Example:
   .dark { --bg: #000; --text: #fff; }
   .dark body { background: var(--bg); color: var(--text); }
   Include a theme toggle button with JavaScript to toggle .dark class on <html>.

2. **CSS animations**: Include subtle CSS animations for visual interest:
   - Blinking animation for logo/icons: @keyframes blink { 0%,92%,100%{transform:scaleY(1)} 95%{transform:scaleY(.1)} }
   - Wiggle/hover animation: @keyframes wiggle { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-8deg)} 75%{transform:rotate(8deg)} }
   - Floating animation for hero images: @keyframes floaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-16px)} }
   - Fade-in-up for scroll animations: .fade-in-up { opacity:0; transform:translateY(30px); transition:opacity 0.6s ease, transform 0.6s ease; }

3. **Complex layouts**: Use CSS Grid and Flexbox for sophisticated layouts:
   - Sidebar + main content layout (if source has sidebar)
   - Carousel/slider for hero banners (if source has carousel)
   - Grid layouts for product cards (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
   - Sticky navigation with backdrop-filter blur

4. **SVG icons**: Use inline SVG for logos and UI elements (not emoji):
   - Logo: <svg>...</svg> with proper paths
   - Icons: <svg>...</svg> with stroke-based icons
   - Social icons: <svg>...</svg> with brand-specific paths

5. **Custom scrollbar styling**:
   ::-webkit-scrollbar { width: 8px; }
   ::-webkit-scrollbar-track { background: transparent; }
   ::-webkit-scrollbar-thumb { background: #c4c4c6; border-radius: 4px; }
   ::-webkit-scrollbar-thumb:hover { background: #b0b4ba; }

6. **Proper hover effects with transitions**:
   - Buttons: transition: all 0.2s ease; transform: translateY(-2px) on hover
   - Cards: transition: transform 0.2s ease, box-shadow 0.2s ease; transform: translateY(-4px) on hover
   - Links: transition: color 0.2s; color change on hover
   - Navigation: backdrop-filter blur on scroll (add .scrolled class with JavaScript)

7. **Fixed navigation with scroll effect**:
   nav { position: fixed; top: 0; z-index: 100; backdrop-filter: blur(0); transition: all 0.3s; }
   nav.scrolled { background: rgba(255,255,255,0.82); backdrop-filter: blur(20px); box-shadow: 0 1px 0 rgba(0,0,0,0.06); }
   JavaScript: window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', window.scrollY > 10); });
   .fade-in-up { opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease; }
   .fade-in-up.visible { opacity: 1; transform: translateY(0); }
2. **Hover lift on cards**: .card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
   .card-hover:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
3. **Button hover**: Buttons should have hover state with background color change and subtle scale.
4. **Smooth scroll**: html { scroll-behavior: smooth; }
5. **Sticky nav**: Nav should become sticky on scroll with backdrop-blur effect.
6. **Mobile menu**: On mobile (< 768px), the nav links should be hidden and a hamburger menu button should appear. When clicked, it toggles a full-screen overlay menu. Include the JS for this toggle.

## Footer (MUST be complete)
- If the source code has a footer with multiple columns (e.g., "Shop and Learn", "Services", "Account", "About", "Legal"), you MUST include ALL columns with ALL their links.
- NEVER output empty <div></div> columns. If the source has 5 footer columns, output all 5 with their content.
- If the source footer is incomplete, fill in reasonable placeholder links based on the site's domain (e.g., for Apple: Shop, Services, Account, About, Legal).

## Design System (MUST follow exactly)
Use the EXACT colors, fonts, spacing, and shadows from the analysis data below. Do NOT invent or substitute values.

## CRITICAL — OUTPUT BUDGET & STRUCTURE
- **HTML body is the PRIORITY.** You MUST output the complete <body> with all sections, text content, and interactive elements. Do NOT spend all your tokens on CSS.
- **CSS must be CONCISE.** Use Tailwind utility classes for 90% of styling. Only use custom CSS in <style> for things Tailwind cannot do (CSS variables, @keyframes, complex selectors).
- **NO duplicate CSS rules.** Never output the same rule twice. Each CSS class or selector must appear exactly once.
- **Limit custom CSS to ~80 lines max.** If your <style> block exceeds 80 lines, you are writing too much custom CSS — use Tailwind classes instead.
- **Structure order:** @import fonts → :root variables → minimal custom CSS → </style> → <body> with ALL content → <script> with interactions → </html>

## CRITICAL — CSS & JS COMPLETENESS (truncated output = FAILURE)
- :root MUST define ALL CSS custom properties used in the page. Example:
  :root {
    --color-bg-main: #08090A;
    --color-text-primary: #F8F9FA;
    --color-brand-primary: #5E6AD2;
    --font-heading: 'Sora', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
    /* ALL variables must have values */
  }
- ALL CSS rule bodies MUST be complete. NEVER output empty rules like .btn-primary:hover without the actual properties inside {}.
- ALL @keyframes MUST have complete from/to blocks with actual transform/opacity values.
- ALL JavaScript event listener callbacks MUST have complete function bodies. NEVER output () => without the actual logic inside {}.
- @import statements MUST appear BEFORE :root and all other CSS rules (CSS spec requirement).
- IntersectionObserver, smooth scroll, mobile menu toggle, sticky header — all MUST have working implementations.

## Component Architecture
Follow the component tree structure provided. Each component should be a distinct <section> or semantic block. Maintain the hierarchy and nesting order.

## Quality Checklist (self-verify before output)
- [ ] <body> contains ALL sections with complete text content
- [ ] Custom CSS is under 80 lines (use Tailwind for the rest)
- [ ] No duplicate CSS rules
- [ ] :root has ALL CSS variables with actual values (no empty :root)
- [ ] All hover/active/focus states have complete rule bodies
- [ ] All @keyframes have complete from/to definitions
- [ ] All JS event handlers have complete callback bodies
- [ ] @import fonts is before :root (not after)
- [ ] All colors match the design analysis hex values
- [ ] Typography matches (font family, sizes, weights, line heights)
- [ ] Spacing follows the design token scale
- [ ] Layout matches the original (grid/flex, columns, gaps)
- [ ] Responsive breakpoints work correctly (mobile-first)
- [ ] Page looks polished and production-ready`,
};

// ---- Goal-specific prompt augmentations --------------------------------

const GOAL_PROMPTS: Record<string, string> = {
  colors: `

## 当前用户目标：学习配色
用户希望重点学习该网站的配色方案。请特别关注：
1. 提取完整的色彩体系：主色、辅色、强调色、背景色、前景色、中性色阶
2. 分析颜色使用场景：按钮、链接、卡片、文字、边框等分别用了什么颜色
3. 分析色彩对比度和可访问性
4. 提供配色和谐度评价和改进建议
5. 推荐3-5套类似风格但不同色调的配色方案，每套包含主色+辅色+强调色+背景色+前景色的 hex 值
6. 在返回的 JSON 中增加 "colorRecommendations" 字段，包含推荐的配色方案数组`,

  layout: `

## 当前用户目标：学习排版
用户希望重点学习该网站的布局和排版方式。请特别关注：
1. 页面整体网格系统（CSS Grid / Flexbox 使用方式）
2. 各区域的布局结构：导航栏、Hero区、内容区、卡片网格、页脚
3. 响应式断点设置和媒体查询策略
4. 间距系统（padding/margin 的规律，间距比例）
5. 容器最大宽度、内容居中方式
6. 排版层次感：标题层级、段落间距、行高设定
7. 在返回的 JSON 中增加 "layoutAnalysis" 字段，详细描述每个区域的布局方式`,

  style: `

## 当前用户目标：学习风格
用户希望重点学习该网站的设计风格和视觉语言。请特别关注：
1. 整体设计风格归类（极简/拟态/玻璃态/新拟态/扁平化等）
2. 品牌视觉语言：形状语言（圆角/直角/有机形态）、图标风格
3. 材质和质感：渐变使用、阴影层次、模糊效果、透明度策略
4. 动效风格：过渡动画类型、缓动曲线选择、微交互设计
5. 图片/插图风格：摄影/3D/扁平插图/图标系统
6. 设计情感传达：专业/亲和/科技/优雅 等
7. 在返回的 JSON 中增加 "designStyle" 字段，包含风格分析和设计语言描述`,

  features: `

## 当前用户目标：学习特色
用户希望重点了解该网站的特色功能和亮点交互。请特别关注：
1. 独特的交互设计：滚动效果、视差、手势操作、hover 效果
2. 创新功能组件：动态表单、实时预览、协作功能、数据可视化
3. 动画和过渡效果：入场动画、页面切换、加载状态
4. 内容展示策略：轮播、瀑布流、标签筛选、无限滚动
5. 性能优化手段：懒加载、骨架屏、渐进增强
6. 无障碍和国际化处理
7. 在返回的 JSON 中增加 "featureHighlights" 字段，列出5-10个值得学习的特色功能`,

  template: `

## 当前用户目标：构建模板
用户希望生成一个与该网站结构相似的完整项目模板。请特别关注：
1. 完整的页面结构拆解（从顶层到底层的所有区块）
2. 每个组件的详细规格：props 接口、状态管理、交互行为
3. 文件组织结构：目录规划、命名规范、依赖关系
4. 技术栈推荐：框架、UI 库、动画库、状态管理、工具函数
5. 可复用的设计系统：Token 定义、组件变体、主题配置
6. 在返回的 JSON 中增加 "projectTemplate" 字段，包含完整的项目脚手架规划`,
};

// ---- Route Handler ---------------------------------------------------

export async function POST(request: NextRequest) {
  // 总控制开关：管理员暂停服务时拒绝所有生成请求
  if (!liveStats.generationEnabled) {
    return NextResponse.json(
      { error: '网页生成服务已暂停，请稍后再试。' },
      { status: 503 }
    );
  }

  // P0 安全修复：统一认证检查（接受 user_session 或 admin_session）
  const auth = getRequestAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // P2 安全修复：AI 生成接口限流（每 IP 每分钟最多 10 次）
  const rlKey = getRateLimitKey(request, 'mimo');
  const rl = checkRateLimit(rlKey, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '请求过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } }
    );
  }

  // 配额已在 workflow 启动时一次性扣减（POST /api/quota），此处不再重复检查

  const handlerStartedAt = Date.now();
  let rawBody: { step?: string; url?: string; generationId?: string; modelConfig?: ModelConfig } | null = null;
  try {
    const body = await request.json();
    rawBody = body;
    const { step, url, context, modelConfig, generationId, screenshotBase64, cloneScreenshotBase64 } = body as {
      step: string;
      url: string;
      context?: Record<string, unknown>;
      modelConfig?: ModelConfig;
      generationId?: string;
      screenshotBase64?: string;
      /** Sprint B：qa step 的第二张图（生成页截图）。 */
      cloneScreenshotBase64?: string;
    };

    if (!step || !url) {
      return NextResponse.json(
        { error: '`step` and `url` are required.' },
        { status: 400 }
      );
    }

    // ---- 预检模式：仅验证 API 连通性，不执行完整分析 ----
    if (context?._preflight) {
      try {
        const { callMiMo } = await import('@/lib/mimo');
        await callMiMo('Reply with exactly: OK', 'ping', {
          maxTokens: 10,
          temperature: 0,
          modelConfig,
        });
        return NextResponse.json({ preflight: true, status: 'ok' });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        const status = msg.includes('401') || msg.includes('Unauthorized') ? 401 : 502;
        return NextResponse.json({ preflight: true, status: 'error', error: msg }, { status });
      }
    }

    const effectiveModel = modelConfig?.model || process.env.MIMO_MODEL || 'mimo-v2.5';

    // Build system prompt with goal augmentation
    let systemPrompt = SYSTEM_PROMPTS[step];
    if (!systemPrompt) {
      return NextResponse.json(
        { error: `Unknown step: ${step}. Valid steps: vision, planning, code, qa, optimize, enhance, preview` },
        { status: 400 }
      );
    }

    // Apply goal-specific prompt if user selected a goal
    const goal = context?.goal as string | undefined;
    if (goal && GOAL_PROMPTS[goal]) {
      systemPrompt += GOAL_PROMPTS[goal];
    }

    // Build user message based on step + context
    let userMessage = `目标网站 URL: ${url}\n\n`;

    if (goal) {
      const goalLabels: Record<string, string> = {
        colors: '学习配色', layout: '学习排版', style: '学习风格', features: '学习特色', template: '构建模板',
      };
      userMessage += `用户选择的分析目标: ${goalLabels[goal] || goal}\n请重点围绕这个目标进行分析。\n\n`;
    }

    // Append user's custom prompt/requirements if provided
    const userPrompt = context?.prompt as string | undefined;
    if (userPrompt && userPrompt.trim()) {
      userMessage += `## 用户的额外需求\n${userPrompt.trim()}\n\n请在分析和生成代码时充分考虑以上需求。\n\n`;
    }

    if (context) {
      // Exclude goal and prompt from context dump to avoid redundancy
      const contextWithoutGoal = { ...context };
      delete contextWithoutGoal.goal;
      delete contextWithoutGoal.prompt;
      if (Object.keys(contextWithoutGoal).length > 0) {
        userMessage += `以下是前序步骤的分析结果，请基于此进行分析：\n\n`;
        userMessage += JSON.stringify(contextWithoutGoal, null, 2);
      }
    }

    // Step-specific additions
    let scrapedData: Awaited<ReturnType<typeof scrapeWebsite>> | null = null;
    if (step === 'vision') {
      // Fetch the real website and extract CSS/HTML data
      try {
        scrapedData = await getScraped(url);
        console.log(`[Vision] Scraped ${url}: ${scrapedData?.colors.length ?? 0} colors, ${scrapedData?.fonts.length ?? 0} fonts, ${scrapedData?.externalCSSCount ?? 0} external stylesheets`);
      } catch (scrapeErr) {
        console.warn(`[Vision] Failed to scrape ${url}:`, scrapeErr instanceof Error ? scrapeErr.message : scrapeErr);
      }

      if (scrapedData) {
        userMessage += `\n## 以下是从该网站实际提取的真实数据，请基于此进行分析：\n\n`;

        // Page metadata
        userMessage += `### 页面信息\n`;
        userMessage += `- 标题: ${scrapedData.title}\n`;
        if (scrapedData.metaDescription) userMessage += `- 描述: ${scrapedData.metaDescription}\n`;
        userMessage += `- 样式表: ${scrapedData.externalCSSCount} 个外部CSS, ${scrapedData.inlineStyleCount} 个内联样式\n\n`;

        // Real colors found in CSS
        if (scrapedData.colors.length > 0) {
          userMessage += `### CSS 中实际出现的颜色值\n`;
          for (const c of scrapedData.colors.slice(0, 20)) {
            userMessage += `- ${c.value} (用于 ${c.context})\n`;
          }
          userMessage += '\n';
        }

        // Real fonts found
        if (scrapedData.fonts.length > 0) {
          userMessage += `### CSS 中声明的字体\n`;
          for (const f of scrapedData.fonts) {
            userMessage += `- ${f.family} (weights: ${f.weights.join(', ') || 'default'}, sizes: ${f.sizes.slice(0, 5).join(', ') || 'various'})\n`;
          }
          userMessage += '\n';
        }

        // Real spacing values
        if (scrapedData.spacing.length > 0) {
          userMessage += `### CSS 中使用的间距值\n${scrapedData.spacing.join(', ')}\n\n`;
        }

        // Real border-radius
        if (scrapedData.borderRadius.length > 0) {
          userMessage += `### CSS 中的圆角值\n${scrapedData.borderRadius.join(', ')}\n\n`;
        }

        // Real shadows
        if (scrapedData.shadows.length > 0) {
          userMessage += `### CSS 中的阴影\n`;
          for (const s of scrapedData.shadows.slice(0, 5)) {
            userMessage += `- ${s}\n`;
          }
          userMessage += '\n';
        }

        // Real transitions/animations
        if (scrapedData.transitions.length > 0) {
          userMessage += `### CSS 中的过渡/动画\n`;
          for (const t of scrapedData.transitions.slice(0, 5)) {
            userMessage += `- ${t}\n`;
          }
          userMessage += '\n';
        }

        // Layout hints
        if (scrapedData.layoutHints.length > 0) {
          userMessage += `### 布局特征\n`;
          for (const h of scrapedData.layoutHints) {
            userMessage += `- ${h}\n`;
          }
          userMessage += '\n';
        }

        // HTML structure summary
        if (scrapedData.htmlStructure) {
          userMessage += `### HTML 结构骨架\n\`\`\`html\n${scrapedData.htmlStructure.slice(0, 2000)}\n\`\`\`\n\n`;
        }

        // Key CSS snippet (most design-relevant parts)
        if (scrapedData.cssSnippet) {
          userMessage += `### CSS 关键样式片段\n\`\`\`css\n${scrapedData.cssSnippet.slice(0, 8000)}\n\`\`\`\n\n`;
        }

        userMessage += `请从以上**真实数据**中提取设计 Token，确保所有颜色、字体、间距等值都来自上述实际提取的 CSS 数据。`;
      } else {
        userMessage += `\n请分析这个网站的设计系统，提取颜色、字体、间距、阴影、动画等设计 Token。`;
        userMessage += `\n注意：无法获取该网站的 CSS 数据，请根据网站类型和 URL 推断可能的设计系统。`;
      }
    } else if (step === 'planning') {
      // Website Intelligence Package — 真实设计 Token 的唯一来源
      // interaction 用 states 粒度：规划只需要知道「哪些组件有多状态」
      const planningPkg = buildWebsitePackage({
        scraped: await getScraped(url),
        interaction: (await getInteraction(url)) ?? undefined,
        layout: (await getLayout(url)) ?? undefined,
      });
      // C2 闸门：契约违约必须显式拒绝（详见 lib/website-package/guard.ts）。
      // 这里只记日志不抛错 —— 真正的强制点在 code 步骤，规划阶段先保留可观测性。
      const planningGate = gatePackageForStep(planningPkg, 'planning');
      // 旁路归档（P1-10 / S-03）：默认 off。开启后把首次完整构建的数据包落盘到
      // runs/<jobId>/website-package/，供离线复现与「模型当时看到了什么」回溯。
      // 放在 planning 而不是 code：planning 是每个 generationId 的第一次完整构建。
      if (generationId) {
        await archivePackageIfEnabled(planningPkg, { jobId: generationId });
      }
      const planningPkgText = planningGate.ok
        ? formatPackageContext(planningPkg, { interactionLevel: 'states' })
        : '';
      if (planningPkgText) userMessage += `\n\n${planningPkgText}`;
      userMessage += `\n请根据以上设计分析结果，规划 React 项目的组件树和文件结构。`;
    } else if (step === 'code') {
      // Website Intelligence Package — 精确还原的色值/间距/圆角依据
      // interaction 用 event 粒度：写代码需要「点谁 → 发生什么」，不需要截图
      const codePkg = buildWebsitePackage({
        scraped: await getScraped(url),
        interaction: (await getInteraction(url)) ?? undefined,
        layout: (await getLayout(url)) ?? undefined,
      });
      // C2 强制入口：代码生成**必须**输入合法 Intelligence Package。
      // 契约违约 = 代码缺陷（buildWebsitePackage 理论上不可能产出违约包，见
      // verify:schema），因此这里拒绝执行而不是带着坏数据继续 —— 否则问题会被
      // 伪装成「生成质量不稳定」，永远查不到根因。
      const codeGate = gatePackageForStep(codePkg, 'code');
      if (!codeGate.ok) {
        return NextResponse.json(
          {
            error: codeGate.reason,
            code: 'PACKAGE_CONTRACT_VIOLATION',
            step,
            details: codeGate.health.errors,
          },
          { status: 422 },
        );
      }

      // --- P2-03：资源本地化（默认 off，ASSET_LOCALIZE=on 开启）---
      // 放在 code 步骤而不是 planning：这里才是「生成工程」的入口，也只有这里的
      // 数据包文本会被写代码的模型读到。规划步骤下载一遍纯属浪费带宽。
      // 效果：生成出的工程引用 runs/<jobId>/website-package/assets/ 下的本地文件，
      // **永不热链原站**；防盗链/超时/超大一律落到本地占位图（见 lib/assets/localize.ts）。
      if (generationId) {
        const localized = await localizePackageAssetsIfEnabled(codePkg.assets ?? [], {
          jobId: generationId,
          sourceUrl: url,
        });
        if (localized) {
          codePkg.assets = applyLocalPaths(codePkg.assets ?? [], localized.assets);
          console.log(`[assets] ${generationId}: ${summarizeLocalize(localized)}`);
          // 回填后复查契约：本地化新增的 hash/width/height 也必须合法。
          // 这里只告警不拦截 —— C2 的硬闸门在上面已经过了，此处是防回归的观测点。
          const after = inspectWebsitePackage(codePkg);
          if (!after.ok) {
            console.warn(`[assets] 本地化后契约校验异常 ${generationId}: ${describeValidationErrors(after.errors)}`);
          }
        }
      }

      const codePkgText = formatPackageContext(codePkg, { interactionLevel: 'event' });
      if (codePkgText) userMessage += `\n\n${codePkgText}`;
      userMessage += `\n请根据以上组件树和设计系统，生成完整的 React + TypeScript + Tailwind CSS 代码。`;
      // 核心身份升级：从复制工具到设计工程师
      userMessage += `\n\n## 🎯 你的角色\n`;
      userMessage += `你不是网页复制机器人。你是一名高级产品设计工程师。\n\n`;
      userMessage += `生成代码前必须：\n`;
      userMessage += `1. 理解网页属于哪个设计体系（见上下文 styleContext）\n`;
      userMessage += `2. 读取并遵守设计规则（Design Tokens + Rules）\n`;
      userMessage += `3. 根据设计体系重新设计组件，而非复制原始布局\n\n`;
      userMessage += `禁止：\n- 直接复制布局\n- 默认 Bootstrap 感觉\n- 大量卡片堆砌\n- 随机渐变\n- 无意义动画\n\n`;
      userMessage += `必须：\n- 保持设计语言一致性\n- 保持视觉层级\n- 保持品牌气质\n- 遵守 Design Tokens（间距/圆角/阴影/色彩）\n`;
      // Premium Design Rules Engine — 风格感知的高级设计规则注入
      userMessage += `\n\n${formatPremiumRulesContext(context?.styleName as string | undefined)}`;
      // Design Mode System — 模式控制（精准复刻 / 设计升级）
      if (context?.mode) {
        userMessage += `\n\n${buildModeControlPrompt(context.mode as 'clone' | 'enhancement')}`;
      }
      // Enhancement Plan 注入（设计升级模式）
      if (context?.enhancementPlan) {
        userMessage += `\n\n${formatEnhancementPlanContext(context.enhancementPlan as never)}`;
      }
      // Handle auto-optimization context
      if (context?.optimizationIssues) {
        userMessage += `\n\n## ⚡ 自动优化模式\n${context.optimizationIssues as string}\n请确保本轮生成的代码已修复以上所有问题。`;
      }
    } else if (step === 'animation') {
      // Phase 6 — GSAP 动效恢复：基于检测到的 AnimationData 复刻原站动态体验
      // interaction 用 full 粒度：动效恢复需要完整的「什么触发 → 变成什么样」
      const animationPkg = buildWebsitePackage({
        scraped: await getScraped(url),
        interaction: (await getInteraction(url)) ?? undefined,
        layout: (await getLayout(url)) ?? undefined,
      });
      // 动效阶段沿用既有「失败降级、不阻断静态页生成」的契约（见 ARCHITECTURE §3）：
      // 契约违约时只记日志并降级成无包输入，**不**拒绝执行。
      const animationGate = gatePackageForStep(animationPkg, 'animation');
      userMessage += `\n\n${buildAnimationUserMessage({
        pkg: animationGate.ok ? animationPkg : null,
        structure: (context?.componentTree as string) || (context?.structure as string) || undefined,
        mode: (context?.mode as 'clone' | 'enhancement') || 'clone',
      })}`;
    } else if (step === 'qa') {
      // Visual Evaluation Agent — 评价视觉效果而非代码
      // Sprint B：输入从「HTML 源码」升级为「两张截图 + 还原度 Diff 报告」，
      // HTML 降级为辅助参考（见 buildVisualEvaluationUserMessage）。
      const previewHtml = (context?.previewHtml as string) || '';
      const designAnalysisSummary = (context?.designAnalysisSummary as string) || '';
      const designSystemSummary = (context?.designSystemSummary as string) || '';
      const round = typeof context?.round === 'number' ? (context.round as number) : undefined;
      const diffReportJson = (context?.diffReportJson as string) || '';

      userMessage = buildVisualEvaluationUserMessage(previewHtml, designAnalysisSummary, designSystemSummary, round, diffReportJson);
    } else if (step === 'optimize') {
      // Optimization Agent — 根据视觉评分生成优化方案
      const visualScoreJson = (context?.visualScoreJson as string) || '{}';
      const round = typeof context?.round === 'number' ? (context.round as number) : 1;
      userMessage = buildOptimizationPlanUserMessage(visualScoreJson, round);
    } else if (step === 'enhance') {
      // Enhancement Agent — 设计升级方案（保留 80% DNA + 优化 20%）
      const designAnalysisSummary = (context?.designAnalysisSummary as string) || '';
      const designSystemSummary = (context?.designSystemSummary as string) || '';
      userMessage = buildEnhancementUserMessage(designAnalysisSummary, designSystemSummary);
    } else if (step === 'preview') {
      // Preview Agent — 方法论核心：读懂代码→提取真实内容→重建忠实 HTML
      const da = context?.designAnalysis as Record<string, unknown> | undefined;
      const ds = context?.designSystem as Record<string, unknown> | undefined;
      const componentCode = (context?.componentCodeContent as string) || '';
      const generationMode = (context?.mode as string) || 'enhancement';

      userMessage = `# 任务：将 React 组件代码重建为可直接打开的 HTML 页面\n\n`;
      userMessage += `你将收到一个网站的 React/TypeScript 组件源码。这些代码是用 AI 从真实网站（${url}）分析生成的。\n`;
      userMessage += `你的任务是：读懂这些代码想表达什么，然后用一个自包含的 HTML 文件忠实地重建那个网站的视觉设计。\n\n`;

      // Mode-aware instructions
      if (generationMode === 'clone') {
        userMessage += `## 🎯 当前模式：精准复刻（Pixel-Perfect Clone）\n\n`;
        userMessage += `**你的唯一目标是 1:1 还原原网站。不允许任何创意发挥。**\n\n`;
        userMessage += `必须做到：\n`;
        userMessage += `- 布局结构与原网站完全一致（导航、Hero、内容区、Footer 的位置和比例）\n`;
        userMessage += `- 配色与原网站完全一致（从代码中提取的真实颜色值，不要替换）\n`;
        userMessage += `- 字体与原网站一致（字号、字重、行高）\n`;
        userMessage += `- 所有文案内容与原网站一致（从代码中提取，不要编造）\n`;
        userMessage += `- 图片位置与原网站一致（用 CSS 渐变或 picsum.photos 占位）\n`;
        userMessage += `- 交互效果与原网站一致（hover、动画、过渡）\n\n`;
        userMessage += `严格禁止：\n`;
        userMessage += `- ❌ 添加原网站没有的设计元素\n`;
        userMessage += `- ❌ 修改布局逻辑或区块顺序\n`;
        userMessage += `- ❌ 自定义优化或"改进"原设计\n`;
        userMessage += `- ❌ 删除原网站有的模块\n`;
        userMessage += `- ❌ 改变品牌风格或配色方案\n`;
        userMessage += `- ❌ 使用通用模板样式（如 Apple 蓝 #0071E3，除非原网站就是这个颜色）\n\n`;
        userMessage += `**判断标准：把生成的 HTML 和原网站截图并排放，应该看起来像同一个网站。**\n\n`;
      } else {
        userMessage += `## 🎯 当前模式：设计升级（Design Enhancement）\n\n`;
        userMessage += `保留原网站 80% 的设计 DNA，优化 20% 提升品质感。\n\n`;
        userMessage += `必须保留：\n`;
        userMessage += `- 品牌定位和核心视觉语言\n`;
        userMessage += `- 页面核心结构（布局逻辑）\n`;
        userMessage += `- 主色体系和品牌色\n`;
        userMessage += `- 核心内容和文案\n\n`;
        userMessage += `可以优化：\n`;
        userMessage += `- 视觉层级（标题大小、间距）\n`;
        userMessage += `- 动画效果（添加滚动渐显、hover 效果）\n`;
        userMessage += `- 留白和呼吸感\n`;
        userMessage += `- 组件形式（卡片→故事化布局）\n`;
        userMessage += `- 整体高级感和商业感\n\n`;
        userMessage += `**判断标准：看起来像原网站的高级版本，而不是另一个网站。**\n\n`;
      }

      userMessage += `---\n\n`;

      // 核心：组件源码（最重要的数据）
      if (componentCode) {
        userMessage += `## 组件源码（最重要——从中提取所有真实内容）\n\n`;
        userMessage += `以下是该网站的完整 React 组件代码。\n`;
        userMessage += `**你必须从这些代码中提取所有真实内容**：\n`;
        userMessage += `- 导航栏的所有菜单项文字\n`;
        userMessage += `- 所有标题、副标题、正文段落\n`;
        userMessage += `- 产品名称、价格、描述\n`;
        userMessage += `- 客户评价、合作品牌、功能列表\n`;
        userMessage += `- 按钮文字、链接文字、标签\n`;
        userMessage += `- 代码中出现的颜色值（如 bg-[#xxx]、text-[#xxx]、color: #xxx）\n\n`;
        userMessage += `**禁止使用 lorem ipsum 或任何编造的文案。必须使用代码中出现的原始文字。**\n\n`;
        userMessage += `\`\`\`tsx\n${componentCode.substring(0, 30000)}\n\`\`\`\n\n`;
        userMessage += `---\n\n`;
      }

      // 辅助：设计分析摘要（仅作为参考，代码优先）
      userMessage += `## 设计分析摘要（仅供参考，以代码中的实际值为准）\n\n`;
      if (da?.colors && Array.isArray(da.colors)) {
        userMessage += `**颜色**：`;
        userMessage += (da.colors as Array<Record<string, string>>).map(c => `${c.hex}(${c.usage || ''})`).join('、') + '\n\n';
      }
      if (da?.typography && Array.isArray(da.typography)) {
        userMessage += `**字体**：`;
        userMessage += (da.typography as Array<Record<string, string>>).map(t => `${t.family} ${t.weight}`).join('、') + '\n\n';
      }

      // 设计令牌可信度判断
      userMessage += `## 设计令牌可信度判断\n\n`;
      userMessage += `AI 生成的设计令牌可能不准确。请按以下规则判断：\n`;
      userMessage += `1. 如果令牌颜色是品牌专属的（如可口可乐 #E61A27、B站 #FB7299），**忠实采用**\n`;
      userMessage += `2. 如果令牌是通用苹果蓝 #0071E3 + SF Pro 字体，但目标网站不是 Apple，则令牌**不可信**\n`;
      userMessage += `3. 令牌不可信时，从组件代码中提取真实品牌色（找 bg-[#xxx]、text-[#xxx] 等 Tailwind 类名或内联样式中的颜色值）\n`;
      userMessage += `4. 如果代码中也找不到品牌色，根据目标 URL（${url}）的品牌特征推断配色\n\n`;

      // HTML 输出要求
      userMessage += `## HTML 输出要求\n\n`;
      userMessage += `生成一个完整的、自包含的 HTML 文件（从 <!DOCTYPE html> 到 </html>）。\n\n`;
      userMessage += `**技术要求**：\n`;
      userMessage += `- 使用 Tailwind CSS CDN：<script src="https://cdn.tailwindcss.com"></script>\n`;
      userMessage += `- 所有样式内联在 <style> 标签中（Tailwind CDN 除外）\n`;
      userMessage += `- 所有 JS 内联在 <script> 标签中\n`;
      userMessage += `- 不依赖任何外部资源（除 Tailwind CDN 和 picsum.photos）\n\n`;
      userMessage += `**严禁使用以下 Tailwind 构建指令（CDN 模式不支持，会导致样式完全失效）**：\n`;
      userMessage += `- ❌ @apply — 禁止在 <style> 中使用 @apply\n`;
      userMessage += `- ❌ @layer — 禁止使用 @layer base/components/utilities\n`;
      userMessage += `- ❌ @screen — 禁止使用 @screen\n`;
      userMessage += `- ❌ @tailwind — 禁止使用 @tailwind\n`;
      userMessage += `所有样式必须直接写在 HTML 元素的 class 属性中（如 class="text-2xl font-bold text-[#1d1d1f]"），不要在 <style> 中定义组件类。\n\n`;
      userMessage += `**每个 HTML 元素都必须有完整的 class 属性**：\n`;
      userMessage += `- ❌ <h1>标题</h1> — 裸标签，浏览器默认样式，极丑\n`;
      userMessage += `- ✅ <h1 class="text-[48px] font-bold text-[#1d1d1f] tracking-tight">标题</h1>\n`;
      userMessage += `- ❌ <p>正文</p>\n`;
      userMessage += `- ✅ <p class="text-[17px] text-[#86868b] leading-[1.5]">正文</p>\n\n`;
      userMessage += `**图片处理（禁止出现 broken image）**：\n`;
      userMessage += `- Hero/封面图：使用 CSS 渐变 + emoji（如 linear-gradient(135deg, #brand1, #brand2) + 🎯）\n`;
      userMessage += `- 产品/内容图：使用 https://picsum.photos/宽度/高度?random=N\n`;
      userMessage += `- 头像：使用 https://picsum.photos/100/100?random=N\n`;
      userMessage += `- 图标：使用 SVG 内联或 emoji\n\n`;
      userMessage += `**交互与动效（必须包含）**：\n`;
      userMessage += `- 所有按钮和链接的 hover 效果（颜色变化、scale、阴影）\n`;
      userMessage += `- 滚动渐显动画（IntersectionObserver + fade-in-up）\n`;
      userMessage += `- 平滑滚动（scroll-behavior: smooth）\n`;
      userMessage += `- 卡片 hover 上浮（translateY(-4px) + shadow 增大）\n\n`;
      userMessage += `**响应式（必须支持）**：\n`;
      userMessage += `- 移动端 375px（单列）\n`;
      userMessage += `- 平板 768px（双列）\n`;
      userMessage += `- 桌面 1440px（完整布局）\n\n`;
      userMessage += `**页面结构**：\n`;
      userMessage += `- 按组件代码中的区块顺序组织页面\n`;
      userMessage += `- 使用语义化 HTML5（nav, main, section, article, footer）\n`;
      userMessage += `- 每个区块都是一个独立的 <section>\n\n`;

      // Phase 6 — 把 Animation Agent 产出的 GSAP 原样内联进最终 HTML
      if (context?.animationScript) {
        userMessage += `\n\n## GSAP 动效（由 Animation Agent 生成，必须原样内联）\n\n`;
        userMessage += `在 </body> 之前依次引入以下两个 CDN，然后把脚本原样放进一个 <script> 标签：\n\n`;
        userMessage += `<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"><\/script>\n`;
        userMessage += `<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js"><\/script>\n\n`;
        userMessage += "```javascript\n" + (context.animationScript as string) + "\n```\n\n";
        userMessage += `规则：\n`;
        userMessage += `- 脚本原样内联，不要改写逻辑、不要增删动画\n`;
        userMessage += `- 若脚本引用了页面上不存在的 selector，跳过那条动画而不是报错\n`;
        userMessage += `- 已有 CSS 过渡的地方不要重复叠加 GSAP\n`;
      }

      userMessage += `---\n\n`;
      userMessage += `**现在请生成完整的 HTML。只输出 HTML 代码，不要任何解释、markdown 标记或代码围栏。**`;
    }

    // --- Inject design knowledge + style context BEFORE calling the model ---
    if ((step === 'planning' || step === 'code') && context?.designKnowledge) {
      systemPrompt += `\n\n${context.designKnowledge as string}`;
    }
    if ((step === 'planning' || step === 'code') && context?.styleContext) {
      systemPrompt += `\n\n${context.styleContext as string}`;
    }

    // ---- Screenshot-based visual reference (multimodal) ----
    // When a website screenshot is available, inject it for Vision and Code steps
    const images: string[] = [];
    const useScreenshot = screenshotBase64 && (step === 'vision' || step === 'code' || step === 'preview');
    if (useScreenshot) {
      images.push(screenshotBase64);
    }
    // Sprint B：qa 注入两张图 —— 原站 + 生成页。
    // 这是三处断裂之一（qa 曾被排除在截图注入之外，「视觉评分 Agent」从未看过任何图）。
    if (step === 'qa' && screenshotBase64) {
      images.push(screenshotBase64);
    }
    if (step === 'qa' && cloneScreenshotBase64) {
      images.push(cloneScreenshotBase64);
    }
    if (useScreenshot) {

      if (step === 'vision') {
        userMessage = `## 重要：以下是目标网站的实际截图，请仔细分析其视觉设计\n\n` + userMessage;
        userMessage += `\n\n请基于以上截图，重点分析：\n`;
        userMessage += `1. 精确的品牌配色（主色、辅色、背景色、文字色）\n`;
        userMessage += `2. 字体层级（标题大小、正文大小、字重）\n`;
        userMessage += `3. 布局结构（网格系统、间距节奏、区块划分）\n`;
        userMessage += `4. 视觉层次（主要视觉元素、次要元素、CTA 位置）\n`;
        userMessage += `5. 设计风格（极简/科技感/温暖/专业等）\n`;
        userMessage += `请从截图中提取真实的色值（十六进制），而非猜测。\n`;
      }

      if (step === 'code') {
        userMessage += `\n\n## 重要：以下是目标网站的实际截图，请严格参照其视觉设计生成代码\n\n`;
        userMessage += `请仔细观察截图中的：\n`;
        userMessage += `- 精确的配色方案（从截图中提取真实颜色，不要使用通用蓝色 #0071E3）\n`;
        userMessage += `- 导航栏布局、Hero 区域设计、内容区块排列\n`;
        userMessage += `- 按钮样式、卡片设计、间距节奏\n`;
        userMessage += `- 整体视觉风格和品牌调性\n`;
        userMessage += `生成的 HTML 必须在视觉上尽可能接近截图中的原始网站。\n`;
      }

      if (step === 'preview') {
        const isClone = (context?.mode as string) === 'clone';
        if (isClone) {
          userMessage += `\n\n## 📸 以下是目标网站的实际截图——这是你最重要的参考\n\n`;
          userMessage += `**你必须严格照着这个截图来生成 HTML，做到像素级还原：**\n`;
          userMessage += `- 截图中的每个颜色值都要精确匹配（提取 hex 值）\n`;
          userMessage += `- 截图中的布局结构（导航、Hero、内容区、Footer）必须完全一致\n`;
          userMessage += `- 截图中的字体大小比例、间距比例必须一致\n`;
          userMessage += `- 截图中的按钮样式、卡片样式、图标风格必须一致\n`;
          userMessage += `- 不要"改进"截图中的任何设计元素，严格还原\n`;
        } else {
          userMessage += `\n\n## 重要：以下是目标网站的实际截图，请参考生成 HTML\n\n`;
          userMessage += `请参考截图中的配色、布局和设计风格，但可以适当优化提升品质感。\n`;
          userMessage += `特别注意：不要使用通用的 Apple 蓝色 #0071E3，而是使用截图中实际出现的品牌颜色。\n`;
        }
      }
    }

    // Determine max tokens based on step.
    // 注意：mimo-v2.5 与 mimo-v2.5-pro 均为推理模型，会在 reasoning_content 中产出长链思考，
    // 因此 max_tokens 实际约束「推理+答案」总 token 数，直接决定单阶段最长墙钟时间。
    // 原值过大（code=16384 / preview=32768），在 MiMo provider ~1-2 tok/s 吞吐下会撑到 10min+。
    // 这里下调以约束单阶段耗时（仍保留足够余量，避免正常输出被截断）。
    const maxTokens = step === 'preview' ? 12288 : step === 'code' ? 8192 : step === 'vision' ? 4096 : 2048;
    const baseTemp = step === 'code' ? 0.2 : step === 'vision' ? 0.15 : step === 'preview' ? 0.2 : 0.3;
    // Clone mode = lower temp (deterministic), Enhancement = higher temp (creative)
    const temperature = step === 'preview' && (context?.mode as string) === 'clone' ? 0.1 : baseTemp;

    const callStartedAt = Date.now();

    // ---- SSE streaming path ----
    // 服务端以 text/event-stream 逐 token 推流。客户端（use-workflow.callMimoAPI）
    // 实时把 delta 写入 agent.streamingText，让 code(>3min) 等长时间阶段也能即时吐字。
    const encoder = new TextEncoder();
    const sse = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const aiStream = await callMiMoStream(systemPrompt, userMessage, {
            temperature,
            maxTokens,
            modelConfig,
            images: images.length > 0 ? images : undefined,
          });

          const reader = aiStream.getReader();
          let answerAcc = ''; // 仅累积 content（最终答案）；reasoning 只用于实时展示，不污染最终 JSON 解析

          // 逐 delta 推送（content=答案, reasoning=推理过程）
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value?.content) {
              answerAcc += value.content;
              controller.enqueue(sse({ type: 'delta', text: value.content }));
            }
            if (value?.reasoning) {
              controller.enqueue(sse({ type: 'reasoning', text: value.reasoning }));
            }
          }

          // ---- 实时埋点：记录本次 AI API 调用 ----
          liveStats.trackApiCall({
            generationId,
            step,
            model: effectiveModel,
            targetUrl: url,
            status: 'success',
            httpStatus: 200,
            durationMs: Date.now() - callStartedAt,
            promptChars: systemPrompt.length + userMessage.length,
            completionChars: answerAcc.length,
          });

          // Try to parse JSON for structured steps
          let parsed: unknown = answerAcc;
          if (['vision', 'planning', 'qa', 'optimize', 'enhance'].includes(step)) {
            try {
              const trimmed = answerAcc.trim();

              // Strategy 1: Direct JSON parse
              if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                parsed = JSON.parse(trimmed);
              } else {
                // Strategy 2: Extract from markdown code block
                const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (codeBlockMatch) {
                  parsed = JSON.parse(codeBlockMatch[1].trim());
                } else {
                  // Strategy 3: Find first JSON object or array in the text
                  const firstBrace = trimmed.search(/[\{\[]/);
                  if (firstBrace !== -1) {
                    const jsonCandidate = trimmed.slice(firstBrace);
                    // Find matching closing brace
                    let depth = 0;
                    let lastValid = -1;
                    const openChar = jsonCandidate[0];
                    const closeChar = openChar === '{' ? '}' : ']';
                    for (let i = 0; i < jsonCandidate.length; i++) {
                      if (jsonCandidate[i] === openChar) depth++;
                      if (jsonCandidate[i] === closeChar) depth--;
                      if (depth === 0) { lastValid = i + 1; break; }
                    }
                    if (lastValid > 0) {
                      parsed = JSON.parse(jsonCandidate.slice(0, lastValid));
                    } else {
                      parsed = { raw: answerAcc };
                    }
                  } else {
                    parsed = { raw: answerAcc };
                  }
                }
              }
            } catch {
              // If all JSON parsing fails, return raw text
              parsed = { raw: answerAcc };
            }
          }

          // --- B.2.4.1：质量分服务端权威写入（防客户端伪造污染迁移样本）---
          // mimo 的 qa 步骤算出的 overall_score 直接落账本；/api/track 不再接受客户端分数。
          // 这里用的 normalizeVisualScore 与客户端完全一致，故账本分数 == 界面显示分数。
          if (step === 'qa' && typeof generationId === 'string') {
            try {
              const visualScore = normalizeVisualScore(parsed, 1);
              void recordGenerationQuality({ id: generationId, overallScore: visualScore.overall_score });
            } catch {
              // 评分规范化失败不影响主流程
            }
            // --- P3-11：QA 报告产物（json + 人读 md + 一行可取证日志）---
            // 旁路能力：开关默认关闭（RUN_ARTIFACTS=on 才落盘），且 emitQaReport 永不抛错。
            // 读的是模型**原始**输出而非归一化结果 —— 只有原文才保留
            // severity / priority / reason / solution 与「契约表达不了的分类」。
            void emitQaReport({ generationId, sourceUrl: url, raw: parsed });
          }

          // --- Design Knowledge Base matching ---
          let designKnowledge: string | undefined;

          if (step === 'vision' && typeof parsed === 'object' && parsed !== null) {
            // Match analysis against knowledge base
            const analysis = parsed as Record<string, unknown>;
            const matched = matchDesignPatterns({
              colors: analysis.colors as Array<{ hex: string; name?: string; usage?: string }> | undefined,
              typography: analysis.typography as Array<{ family?: string; size?: string }> | undefined,
              layout: analysis.layout as Record<string, unknown> | undefined,
              raw: answerAcc,
            });
            if (matched.length > 0) {
              designKnowledge = formatKnowledgeContext(matched);
              console.log(`[Knowledge] Matched ${matched.length} patterns: ${matched.map(p => p.name).join(', ')}`);
            }
          }

          controller.enqueue(
            sse({
              type: 'done',
              payload: {
                step,
                result: parsed,
                raw: answerAcc,
                scraped:
                  step === 'vision'
                    ? {
                        success: scrapedData !== null,
                        colors: scrapedData?.colors.length || 0,
                        fonts: scrapedData?.fonts.length || 0,
                        externalCSS: scrapedData?.externalCSSCount || 0,
                      }
                    : undefined,
                designKnowledge,
              },
            }),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.error('[MiMo Stream Error]', message);

          // ---- 实时埋点：记录失败的 AI API 调用 ----
          liveStats.trackApiCall({
            generationId,
            step,
            model: effectiveModel,
            targetUrl: url,
            status: 'error',
            httpStatus: 500,
            durationMs: Date.now() - callStartedAt,
            promptChars: systemPrompt.length + userMessage.length,
            completionChars: 0,
          });

          try {
            controller.enqueue(sse({ type: 'error', error: message }));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch {
            // controller may already be closed
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[MiMo API Error]', message);

    // ---- 实时埋点：记录失败的 API 调用 ----
    liveStats.trackApiCall({
      generationId: rawBody?.generationId,
      step: rawBody?.step || 'unknown',
      model: rawBody?.modelConfig?.model || process.env.MIMO_MODEL || 'mimo-v2.5',
      targetUrl: rawBody?.url || '',
      status: 'error',
      httpStatus: 500,
      durationMs: Date.now() - handlerStartedAt,
      promptChars: 0,
      completionChars: 0,
      error: message,
    });

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
