import type { DesignMode, ModeConfig, GenerationConfig, ImprovementReport } from '@/types/design-mode';

export const DESIGN_MODES: ModeConfig[] = [
  {
    id: 'pixel-copy',
    title: 'Pixel Copy',
    subtitle: '精准复刻',
    similarity: 95,
    description: '最大程度还原原网页的视觉结构、色彩和交互，适合学习研究和项目迁移。',
    target: ['学习研究', '竞品分析', '项目迁移'],
    optimization: ['保持原始布局', '保持色彩系统', '保持组件结构', '保持交互动效'],
    icon: '🎯',
    gradient: 'from-[#1d1d1f] to-[#424245]',
    accentColor: '#1d1d1f',
  },
  {
    id: 'design-evolution',
    title: 'Design Evolution',
    subtitle: '设计进化',
    similarity: 80,
    description: '保留品牌 DNA，AI 自动优化排版、字体、动效和用户体验，提升设计品质。',
    target: ['商业项目', '产品升级', '品牌重设计'],
    optimization: ['优化排版层次', '优化字体选择', '优化动效体验', '优化交互细节', '提升可访问性'],
    icon: '✨',
    gradient: 'from-[#0071E3] to-[#5856D6]',
    accentColor: '#0071E3',
  },
];

export function getModeConfig(mode: DesignMode): ModeConfig {
  return DESIGN_MODES.find(m => m.id === mode) || DESIGN_MODES[0];
}

export function getGenerationConfig(mode: DesignMode): GenerationConfig {
  if (mode === 'pixel-copy') {
    return {
      mode: 'pixel-copy',
      rules: {
        layout_preserve: 0.95,
        color_preserve: 0.95,
        innovation_level: 0.05,
        animation: true,
        ux_optimize: false,
        typography_optimize: false,
      },
    };
  }
  return {
    mode: 'design-evolution',
    rules: {
      layout_preserve: 0.8,
      color_preserve: 0.85,
      innovation_level: 0.2,
      animation: true,
      ux_optimize: true,
      typography_optimize: true,
    },
  };
}

// Mock improvement report for demo
export const MOCK_IMPROVEMENT_REPORT: ImprovementReport = {
  summary: 'AI 在保留 Apple 品牌基因的基础上，优化了排版层次和交互体验，整体设计品质提升 16 分。',
  beforeScore: 78,
  afterScore: 94,
  improvements: [
    {
      dimension: 'Typography',
      before: 'Roboto, 14px base',
      after: 'Inter, 16px base, improved hierarchy',
      reason: '提升阅读性和视觉层次',
    },
    {
      dimension: 'Layout',
      before: 'Dense card grid, 16px gap',
      after: 'Bento grid, 24px gap, more whitespace',
      reason: '营造更高级的视觉感受',
    },
    {
      dimension: 'Animation',
      before: 'Basic fade-in',
      after: 'Scroll-driven reveal with spring easing',
      reason: '增强滚动叙事的沉浸感',
    },
    {
      dimension: 'Color',
      before: 'Flat blue #0071E3',
      after: 'Gradient blue-to-purple, improved contrast',
      reason: '增加视觉深度和品牌辨识度',
    },
    {
      dimension: 'Interaction',
      before: 'Standard hover states',
      after: 'Micro-interactions with haptic feedback patterns',
      reason: '提升用户参与感和操作反馈',
    },
  ],
};
