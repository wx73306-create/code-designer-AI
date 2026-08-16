"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Download,
  Copy,
  Check,
  Globe,
  Clock,
  Zap,
  Package,
  FileText,
  FileCode,
  Presentation,
  BookOpen,
  MessageSquare,
  Loader2,
  RotateCcw,
  Home,
  Palette,
  LayoutGrid,
  Sparkles,
  Star,
  FolderArchive,
  SwatchBook,
  Layers,
  Wand2,
  FileJson,
  PaintBucket,
  Grid3x3,
  MonitorSmartphone,
  MousePointerClick,
  Code2,
  FileType,
  Monitor,
  Smartphone,
  Eye,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { generateExportContent, type ExportData } from "@/lib/export-generator";
import { buildPreviewHtml } from "@/lib/preview-utils";
import { useAgentStore } from "@/store/agent-store";
import type { GoalType } from "@/types/agent";

// =============================================================================
// Types
// =============================================================================

interface ExportOption {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  format: string;
  description: string;
  color: string;
  bgColor: string;
  filename: string;
  mimeType: string;
}

interface GoalConfig {
  successTitle: string;
  successSubtitle: string;
  summaryLabel: string;
  stats: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[];
  exports: ExportOption[];
}

// =============================================================================
// Copy Button
// =============================================================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-black/[0.06] transition-colors duration-150 text-black/30 hover:text-black/60"
      aria-label="Copy"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-[#34C759]" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// =============================================================================
// Goal-specific configurations
// =============================================================================

const GOAL_CONFIGS: Record<string, GoalConfig> = {
  colors: {
    successTitle: "配色方案已生成!",
    successSubtitle: "已提取完整色彩体系并生成配色分析报告",
    summaryLabel: "色彩分析摘要",
    stats: [
      { label: "提取颜色", value: "12 色", icon: Palette },
      { label: "色彩和谐度", value: "94%", icon: Sparkles },
      { label: "主色调", value: "#0071E3", icon: PaintBucket },
    ],
    exports: [
      {
        icon: Presentation,
        title: "配色分析报告",
        format: ".html",
        description: "完整色彩体系分析：主色/辅色/强调色/中性色阶，颜色语义与使用场景",
        color: "text-purple-600",
        bgColor: "bg-purple-500/10",
        filename: "color-analysis-report.html",
        mimeType: "text/html",
      },
      {
        icon: FileJson,
        title: "设计Token",
        format: ".json",
        description: "DTCG 标准格式的设计 Token 文件，可直接导入设计系统工具链",
        color: "text-amber-600",
        bgColor: "bg-amber-500/10",
        filename: "design-tokens-colors.json",
        mimeType: "application/json",
      },
      {
        icon: FileCode,
        title: "Tailwind 配色配置",
        format: ".css",
        description: "CSS 自定义属性 + Tailwind 配色扩展，可直接粘贴到项目中使用",
        color: "text-teal-600",
        bgColor: "bg-teal-500/10",
        filename: "tailwind-colors.css",
        mimeType: "text/css",
      },
      {
        icon: SwatchBook,
        title: "推荐配色方案",
        format: ".json",
        description: "基于原站风格推导的 5 套替代配色方案，含主色+辅色+强调色+背景色",
        color: "text-pink-600",
        bgColor: "bg-pink-500/10",
        filename: "color-recommendations.json",
        mimeType: "application/json",
      },
      {
        icon: MessageSquare,
        title: "AI Prompt",
        format: ".md",
        description: "可导入 Cursor / Claude AI 的色彩学习项目上下文 Prompt 文件",
        color: "text-orange-600",
        bgColor: "bg-orange-500/10",
        filename: "color-study-prompt.md",
        mimeType: "text/plain",
      },
    ],
  },

  layout: {
    successTitle: "布局方案已解析!",
    successSubtitle: "已提取完整布局结构并生成排版分析文档",
    summaryLabel: "布局分析摘要",
    stats: [
      { label: "网格系统", value: "12列", icon: Grid3x3 },
      { label: "响应式断点", value: "4 个", icon: MonitorSmartphone },
      { label: "布局区块", value: "7 区", icon: LayoutGrid },
    ],
    exports: [
      {
        icon: Presentation,
        title: "布局分析报告",
        format: ".html",
        description: "详细的页面布局拆解：导航/Hero/内容区/卡片网格/页脚的结构分析",
        color: "text-purple-600",
        bgColor: "bg-purple-500/10",
        filename: "layout-analysis-report.html",
        mimeType: "text/html",
      },
      {
        icon: FileCode,
        title: "Grid/Flex 模板代码",
        format: ".css",
        description: "CSS Grid 和 Flexbox 布局模板，含断点媒体查询和间距系统",
        color: "text-teal-600",
        bgColor: "bg-teal-500/10",
        filename: "layout-templates.css",
        mimeType: "text/css",
      },
      {
        icon: BookOpen,
        title: "响应式策略文档",
        format: ".md",
        description: "断点策略、容器约束、内容流式布局规则的完整文档",
        color: "text-emerald-600",
        bgColor: "bg-emerald-500/10",
        filename: "responsive-strategy.md",
        mimeType: "text/plain",
      },
      {
        icon: FileJson,
        title: "间距系统 Token",
        format: ".json",
        description: "间距、圆角、容器宽度的 Design Token 定义，可直接用于 tailwind.config",
        color: "text-amber-600",
        bgColor: "bg-amber-500/10",
        filename: "layout-tokens.json",
        mimeType: "application/json",
      },
      {
        icon: MessageSquare,
        title: "AI Prompt",
        format: ".md",
        description: "可导入 Cursor / Claude AI 的布局学习项目上下文 Prompt 文件",
        color: "text-orange-600",
        bgColor: "bg-orange-500/10",
        filename: "layout-study-prompt.md",
        mimeType: "text/plain",
      },
    ],
  },

  style: {
    successTitle: "风格指南已生成!",
    successSubtitle: "已提取设计语言特征并生成完整风格指南",
    summaryLabel: "风格分析摘要",
    stats: [
      { label: "设计风格", value: "极简", icon: Sparkles },
      { label: "形状语言", value: "大圆角", icon: Layers },
      { label: "动效风格", value: "弹性缓动", icon: Wand2 },
    ],
    exports: [
      {
        icon: Presentation,
        title: "设计语言指南",
        format: ".html",
        description: "设计风格归类、品牌视觉语言、材质质感策略的完整分析报告",
        color: "text-purple-600",
        bgColor: "bg-purple-500/10",
        filename: "design-style-guide.html",
        mimeType: "text/html",
      },
      {
        icon: Wand2,
        title: "动效规范文档",
        format: ".md",
        description: "缓动曲线、动画时长、微交互规则、过渡策略的详细规范",
        color: "text-indigo-600",
        bgColor: "bg-indigo-500/10",
        filename: "animation-spec.md",
        mimeType: "text/plain",
      },
      {
        icon: FileJson,
        title: "设计系统规范",
        format: ".json",
        description: "阴影层级、模糊参数、透明度策略、渐变定义的 Token 文件",
        color: "text-amber-600",
        bgColor: "bg-amber-500/10",
        filename: "design-system-tokens.json",
        mimeType: "application/json",
      },
      {
        icon: BookOpen,
        title: "品牌视觉手册",
        format: ".mdx",
        description: "形状语言、图标风格、图片/插图风格、设计情感传达的完整文档",
        color: "text-emerald-600",
        bgColor: "bg-emerald-500/10",
        filename: "brand-visual-guide.mdx",
        mimeType: "text/plain",
      },
      {
        icon: MessageSquare,
        title: "AI Prompt",
        format: ".md",
        description: "可导入 Cursor / Claude AI 的风格学习项目上下文 Prompt 文件",
        color: "text-orange-600",
        bgColor: "bg-orange-500/10",
        filename: "style-study-prompt.md",
        mimeType: "text/plain",
      },
    ],
  },

  features: {
    successTitle: "特色功能已提取!",
    successSubtitle: "已挖掘网站亮点交互并生成功能分析文档",
    summaryLabel: "特色分析摘要",
    stats: [
      { label: "独特交互", value: "8 项", icon: MousePointerClick },
      { label: "创新组件", value: "6 个", icon: Star },
      { label: "动画效果", value: "15 个", icon: Sparkles },
    ],
    exports: [
      {
        icon: Presentation,
        title: "特色功能报告",
        format: ".html",
        description: "独特交互设计、创新功能组件、动画效果的详细分析报告",
        color: "text-purple-600",
        bgColor: "bg-purple-500/10",
        filename: "feature-highlights-report.html",
        mimeType: "text/html",
      },
      {
        icon: BookOpen,
        title: "交互设计文档",
        format: ".mdx",
        description: "滚动效果、视差、手势操作、hover 效果等交互模式的完整文档",
        color: "text-emerald-600",
        bgColor: "bg-emerald-500/10",
        filename: "interaction-patterns.mdx",
        mimeType: "text/plain",
      },
      {
        icon: FileJson,
        title: "动画参数配置",
        format: ".json",
        description: "入场动画、过渡效果、微交互的 Framer Motion 参数配置",
        color: "text-amber-600",
        bgColor: "bg-amber-500/10",
        filename: "animation-config.json",
        mimeType: "application/json",
      },
      {
        icon: Zap,
        title: "性能优化方案",
        format: ".md",
        description: "懒加载策略、骨架屏方案、渐进增强手段的优化建议文档",
        color: "text-yellow-600",
        bgColor: "bg-yellow-500/10",
        filename: "performance-optimization.md",
        mimeType: "text/plain",
      },
      {
        icon: MessageSquare,
        title: "AI Prompt",
        format: ".md",
        description: "可导入 Cursor / Claude AI 的特色功能学习项目上下文 Prompt 文件",
        color: "text-orange-600",
        bgColor: "bg-orange-500/10",
        filename: "features-study-prompt.md",
        mimeType: "text/plain",
      },
    ],
  },

  template: {
    successTitle: "项目模板已打包!",
    successSubtitle: "已生成完整可运行的项目脚手架，下载即可开发",
    summaryLabel: "模板摘要",
    stats: [
      { label: "项目文件", value: "14 个", icon: FileType },
      { label: "组件数量", value: "12 个", icon: Code2 },
      { label: "代码行数", value: "2,847", icon: FileText },
    ],
    exports: [
      {
        icon: FolderArchive,
        title: "完整项目脚手架",
        format: ".zip",
        description: "包含所有源码、配置和依赖文件的完整 Next.js 项目，npm install 即可运行",
        color: "text-blue-600",
        bgColor: "bg-blue-500/10",
        filename: "project-scaffold.zip",
        mimeType: "application/zip",
      },
      {
        icon: BookOpen,
        title: "组件 API 文档",
        format: ".mdx",
        description: "所有 React 组件的完整文档，含 Props 接口、使用示例和变体说明",
        color: "text-emerald-600",
        bgColor: "bg-emerald-500/10",
        filename: "component-api-docs.mdx",
        mimeType: "text/plain",
      },
      {
        icon: FileJson,
        title: "设计Token配置",
        format: ".json",
        description: "完整的设计 Token 定义：颜色、字体、间距、阴影、动画参数",
        color: "text-amber-600",
        bgColor: "bg-amber-500/10",
        filename: "design-tokens.json",
        mimeType: "application/json",
      },
      {
        icon: Presentation,
        title: "技术架构文档",
        format: ".html",
        description: "技术栈说明、目录规划、命名规范、依赖关系和开发工作流文档",
        color: "text-purple-600",
        bgColor: "bg-purple-500/10",
        filename: "architecture-docs.html",
        mimeType: "text/html",
      },
      {
        icon: MessageSquare,
        title: "AI Prompt",
        format: ".md",
        description: "可导入 Cursor / Claude AI 的项目上下文 Prompt，辅助二次开发",
        color: "text-orange-600",
        bgColor: "bg-orange-500/10",
        filename: "template-dev-prompt.md",
        mimeType: "text/plain",
      },
    ],
  },
};

// Default config when no goal is selected
const DEFAULT_CONFIG: GoalConfig = {
  successTitle: "分析完成!",
  successSubtitle: "所有分析任务已完成，可导出学习成果",
  summaryLabel: "项目摘要",
  stats: [
    { label: "分析用时", value: "23.4s", icon: Clock },
    { label: "生成文件", value: "14 个", icon: FileText },
    { label: "代码行数", value: "2,847", icon: Code2 },
  ],
  exports: [
    {
      icon: Package,
      title: "下载完整项目",
      format: ".zip",
      description: "包含所有源码、配置和依赖文件的完整 Next.js 项目",
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
      filename: "project-export.zip",
      mimeType: "application/zip",
    },
    {
      icon: Presentation,
      title: "设计分析报告",
      format: ".html",
      description: "完整的视觉设计分析报告：色彩、字体、间距、阴影和动效（可打印 HTML）",
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
      filename: "design-analysis-report.html",
      mimeType: "text/html",
    },
    {
      icon: BookOpen,
      title: "组件文档",
      format: ".mdx",
      description: "所有 React 组件的完整文档，包含 Props 说明和示例",
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
      filename: "components-docs.mdx",
      mimeType: "text/plain",
    },
    {
      icon: MessageSquare,
      title: "Cursor AI Prompt",
      format: ".md",
      description: "可直接导入 Cursor AI 的项目上下文 Prompt 文件",
      color: "text-orange-600",
      bgColor: "bg-orange-500/10",
      filename: "cursor-prompt.md",
      mimeType: "text/plain",
    },
    {
      icon: FileCode,
      title: "Claude AI Prompt",
      format: ".md",
      description: "适用于 Claude AI 的项目上下文与开发指令文档",
      color: "text-sky-600",
      bgColor: "bg-sky-500/10",
      filename: "claude-prompt.md",
      mimeType: "text/plain",
    },
    {
      icon: FileText,
      title: "项目总结报告",
      format: ".html",
      description: "完整的项目总结：工作流程、技术栈、性能指标和优化建议（可打印 HTML）",
      color: "text-pink-600",
      bgColor: "bg-pink-500/10",
      filename: "project-summary.html",
      mimeType: "text/html",
    },
  ],
};

// =============================================================================
// 导出选项（仅 3 个）
// =============================================================================

const HTML_EXPORT_OPTION: ExportOption = {
  icon: Globe,
  title: "网页 HTML 文件",
  format: ".html",
  description: "复刻网页的自包含 HTML（含样式），下载后双击即可用浏览器直接打开",
  color: "text-sky-600",
  bgColor: "bg-sky-500/10",
  filename: "website.html",
  mimeType: "text/html",
};

const REPORT_EXPORT_OPTION: ExportOption = {
  icon: Presentation,
  title: "设计分析报告",
  format: ".html",
  description: "完整的视觉设计分析报告：色彩、字体、间距、阴影和动效（可打印 HTML）",
  color: "text-purple-600",
  bgColor: "bg-purple-500/10",
  filename: "design-analysis-report.html",
  mimeType: "text/html",
};

const PROJECT_ZIP_OPTION: ExportOption = {
  icon: Package,
  title: "项目完整包",
  format: ".zip",
  description: "包含所有源码、配置和依赖文件的完整 Next.js 项目，npm install 即可运行",
  color: "text-blue-600",
  bgColor: "bg-blue-500/10",
  filename: "project-export.zip",
  mimeType: "application/zip",
};

const EXPORT_OPTIONS = [HTML_EXPORT_OPTION, REPORT_EXPORT_OPTION, PROJECT_ZIP_OPTION];

// =============================================================================
// Goal icon and color mapping
// =============================================================================

const GOAL_META: Record<string, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; label: string }> = {
  colors: { icon: Palette, color: "#AF52DE", label: "学习配色" },
  layout: { icon: LayoutGrid, color: "#FF9500", label: "学习排版" },
  style: { icon: Sparkles, color: "#30B0C7", label: "学习风格" },
  features: { icon: Star, color: "#FF375F", label: "学习特色" },
  template: { icon: FolderArchive, color: "#34C759", label: "构建模板" },
};

/** Safe dynamic icon renderer for GOAL_META */
function GoalIcon({ goal, className, size = "w-4 h-4" }: { goal: string; className?: string; size?: string }) {
  const meta = GOAL_META[goal];
  if (!meta) return null;
  const Icon = meta.icon;
  return <Icon className={className ?? size} style={{ color: meta.color }} />;
}
// =============================================================================
// Mock content generators (goal-specific)
// =============================================================================

function generateGoalContent(filename: string, goal: GoalType): string {
  const ts = new Date().toISOString();

  if (filename.endsWith('.json')) {
    if (goal === 'colors') {
      return JSON.stringify({
        "design-tokens": {
          color: {
            primary: { value: "#0071E3", type: "color" },
            secondary: { value: "#5856D6", type: "color" },
            accent: { value: "#FF9500", type: "color" },
            success: { value: "#34C759", type: "color" },
            warning: { value: "#FFCC00", type: "color" },
            danger: { value: "#FF3B30", type: "color" },
            background: { value: "#FFFFFF", type: "color" },
            surface: { value: "#F5F5F7", type: "color" },
            "text-primary": { value: "#1D1D1F", type: "color" },
            "text-secondary": { value: "#6E6E73", type: "color" },
          }
        },
        recommendations: [
          { name: "海洋蓝调", primary: "#0055B3", secondary: "#00A3E0", accent: "#FF6B35", bg: "#F8FAFC", fg: "#1A1A2E" },
          { name: "森林绿意", primary: "#2D6A4F", secondary: "#52B788", accent: "#D4A373", bg: "#FEFAE0", fg: "#283618" },
          { name: "暮光紫韵", primary: "#7B2CBF", secondary: "#C77DFF", accent: "#FFD166", bg: "#FAF0E6", fg: "#10002B" },
        ]
      }, null, 2);
    }
    if (goal === 'layout') {
      return JSON.stringify({
        "layout-tokens": {
          spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", "2xl": "48px", "3xl": "64px" },
          container: { maxWidth: "1200px", padding: "0 24px" },
          breakpoints: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px" },
          grid: { columns: 12, gap: "24px" },
          borderRadius: { sm: "4px", md: "8px", lg: "16px", xl: "24px", full: "9999px" },
        }
      }, null, 2);
    }
    if (goal === 'style') {
      return JSON.stringify({
        "design-system": {
          style: "minimalist",
          shapeLanguage: "large-rounded-corners",
          shadows: { sm: "0 1px 2px rgba(0,0,0,0.05)", md: "0 4px 12px rgba(0,0,0,0.08)", lg: "0 12px 40px rgba(0,0,0,0.12)" },
          blur: { sm: "4px", md: "12px", lg: "40px" },
          gradients: [
            { name: "hero-bg", from: "#0071E3", to: "#5856D6", direction: "135deg" },
            { name: "card-hover", from: "rgba(0,113,227,0.05)", to: "rgba(88,86,214,0.05)", direction: "180deg" },
          ],
          opacity: { disabled: 0.4, hover: 0.8, overlay: 0.6 },
        }
      }, null, 2);
    }
    if (goal === 'features') {
      return JSON.stringify({
        animations: [
          { name: "fadeInUp", property: "opacity, transform", duration: "0.6s", easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" },
          { name: "scaleIn", property: "transform, opacity", duration: "0.3s", easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
          { name: "slideIn", property: "transform", duration: "0.4s", easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" },
          { name: "staggerChildren", delay: "0.05s", perChild: true },
          { name: "parallaxScroll", speed: 0.5, direction: "vertical" },
        ],
        interactions: [
          { name: "hover-lift", transform: "translateY(-4px)", shadow: "0 12px 40px rgba(0,0,0,0.12)" },
          { name: "button-press", transform: "scale(0.97)", duration: "100ms" },
          { name: "nav-blur", backdropFilter: "blur(20px)", background: "rgba(255,255,255,0.72)" },
        ]
      }, null, 2);
    }
    if (goal === 'template') {
      return JSON.stringify({
        "design-tokens": {
          color: { primary: "#0071E3", background: "#FFFFFF", surface: "#F5F5F7" },
          typography: { heading: "Inter, sans-serif", body: "Inter, sans-serif", mono: "JetBrains Mono, monospace" },
          spacing: { base: "4px", scale: [4, 8, 12, 16, 24, 32, 48, 64] },
        },
        "project-config": {
          framework: "Next.js 15",
          styling: "Tailwind CSS 4",
          animations: "Framer Motion",
          icons: "Lucide React",
          state: "Zustand",
        }
      }, null, 2);
    }
  }

  if (filename.endsWith('.css')) {
    if (goal === 'colors') {
      return `/* Design Tokens — Color Palette */
/* Generated by Code Designer AI at ${ts} */

:root {
  /* Primary */
  --color-primary: #0071E3;
  --color-primary-hover: #0077ED;
  --color-primary-light: rgba(0, 113, 227, 0.1);

  /* Secondary */
  --color-secondary: #5856D6;
  --color-secondary-light: rgba(88, 86, 214, 0.1);

  /* Accent */
  --color-accent: #FF9500;
  --color-accent-light: rgba(255, 149, 0, 0.1);

  /* Status */
  --color-success: #34C759;
  --color-warning: #FFCC00;
  --color-danger: #FF3B30;

  /* Neutral */
  --color-bg: #FFFFFF;
  --color-surface: #F5F5F7;
  --color-text: #1D1D1F;
  --color-text-secondary: #6E6E73;
  --color-border: rgba(0, 0, 0, 0.08);
}
`;
    }
    if (goal === 'layout') {
      return `/* Layout Templates — Grid & Flex */
/* Generated by Code Designer AI at ${ts} */

/* Container */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* 12-Column Grid */
.grid-12 {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 24px;
}

/* Responsive Breakpoints */
@media (max-width: 1024px) {
  .grid-12 { grid-template-columns: repeat(8, 1fr); gap: 16px; }
}
@media (max-width: 768px) {
  .grid-12 { grid-template-columns: repeat(4, 1fr); gap: 12px; }
}

/* Spacing System */
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
}
`;
    }
  }

  if (filename.endsWith('.md') || filename.endsWith('.mdx')) {
    const goalLabels: Record<string, string> = {
      colors: '配色学习', layout: '排版学习', style: '风格学习', features: '特色功能学习', template: '模板开发',
    };
    const label = goal ? goalLabels[goal] || '项目' : '项目';
    return `# ${label} — 项目上下文

> Auto-generated by Code Designer AI
> Generated at ${ts}

## 项目概述
本报告基于对目标网站的深度分析生成，聚焦于${label}维度的学习要点。

## 技术栈
- Next.js 15 + React 19
- Tailwind CSS 4
- Framer Motion
- TypeScript
- Zustand

## 核心组件
- Navbar（响应式导航栏）
- HeroSection（全屏 Hero 区域）
- FeatureCards（特性展示卡片）
- ProductGrid（产品网格布局）
- Footer（页脚信息区）

## 设计规范
- 间距系统：4px 基础网格
- 圆角规范：sm(4px) / md(8px) / lg(16px) / xl(24px)
- 阴影层级：sm / md / lg 三级阴影

---
*Generated by Code Designer AI*
`;
  }

  return `Code Designer AI - Export
File: ${filename}
Generated: ${ts}
`;
}

// =============================================================================
// DeploySection (homepage scroll section)
// =============================================================================

export function DeploySection() {
  const task = useAgentStore((s) => s.task);
  const goal = task.goal;
  const baseConfig = GOAL_CONFIGS[goal ?? ''] ?? DEFAULT_CONFIG;
  const config = { ...baseConfig, exports: EXPORT_OPTIONS };
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set());

  // Build preview HTML for download — prefer AI-generated preview (with post-processing cleanup)
  const activePreview = useMemo(() => {
    // AI Preview Agent 生成的 HTML（已清理 motion.*/React 语法）优先
    if (task.aiPreviewHtml) return task.aiPreviewHtml;
    // 回退到正则转换
    if (!task.generatedCode || task.generatedCode.size === 0) return null;
    return buildPreviewHtml(task.generatedCode);
  }, [task.aiPreviewHtml, task.generatedCode]);

  // Collect all pipeline data for real exports
  const exportData: ExportData = {
    url: task.url || '',
    goal: task.goal,
    designAnalysis: task.designAnalysis,
    componentTree: task.componentTree,
    generatedCode: task.generatedCode,
    qaResult: task.qaResult,
    projectStructure: task.projectStructure,
  };

  // Compute real stats from pipeline data
  const realStats = useMemo(() => {
    let fileCount = 0;
    let componentCount = 0;
    let totalLines = 0;

    if (task.generatedCode) {
      fileCount = task.generatedCode.size;
      for (const [, code] of task.generatedCode) {
        totalLines += code.split('\n').length;
      }
    }
    if (task.componentTree) {
      const count = (n: import('@/types/agent').ComponentNode) => { componentCount++; (n.children || []).forEach(count); };
      count(task.componentTree);
    }
    if (task.projectStructure) {
      const countFiles = (nodes: import('@/types/agent').FileNode[]) => {
        for (const n of nodes) {
          if (n.type === 'file') fileCount++;
          if (n.children) countFiles(n.children);
        }
      };
      countFiles(task.projectStructure);
    }

    const elapsed = task.startedAt && task.completedAt
      ? ((task.completedAt - task.startedAt) / 1000).toFixed(1) + 's'
      : '—';

    return {
      files: fileCount > 0 ? `${fileCount} 个` : config.stats[0]?.value || '—',
      components: componentCount > 0 ? `${componentCount} 个` : config.stats[1]?.value || '—',
      lines: totalLines > 0 ? totalLines.toLocaleString() : config.stats[2]?.value || '—',
      elapsed,
    };
  }, [task, config]);

  // Extract clean domain name for filenames
  const domainPrefix = useMemo(() => {
    try {
      const u = new URL(task.url || '');
      return u.hostname.replace(/^www\./, '').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-]/g, '-');
    } catch { return 'project'; }
  }, [task.url]);

  const handleExport = useCallback(async (idx: number) => {
    if (downloadingIdx !== null) return;
    const option = config.exports[idx];
    setDownloadingIdx(idx);

    // Prefix filename with domain: e.g. "mercedes-benz-design-tokens.json"
    const downloadFilename = `${domainPrefix}-${option.filename}`;

    try {
      // 独立 HTML 网页（复刻成果 website.html）→ 直接下载预览 HTML（所见即所得）
      if (option.filename === 'website.html') {
        if (!activePreview) {
          alert('暂无可导出的网页代码，请先完成生成。');
          setDownloadingIdx(null);
          return;
        }
        const blob = new Blob([activePreview], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = downloadFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } else {
        const { content, mimeType } = await generateExportContent(option.filename, exportData);

        if (mimeType === 'text/html') {
          // HTML 报告（PDF 替代）→ 直接下载为 HTML 文件
          const blob = new Blob([content as string], { type: 'text/html' });
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = downloadFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        } else {
          const blob = content instanceof Blob ? content : new Blob([content as string], { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = downloadFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }
      }

      setDoneSet((prev) => new Set(prev).add(idx));
      setTimeout(() => { setDoneSet((prev) => { const next = new Set(prev); next.delete(idx); return next; }); }, 3000);
    } catch (err) {
      console.error('[Export Error]', err);
      alert(`导出失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setDownloadingIdx(null);
    }
  }, [downloadingIdx, config, exportData]);

  return (
    <motion.section
      id="deploy"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full py-24 px-4"
    >
      <div className="mx-auto max-w-5xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A84FF]/10 border border-[#0A84FF]/20 mb-4">
            <Download className="w-3.5 h-3.5 text-[#0A84FF]" />
            <span className="text-xs font-medium text-[#0A84FF]">
              Export Agent
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight bg-gradient-to-r from-[#1d1d1f] to-black/70 bg-clip-text text-transparent">
            {"一键信息导出"}
          </h2>
          <p className="mt-3 text-base text-black/50 max-w-xl mx-auto">
            {
              goal
                ? `根据「${GOAL_META[goal]?.label || goal}」目标，导出对应的学习成果与设计资源`
                : "将分析结果、设计系统与生成代码一键打包导出，支持多种格式下载"
            }
          </p>
        </motion.div>

        {/* Success banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex flex-col items-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.35,
                type: "spring",
                stiffness: 200,
                damping: 12,
              }}
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center mb-5",
                "bg-[#34C759]/15 border-2 border-[#34C759]/30",
                "shadow-[0_0_60px_rgba(52,199,89,0.15)]"
              )}
            >
              <Check className="w-12 h-12 text-[#34C759]" />
            </motion.div>
            <h3 className="text-3xl font-semibold text-[#1d1d1f] mb-1">
              {config.successTitle}
            </h3>
            <p className="text-sm text-black/40">
              {config.successSubtitle}
            </p>
          </div>
        </motion.div>

        {/* Goal summary card */}
        <GlassCard className="p-6 mb-8" animate delay={0.3}>
          <div className="flex items-center gap-2 mb-4">
            {goal && GOAL_META[goal] ? (
              <>
              <GoalIcon goal={goal} size="w-4 h-4" />
                <span className="text-sm font-medium text-black/60">{config.summaryLabel}</span>
              </>
            ) : (
              <>
                <Package className="w-4 h-4 text-black/40" />
                <span className="text-sm font-medium text-black/60">{config.summaryLabel}</span>
              </>
            )}
          </div>
          <div className="grid grid-cols-3 gap-6">
            {config.stats.map((stat, i) => {
              const realValue = i === 0 ? realStats.files : i === 1 ? realStats.components : realStats.lines;
              return (
                <div key={stat.label} className="flex items-center gap-2.5">
                  <stat.icon className="w-3.5 h-3.5 text-black/30" />
                  <div>
                    <div className="text-[10px] text-black/30">{stat.label}</div>
                    <div className="text-[13px] text-black/70 font-medium">{realValue}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Export options grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        >
          <h3 className="text-sm font-medium text-black/50 mb-4 text-center">
            {"导出选项"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {config.exports.map((option, idx) => {
              const isDownloading = downloadingIdx === idx;
              const isDone = doneSet.has(idx);
              return (
                <button
                  key={option.title}
                  onClick={() => handleExport(idx)}
                  disabled={downloadingIdx !== null}
                  className={cn(
                    "rounded-xl border bg-white/75 backdrop-blur-xl p-4 text-left transition-all duration-200 group",
                    isDone ? "border-[#34C759]/30 bg-[#34C759]/[0.03]" : "border-black/[0.06] hover:border-black/[0.12] hover:bg-black/[0.02] hover:scale-[1.02]",
                    downloadingIdx !== null && !isDownloading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        option.bgColor,
                        "border border-black/[0.06]"
                      )}
                    >
                      <option.icon className={cn("w-5 h-5", option.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-medium text-black/80 truncate">
                          {option.title}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/[0.08] text-black/40 font-mono shrink-0 border border-black/[0.06]">
                          {option.format}
                        </span>
                      </div>
                      <p className="text-[11px] text-black/35 leading-relaxed line-clamp-2">
                        {option.description}
                      </p>
                    </div>
                    <div className="shrink-0 mt-1">
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 text-[#0071E3] animate-spin" />
                      ) : isDone ? (
                        <Check className="w-4 h-4 text-[#34C759]" />
                      ) : (
                        <Download className="w-4 h-4 text-black/20 group-hover:text-black/50 transition-colors" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

// =============================================================================
// DeployContent (workspace tab)
// =============================================================================

export function DeployContent() {
  const task = useAgentStore((s) => s.task);
  const goal = task.goal;
  const taskUrl = task.url;
  const baseConfig = GOAL_CONFIGS[goal ?? ''] ?? DEFAULT_CONFIG;
  const config = { ...baseConfig, exports: EXPORT_OPTIONS };
  const resetTask = useAgentStore((s) => s.resetTask);
  const startTask = useAgentStore((s) => s.startTask);

  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set());
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [hiFiPreview, setHiFiPreview] = useState<string | null>(null);
  const [hiFiLoading, setHiFiLoading] = useState(false);

  // Build preview HTML from generated code for live preview (fast regex-based fallback)
  const previewHtml = useMemo(() => {
    if (!task.generatedCode || task.generatedCode.size === 0) return null;
    return buildPreviewHtml(task.generatedCode);
  }, [task.generatedCode]);

  // The active preview: AI Preview Agent > hiFi server-compiled > regex-based
  const activePreview = task.aiPreviewHtml || hiFiPreview || previewHtml;

  // Extract clean domain name for filenames
  const domainPrefix = useMemo(() => {
    try {
      const u = new URL(task.url || '');
      return u.hostname.replace(/^www\./, '').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-]/g, '-');
    } catch { return 'project'; }
  }, [task.url]);

  // Fetch server-compiled high-fidelity preview
  const handleHiFiPreview = useCallback(async () => {
    if (hiFiLoading) return;
    const files = task.generatedCode ? [...task.generatedCode.entries()] : [];
    if (files.length === 0) return;
    setHiFiLoading(true);
    try {
      const res = await fetch('/api/export-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, mode: 'single', title: `${domainPrefix} - Preview` }),
      });
      if (!res.ok) throw new Error('preview compile failed');
      const { html } = await res.json();
      setHiFiPreview(html);
    } catch (err) {
      console.error('[HiFi Preview]', err);
    } finally {
      setHiFiLoading(false);
    }
  }, [hiFiLoading, task.generatedCode, domainPrefix]);

  // Collect all pipeline data for real exports
  const exportData: ExportData = {
    url: task.url || '',
    goal: task.goal,
    designAnalysis: task.designAnalysis,
    componentTree: task.componentTree,
    generatedCode: task.generatedCode,
    qaResult: task.qaResult,
    projectStructure: task.projectStructure,
  };

  // Compute real stats from pipeline data
  const realStats = useMemo(() => {
    let fileCount = 0;
    let componentCount = 0;
    let totalLines = 0;

    if (task.generatedCode) {
      fileCount = task.generatedCode.size;
      for (const [, code] of task.generatedCode) totalLines += code.split('\n').length;
    }
    if (task.componentTree) {
      const count = (n: import('@/types/agent').ComponentNode) => { componentCount++; (n.children || []).forEach(count); };
      count(task.componentTree);
    }
    if (task.projectStructure) {
      const countFiles = (nodes: import('@/types/agent').FileNode[]) => {
        for (const n of nodes) { if (n.type === 'file') fileCount++; if (n.children) countFiles(n.children); }
      };
      countFiles(task.projectStructure);
    }

    return {
      files: fileCount > 0 ? `${fileCount} 个` : config.stats[0]?.value || '—',
      components: componentCount > 0 ? `${componentCount} 个` : config.stats[1]?.value || '—',
      lines: totalLines > 0 ? totalLines.toLocaleString() : config.stats[2]?.value || '—',
    };
  }, [task, config]);

  const handleExport = useCallback(async (idx: number) => {
    if (downloadingIdx !== null) return;
    const option = config.exports[idx];
    setDownloadingIdx(idx);
    const downloadFilename = `${domainPrefix}-${option.filename}`;

    try {
      // 独立 HTML 网页（复刻成果 website.html）→ 直接下载预览 HTML（所见即所得）
      if (option.filename === 'website.html') {
        if (!activePreview) {
          alert('暂无可导出的网页代码，请先完成生成。');
          setDownloadingIdx(null);
          return;
        }
        const blob = new Blob([activePreview], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = downloadFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } else {
        const { content, mimeType } = await generateExportContent(option.filename, exportData);

        if (mimeType === 'text/html') {
          // HTML 报告（PDF 替代）→ 直接下载为 HTML 文件
          const blob = new Blob([content as string], { type: 'text/html' });
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = downloadFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        } else {
          const blob = content instanceof Blob ? content : new Blob([content as string], { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = downloadFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }
      }

      setDoneSet((prev) => new Set(prev).add(idx));
      setTimeout(() => { setDoneSet((prev) => { const next = new Set(prev); next.delete(idx); return next; }); }, 3000);
    } catch (err) {
      console.error('[Export Error]', err);
      alert(`导出失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setDownloadingIdx(null);
    }
  }, [downloadingIdx, config, exportData]);

  const handleNewProject = useCallback(() => {
    resetTask();
  }, [resetTask]);

  const handleRerun = useCallback(() => {
    resetTask();
    setTimeout(() => {
      if (taskUrl) startTask(taskUrl, goal ?? undefined);
    }, 300);
  }, [resetTask, startTask, taskUrl, goal]);

  return (
    <div className="space-y-6">
      {/* Success banner */}
      <div className="text-center py-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          className="w-20 h-20 rounded-full bg-[#34C759]/15 border-2 border-[#34C759]/30 flex items-center justify-center mx-auto mb-4 shadow-[0_0_60px_rgba(52,199,89,0.15)]"
        >
          <Check className="w-10 h-10 text-[#34C759]" />
        </motion.div>
        <h3 className="text-2xl font-semibold text-[#1d1d1f] mb-1">{config.successTitle}</h3>
        <p className="text-sm text-black/40">{config.successSubtitle}</p>
        {goal && GOAL_META[goal] && (
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-black/[0.04] border border-black/[0.08]">
            <GoalIcon goal={goal} size="w-3 h-3" />
            <span className="text-[11px] text-black/50 font-medium">{GOAL_META[goal].label}</span>
          </div>
        )}
      </div>

      {/* Goal summary card */}
      <div className="rounded-xl border border-black/[0.06] bg-white/75 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          {goal && GOAL_META[goal] ? (
            <>
              <GoalIcon goal={goal} size="w-4 h-4" />
              <span className="text-sm font-medium text-black/60">{config.summaryLabel}</span>
            </>
          ) : (
            <>
              <Package className="w-4 h-4 text-black/40" />
              <span className="text-sm font-medium text-black/60">{config.summaryLabel}</span>
            </>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {config.stats.map((stat, i) => {
            const realValue = i === 0 ? realStats.files : i === 1 ? realStats.components : realStats.lines;
            return (
            <div key={stat.label} className="flex items-center gap-2">
              <stat.icon className="w-3.5 h-3.5 text-black/30" />
              <div>
                <div className="text-[10px] text-black/30">{stat.label}</div>
                <div className="text-[13px] text-black/70 font-medium">{realValue}</div>
              </div>
            </div>
          );
          })}
        </div>
      </div>

      {/* Live Preview Panel — rendered clone of the target website */}
      {activePreview && (
        <div className="rounded-xl border border-black/[0.06] bg-white/75 backdrop-blur-xl overflow-hidden">
          {/* Preview header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.06] bg-black/[0.02]">
            <div className="flex items-center gap-2.5">
              <Eye className="w-3.5 h-3.5 text-[#0071E3]" />
              <span className="text-xs font-medium text-black/60">复刻预览</span>
              {hiFiPreview ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] font-medium">高保真</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759] font-medium">快速预览</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* High-fidelity preview toggle */}
              {!hiFiPreview && (
                <button onClick={handleHiFiPreview} disabled={hiFiLoading}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[#0071E3] bg-[#0071E3]/[0.06] hover:bg-[#0071E3]/[0.12] transition-colors disabled:opacity-50"
                  title="使用服务端编译获取完整 React 交互的高保真预览">
                  {hiFiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {hiFiLoading ? '编译中...' : '高保真预览'}
                </button>
              )}
              {hiFiPreview && (
                <button onClick={() => setHiFiPreview(null)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-black/40 bg-black/[0.04] hover:bg-black/[0.08] transition-colors"
                  title="切换回快速预览">
                  <Zap className="w-3 h-3" />
                  快速预览
                </button>
              )}
              <div className="w-px h-4 bg-black/[0.08] mx-1" />
              <button onClick={() => setDeviceView('desktop')}
                className={cn('p-1.5 rounded-md transition-colors', deviceView === 'desktop' ? 'text-black/80 bg-black/[0.08]' : 'text-black/30 hover:text-black/50')} title="桌面端">
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setDeviceView('tablet')}
                className={cn('p-1.5 rounded-md transition-colors', deviceView === 'tablet' ? 'text-black/80 bg-black/[0.08]' : 'text-black/30 hover:text-black/50')} title="平板端">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
              </button>
              <button onClick={() => setDeviceView('mobile')}
                className={cn('p-1.5 rounded-md transition-colors', deviceView === 'mobile' ? 'text-black/80 bg-black/[0.08]' : 'text-black/30 hover:text-black/50')} title="移动端">
                <Smartphone className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-4 bg-black/[0.08] mx-1" />
              <button onClick={() => {
                const blob = new Blob([activePreview], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 60000);
              }}
                className="p-1.5 rounded-md text-black/30 hover:text-black/50 transition-colors" title="在新标签页中打开">
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Preview iframe — sandbox with scripts for React interactivity */}
          <div className="flex items-stretch justify-center p-4 bg-[#f5f5f7]/50" style={{ minHeight: 420 }}>
            <div className={cn(
              'relative w-full h-full rounded-xl overflow-hidden border border-black/[0.08] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all duration-300',
              deviceView === 'mobile' ? 'max-w-[375px]' : deviceView === 'tablet' ? 'max-w-[768px]' : 'max-w-full'
            )}>
              <iframe
                srcDoc={activePreview}
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-full border-0"
                style={{ minHeight: 380 }}
                title="复刻网页预览"
              />
            </div>
          </div>
        </div>
      )}

      {/* Export options */}
      <div>
        <h3 className="text-sm font-medium text-black/50 mb-3">导出选项</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {config.exports.map((option, idx) => {
            const isDownloading = downloadingIdx === idx;
            const isDone = doneSet.has(idx);
            return (
              <button
                key={option.title}
                onClick={() => handleExport(idx)}
                disabled={downloadingIdx !== null}
                className={cn(
                  "rounded-xl border bg-white/75 backdrop-blur-xl p-4 text-left transition-all duration-200 group",
                  isDone ? "border-[#34C759]/30 bg-[#34C759]/[0.03]" : "border-black/[0.06] hover:border-black/[0.12] hover:bg-black/[0.02]",
                  downloadingIdx !== null && !isDownloading && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', option.bgColor, 'border border-black/[0.06]')}>
                    <option.icon className={cn('w-4.5 h-4.5', option.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-medium text-black/80 truncate">{option.title}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/[0.08] text-black/40 font-mono border border-black/[0.06]">{option.format}</span>
                    </div>
                    <p className="text-[10px] text-black/35 leading-relaxed line-clamp-2">{option.description}</p>
                  </div>
                  <div className="shrink-0 mt-1">
                    {isDownloading ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#0071E3] animate-spin" />
                    ) : isDone ? (
                      <Check className="w-3.5 h-3.5 text-[#34C759]" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-black/20 group-hover:text-black/50 transition-colors" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Workflow complete — next actions */}
      <div className="border-t border-black/[0.06] pt-6">
        <div className="text-center mb-4">
          <p className="text-xs text-black/30">所有任务已完成</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleNewProject}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0071E3] text-white text-sm font-medium hover:bg-[#0077ED] transition-colors shadow-[0_2px_12px_rgba(0,113,227,0.15)]"
          >
            <Home className="w-4 h-4" />
            开始新项目
          </button>
          <button
            onClick={handleRerun}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-black/[0.12] text-black/70 text-sm font-medium hover:bg-black/[0.04] transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            重新运行当前站点
          </button>
        </div>
      </div>
    </div>
  );
}
