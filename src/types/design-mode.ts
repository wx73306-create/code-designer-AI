// =============================================================================
// Design Mode — Pixel Copy vs Design Evolution
// =============================================================================

export type DesignMode = 'pixel-copy' | 'design-evolution';

export interface ModeConfig {
  id: DesignMode;
  title: string;
  subtitle: string;
  similarity: number;
  description: string;
  target: string[];
  optimization: string[];
  icon: string;
  gradient: string;
  accentColor: string;
}

export interface GenerationConfig {
  mode: DesignMode;
  rules: {
    layout_preserve: number;
    color_preserve: number;
    innovation_level: number;
    animation: boolean;
    ux_optimize: boolean;
    typography_optimize: boolean;
  };
}

export interface ImprovementItem {
  dimension: string;
  before: string;
  after: string;
  reason: string;
}

export interface ImprovementReport {
  summary: string;
  improvements: ImprovementItem[];
  beforeScore: number;
  afterScore: number;
}
