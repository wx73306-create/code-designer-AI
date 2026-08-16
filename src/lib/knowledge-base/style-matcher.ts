/**
 * Web Design Knowledge Base — Style Matcher
 * 确定性评分算法（无 LLM 调用），根据 Vision Agent 的设计分析报告
 * 匹配最佳设计体系。
 *
 * 评分权重（满分 100）：
 *   layout:     +30
 *   color:      +25
 *   components: +25
 *   typography: +20
 */

import type { StyleMatch, StyleScoreBreakdown } from '@/types/agent';
import { STYLE_PROFILES, type StyleProfile } from './style-profiles';

// ---------------------------------------------------------------------------
// Input type — normalized from Vision Agent's DesignAnalysis
// ---------------------------------------------------------------------------

export interface StyleMatcherInput {
  colors?: Array<{ hex: string; name?: string; usage?: string }>;
  typography?: Array<{ family?: string; size?: string; weight?: string }>;
  layout?: Record<string, unknown>;
  components?: string[];
  raw?: string; // raw vision text for keyword matching
}

// ---------------------------------------------------------------------------
// Scoring Functions
// ---------------------------------------------------------------------------

/** Layout scoring (max 30) */
function scoreLayout(input: StyleMatcherInput, profile: StyleProfile): number {
  let score = 0;
  const raw = (input.raw || '').toLowerCase();
  const layout = input.layout || {};
  const layoutStr = JSON.stringify(layout).toLowerCase();

  // Spacing detection
  const hasLargeWhitespace =
    raw.includes('whitespace') || raw.includes('spacious') || raw.includes('large spacing') ||
    raw.includes('generous') || raw.includes('留白') || raw.includes('大间距') ||
    layoutStr.includes('large') || layoutStr.includes('spacious');
  const hasDenseLayout =
    raw.includes('dense') || raw.includes('compact') || raw.includes('tight') ||
    raw.includes('密集') || layoutStr.includes('dense') || layoutStr.includes('compact');
  const hasFullscreen =
    raw.includes('fullscreen') || raw.includes('full-screen') || raw.includes('100vh') ||
    raw.includes('全屏') || layoutStr.includes('fullscreen');

  if (profile.layout.spacing === 'extreme' && (hasLargeWhitespace || hasFullscreen)) score += 12;
  else if (profile.layout.spacing === 'large' && hasLargeWhitespace) score += 10;
  else if (profile.layout.density === 'high' && hasDenseLayout) score += 12;
  else if (profile.layout.spacing === 'medium' && !hasLargeWhitespace && !hasDenseLayout) score += 6;

  // Alignment
  const isCentered =
    raw.includes('center') || raw.includes('居中') || layoutStr.includes('center');
  const isLeftAligned =
    raw.includes('left align') || raw.includes('左对齐') || layoutStr.includes('left');

  if (profile.layout.alignment === 'center' && isCentered) score += 8;
  else if (profile.layout.alignment === 'left' && isLeftAligned) score += 8;
  else if (profile.layout.alignment === 'mixed') score += 4;

  // Grid type
  const hasComplexGrid =
    raw.includes('grid') || raw.includes('multi-column') || raw.includes('网格') ||
    layoutStr.includes('grid');
  const hasSingleColumn =
    raw.includes('single column') || raw.includes('单栏') || layoutStr.includes('single');

  if (profile.layout.type.includes('complex') && hasComplexGrid) score += 10;
  else if (profile.layout.type.includes('single') && (hasSingleColumn || hasFullscreen)) score += 10;
  else if (profile.layout.type.includes('section') && raw.includes('section')) score += 8;
  else if (profile.layout.type.includes('editorial') && (raw.includes('editorial') || raw.includes('杂志'))) score += 10;
  else if (profile.layout.type.includes('asymmetric') && (raw.includes('asymmetric') || raw.includes('不对称'))) score += 10;
  else if (hasComplexGrid || hasSingleColumn) score += 4;

  return Math.min(score, 30);
}

/** Color scoring (max 25) */
function scoreColor(input: StyleMatcherInput, profile: StyleProfile): number {
  let score = 0;
  const colors = input.colors || [];
  const raw = (input.raw || '').toLowerCase();

  // Dark vs Light detection
  const hexColors = colors.map((c) => c.hex.toLowerCase());
  const hasDarkBg = hexColors.some((h) => {
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return (r + g + b) / 3 < 60;
  });
  const hasLightBg = hexColors.some((h) => {
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return (r + g + b) / 3 > 200;
  });
  const rawMentionsDark = raw.includes('dark') || raw.includes('暗色') || raw.includes('black background');
  const rawMentionsLight = raw.includes('white') || raw.includes('light') || raw.includes('白色') || raw.includes('浅色');

  const isDarkInput = hasDarkBg || rawMentionsDark;
  const isLightInput = hasLightBg || rawMentionsLight;

  if (profile.color.isDark && isDarkInput) score += 10;
  else if (!profile.color.isDark && isLightInput) score += 10;
  else if (profile.color.isDark && !isLightInput) score += 4;
  else if (!profile.color.isDark && !isDarkInput) score += 4;

  // Gradient detection
  const hasGradient = raw.includes('gradient') || raw.includes('渐变');
  if (profile.color.usesGradient && hasGradient) score += 7;
  else if (!profile.color.usesGradient && !hasGradient) score += 5;

  // Accent color matching
  const accentLower = profile.color.accent.toLowerCase();
  const hasMatchingAccent = hexColors.some((h) => colorDistance(h, accentLower) < 80);
  if (hasMatchingAccent) score += 8;

  // Keyword color hints
  if (profile.color.primary) {
    const primaryKw = profile.color.primary.toLowerCase();
    if (raw.includes(primaryKw)) score += 5;
  }

  return Math.min(score, 25);
}

/** Components scoring (max 25) */
function scoreComponents(input: StyleMatcherInput, profile: StyleProfile): number {
  let score = 0;
  const raw = (input.raw || '').toLowerCase();
  const components = (input.components || []).map((c) => c.toLowerCase());
  const allText = [...components, raw].join(' ');

  // Preferred components present
  let preferredHits = 0;
  for (const pref of profile.components.preferred) {
    const prefLower = pref.toLowerCase();
    if (allText.includes(prefLower) || allText.includes(prefLower.replace(/\s+/g, ''))) {
      preferredHits++;
    }
  }
  score += Math.min(preferredHits * 5, 15);

  // Avoid components absent (bonus for not having what should be avoided)
  let avoidHits = 0;
  for (const av of profile.components.avoid) {
    const avLower = av.toLowerCase();
    if (allText.includes(avLower)) {
      avoidHits++;
    }
  }
  if (avoidHits === 0) score += 5;
  else score -= avoidHits * 2;

  // Component count alignment
  const mentionsMany = raw.includes('many') || raw.includes('multiple') || raw.includes('grid of') || raw.includes('大量');
  const mentionsFew = raw.includes('few') || raw.includes('minimal') || raw.includes('single') || raw.includes('少量');

  if (profile.components.count === 'many' && mentionsMany) score += 5;
  else if (profile.components.count === 'few' && mentionsFew) score += 5;
  else if (profile.components.count === 'medium') score += 3;

  return Math.max(0, Math.min(score, 25));
}

/** Typography scoring (max 20) */
function scoreTypography(input: StyleMatcherInput, profile: StyleProfile): number {
  let score = 0;
  const raw = (input.raw || '').toLowerCase();
  const typography = input.typography || [];
  const fontFamilies = typography.map((t) => (t.family || '').toLowerCase());
  const allText = [...fontFamilies, raw].join(' ');

  // Font family matching
  const profileFont = profile.typography.font.toLowerCase();
  const fontParts = profileFont.split(/[\s/]+/);
  const hasFontMatch = fontParts.some((f) => f.length > 2 && allText.includes(f));
  if (hasFontMatch) score += 8;

  // Serif vs Sans-serif
  const isSerifProfile = /serif|didot|playfair|bodoni|georgia/i.test(profile.typography.font);
  const mentionsSerif = raw.includes('serif') || raw.includes('衬线');
  const mentionsSans = raw.includes('sans') || raw.includes('无衬线');
  if (isSerifProfile && mentionsSerif) score += 6;
  else if (!isSerifProfile && (mentionsSans || !mentionsSerif)) score += 4;

  // Title size
  const mentionsLargeText =
    raw.includes('large text') || raw.includes('big headline') || raw.includes('大标题') ||
    raw.includes('huge') || raw.includes('oversized');
  const mentionsSmallText = raw.includes('small text') || raw.includes('compact text') || raw.includes('小字');

  if ((profile.typography.titleSize === 'very-large' || profile.typography.titleSize === 'extreme') && mentionsLargeText) score += 6;
  else if (profile.typography.titleSize === 'small' && mentionsSmallText) score += 6;
  else if (profile.typography.titleSize === 'large' && mentionsLargeText) score += 4;
  else if (profile.typography.titleSize === 'medium') score += 3;

  return Math.min(score, 20);
}

// ---------------------------------------------------------------------------
// Main Matcher
// ---------------------------------------------------------------------------

export function calculateStyleScore(input: StyleMatcherInput, profile: StyleProfile): StyleScoreBreakdown {
  const layout = scoreLayout(input, profile);
  const color = scoreColor(input, profile);
  const components = scoreComponents(input, profile);
  const typography = scoreTypography(input, profile);
  const total = layout + color + components + typography;

  return { layout, color, components, typography, total };
}

export function matchStyle(input: StyleMatcherInput): StyleMatch {
  const results = STYLE_PROFILES.map((profile) => ({
    profile,
    breakdown: calculateStyleScore(input, profile),
  }));

  // Sort by total score descending
  results.sort((a, b) => b.breakdown.total - a.breakdown.total);

  const best = results[0];
  const second = results[1];

  // Build scores map
  const scores: Record<string, number> = {};
  for (const r of results) {
    scores[r.profile.name] = r.breakdown.total;
  }

  // Confidence: best score as percentage, boosted if gap to second is large
  const gap = best.breakdown.total - (second?.breakdown.total || 0);
  const baseConfidence = best.breakdown.total; // already 0-100
  const confidence = Math.min(99, Math.round(baseConfidence + gap * 0.1));

  // Reasoning
  const reasoning = buildReasoning(best.profile, best.breakdown, second?.profile);

  return {
    matchedStyle: best.profile.name,
    matchedStyleId: best.profile.id,
    confidence,
    secondaryStyle: second?.profile.name || '',
    scores,
    breakdown: best.breakdown,
    reasoning,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function colorDistance(hex1: string, hex2: string): number {
  try {
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  } catch {
    return 999;
  }
}

function buildReasoning(
  profile: StyleProfile,
  breakdown: StyleScoreBreakdown,
  secondary?: StyleProfile
): string {
  const parts: string[] = [];

  parts.push(`该网页最符合「${profile.nameZh}」设计体系（置信度基于四维评分）。`);

  const dims: Array<[string, number, number]> = [
    ['布局', breakdown.layout, 30],
    ['色彩', breakdown.color, 25],
    ['组件', breakdown.components, 25],
    ['字体', breakdown.typography, 20],
  ];

  const strongest = dims.reduce((a, b) => (b[1] / b[2] > a[1] / a[2] ? b : a));
  parts.push(`${strongest[0]}维度匹配度最高（${strongest[1]}/${strongest[2]}），`);
  parts.push(`体现了${profile.philosophy.slice(0, 2).join('、')}的设计理念。`);

  if (secondary) {
    parts.push(`次要匹配为「${secondary.nameZh}」，可作为辅助参考。`);
  }

  return parts.join('');
}
