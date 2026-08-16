/**
 * Web Design Knowledge Base — Design System Generator
 * 根据 Style Matcher 匹配结果，生成 GeneratedDesignSystem（设计系统），
 * 包含 tokens + rules，供 Code Agent 读取并遵守。
 */

import type { GeneratedDesignSystem, StyleMatch } from '@/types/agent';
import { getProfileById } from './style-profiles';

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateDesignSystem(match: StyleMatch): GeneratedDesignSystem | null {
  const profile = getProfileById(match.matchedStyleId);
  if (!profile) return null;

  return {
    style: profile.name,
    philosophy: profile.philosophy,
    tokens: {
      spacing: profile.tokens.spacing,
      radius: profile.tokens.radius,
      shadow: profile.tokens.shadow,
      colors: {
        background: profile.color.background,
        text: profile.color.text,
        accent: profile.color.accent,
      },
      typography: {
        font: profile.typography.font,
        titleSize: mapTitleSize(profile.typography.titleSize),
        weight: profile.typography.weight,
        lineHeight: profile.typography.lineHeight,
      },
    },
    rules: profile.rules,
    avoid: profile.avoid,
    components: {
      preferred: profile.components.preferred,
      avoid: profile.components.avoid,
    },
  };
}

// ---------------------------------------------------------------------------
// Prompt Formatting — 注入 Code/Critic/Planning Agent 提示词
// ---------------------------------------------------------------------------

export function formatStyleContext(match: StyleMatch, system: GeneratedDesignSystem): string {
  const lines: string[] = [];

  lines.push('## 匹配设计体系 (Matched Design System)');
  lines.push('');
  lines.push(`风格: ${system.style} (置信度: ${match.confidence}%)`);
  lines.push(`设计理念: ${system.philosophy.join(', ')}`);
  lines.push('');

  lines.push('### Design Tokens');
  lines.push(`- 间距: small=${system.tokens.spacing.small}px, medium=${system.tokens.spacing.medium}px, large=${system.tokens.spacing.large}px`);
  lines.push(`- 圆角: ${system.tokens.radius}px`);
  lines.push(`- 阴影: ${system.tokens.shadow}`);
  lines.push(`- 背景色: ${system.tokens.colors.background.join(', ')}`);
  lines.push(`- 文字色: ${system.tokens.colors.text}`);
  lines.push(`- 强调色: ${system.tokens.colors.accent}`);
  lines.push(`- 字体: ${system.tokens.typography.font} (${system.tokens.typography.weight}, ${system.tokens.typography.lineHeight})`);
  lines.push(`- 标题大小: ${system.tokens.typography.titleSize}`);
  lines.push('');

  lines.push('### 设计规则 (MUST follow)');
  system.rules.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  lines.push('');

  lines.push('### 禁止事项 (MUST NOT)');
  system.avoid.forEach((a) => lines.push(`- ${a}`));
  lines.push('');

  lines.push('### 组件指引');
  lines.push(`推荐: ${system.components.preferred.join(', ')}`);
  lines.push(`避免: ${system.components.avoid.join(', ')}`);
  lines.push('');

  if (match.secondaryStyle) {
    lines.push(`次要参考风格: ${match.secondaryStyle}`);
  }

  return lines.join('\n');
}

/** Format a compact version for Critic/Planning (shorter context window) */
export function formatStyleContextCompact(match: StyleMatch, system: GeneratedDesignSystem): string {
  const lines: string[] = [];
  lines.push(`[设计体系] ${system.style} (${match.confidence}%) — ${system.philosophy.slice(0, 3).join('/')}`);
  lines.push(`Tokens: spacing ${system.tokens.spacing.small}/${system.tokens.spacing.medium}/${system.tokens.spacing.large}px, radius ${system.tokens.radius}px, shadow ${system.tokens.shadow}`);
  lines.push(`Colors: bg ${system.tokens.colors.background[0]}, text ${system.tokens.colors.text}, accent ${system.tokens.colors.accent}`);
  lines.push(`Rules: ${system.rules.slice(0, 4).join('; ')}`);
  lines.push(`Avoid: ${system.avoid.slice(0, 3).join('; ')}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapTitleSize(size: string): string {
  const map: Record<string, string> = {
    'small': '24px',
    'medium': '36px',
    'large': '48px',
    'very-large': '64px',
    'extreme': '80px',
  };
  return map[size] || '48px';
}
