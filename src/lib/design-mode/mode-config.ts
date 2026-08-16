/**
 * Design Mode System — 模式配置与增强规则库
 * 网页生成模式系统（开发规范 V1.0）。
 *
 * Mode 1 精准复刻（Clone）：95% 一致，最大程度还原。
 * Mode 2 设计升级（Enhancement）⭐：保留 80% 设计 DNA + AI 优化 20%。
 */

import type { ModeType } from '@/types/agent';

// ---------------------------------------------------------------------------
// Generation Mode 配置（generation-mode.json 的 TypeScript 形态）
// ---------------------------------------------------------------------------

export interface GenerationModeConfig {
  mode: ModeType;
  label: string;
  cloneRatio: number;        // 保留原设计比例
  optimizationRatio: number; // 优化比例
  allowDesignChange: boolean;
  targetSimilarity: number;  // 目标相似度
  description: string;
}

export const GENERATION_MODES: Record<ModeType, GenerationModeConfig> = {
  clone: {
    mode: 'clone',
    label: '精准复刻',
    cloneRatio: 95,
    optimizationRatio: 5,
    allowDesignChange: false,
    targetSimilarity: 95,
    description: '保持 95% 一致，最大程度还原原网站。适合学习、研究竞品、网站迁移。',
  },
  enhancement: {
    mode: 'enhancement',
    label: '设计升级',
    cloneRatio: 80,
    optimizationRatio: 20,
    allowDesignChange: true,
    targetSimilarity: 80,
    description: '保留 80% 设计 DNA，AI 优化 20%。适合商业发布、产品官网、品牌升级。',
  },
};

/** 默认模式：设计升级（产品差异化） */
export const DEFAULT_MODE: ModeType = 'enhancement';

// ---------------------------------------------------------------------------
// 设计升级规则库（enhancement-rules.json）
// ---------------------------------------------------------------------------

export interface EnhancementRule {
  id: string;
  category: 'layout' | 'typography' | 'image' | 'animation' | 'component';
  name: string;
  detect: string;     // 发现的问题
  optimize: string;   // 优化方向
}

export const ENHANCEMENT_RULES: EnhancementRule[] = [
  {
    id: 'ENH-001',
    category: 'layout',
    name: '布局优化',
    detect: '内容过密、Section 拥挤',
    optimize: '增加 Section 间距与视觉呼吸，内容最大宽度 1200px',
  },
  {
    id: 'ENH-002',
    category: 'typography',
    name: '字体升级',
    detect: '标题过小、字阶平淡',
    optimize: 'Hero 标题放大到 64-96px，建立强烈视觉层级',
  },
  {
    id: 'ENH-003',
    category: 'image',
    name: '图片增强',
    detect: '普通图片、缺乏视觉焦点',
    optimize: '大图展示、产品聚焦、沉浸式视觉',
  },
  {
    id: 'ENH-004',
    category: 'animation',
    name: '动画增强',
    detect: '静态、缺乏动效',
    optimize: '增加 Fade In / Scroll Reveal / Parallax / Hover；禁止复杂粒子与过度动画',
  },
  {
    id: 'ENH-005',
    category: 'component',
    name: '组件优化',
    detect: '大量 Card 堆叠',
    optimize: '删除约 40% 卡片，转换为 Story Section / Image-Text Layout',
  },
];
