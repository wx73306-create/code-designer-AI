// =============================================================================
// AI Process Steps — data-driven configuration for the demo animation
// Phase 1: mock data; Phase 3: replace with real Agent API stream
// =============================================================================

export interface AIProcessStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  duration: number; // ms — how long this step stays "running" before auto-advancing
  /** Optional code lines shown during the "code generation" step */
  codeLines?: string[];
  /** Optional scan labels shown during the "visual analysis" step */
  scanLabels?: string[];
}

export const AI_PROCESS_STEPS: AIProcessStep[] = [
  {
    id: 'capture',
    title: '正在访问网站',
    description: 'Browser Agent 正在读取网页结构与资源',
    icon: '🌐',
    duration: 3000,
  },
  {
    id: 'vision',
    title: '视觉识别完成',
    description: 'Vision Agent 提取布局、图片和视觉关系',
    icon: '👁',
    duration: 4000,
    scanLabels: ['Hero Section', 'Navigation Bar', 'Product Grid', 'CTA Button', 'Footer'],
  },
  {
    id: 'design',
    title: '分析设计语言',
    description: 'AI 正在理解品牌风格和设计系统',
    icon: '🎨',
    duration: 4000,
  },
  {
    id: 'tokens',
    title: '生成 Design System',
    description: '创建颜色、字体、间距、组件规范',
    icon: '✨',
    duration: 4500,
  },
  {
    id: 'code',
    title: '创建 React 组件',
    description: 'Code Agent 生成前端工程代码',
    icon: '⚡',
    duration: 5500,
    codeLines: [
      "import React from 'react'",
      "import { motion } from 'framer-motion'",
      '',
      'export default function Hero() {',
      '  return (',
      '    <motion.section',
      '      initial={{ opacity: 0 }}',
      '      animate={{ opacity: 1 }}',
      '      className="min-h-screen"',
      '    >',
      '      <h1>让 AI 重新设计</h1>',
      '      <p>任何网站</p>',
      '    </motion.section>',
      '  )',
      '}',
    ],
  },
  {
    id: 'complete',
    title: '项目就绪',
    description: '已生成完整可运行项目，可预览和导出',
    icon: '✓',
    duration: 2500,
  },
];

/** Total duration for one full cycle */
export const TOTAL_CYCLE_MS = AI_PROCESS_STEPS.reduce((sum, s) => sum + s.duration, 0);
