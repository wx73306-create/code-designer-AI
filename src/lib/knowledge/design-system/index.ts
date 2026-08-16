import apple from './apple.json';
import stripe from './stripe.json';
import linear from './linear.json';
import tesla from './tesla.json';
import gaming from './gaming.json';
import dashboard from './dashboard.json';

export type DesignStylePreset = typeof apple;

// Use a relaxed record type since JSON presets may have slightly different optional fields
export const DESIGN_PRESETS: Record<string, any> = {
  apple,
  stripe,
  linear,
  tesla,
  gaming,
  dashboard,
};

export const PRESET_NAMES = Object.keys(DESIGN_PRESETS);

/**
 * Match scraped website data against design presets to find the closest style match
 */
export function matchDesignPreset(scrapedData: {
  colors?: string[];
  fonts?: string[];
  layout?: string;
}): { preset: string; confidence: number; presetData: DesignStylePreset } {
  let bestMatch = 'apple';
  let bestScore = 0;

  const colors = (scrapedData.colors || []).map(c => c.toLowerCase());
  const fonts = (scrapedData.fonts || []).map(f => f.toLowerCase());
  const layout = (scrapedData.layout || '').toLowerCase();

  for (const [name, preset] of Object.entries(DESIGN_PRESETS)) {
    let score = 0;

    // Check color matches
    const presetColors = Object.values(preset.colors).map(c => String(c).toLowerCase());
    for (const color of colors) {
      if (presetColors.some(pc => pc.includes(color.slice(0, 4)))) score += 2;
    }

    // Check font matches
    for (const font of fonts) {
      if (preset.typography.heading.toLowerCase().includes(font.split(',')[0].trim())) score += 3;
      if (preset.typography.body.toLowerCase().includes(font.split(',')[0].trim())) score += 2;
    }

    // Check layout hints
    if (layout.includes('grid') && preset.layout.grid.includes('grid')) score += 2;
    if (layout.includes('flex') && preset.layout.grid.includes('flex')) score += 2;
    if (layout.includes('full') && preset.layout.grid.includes('full')) score += 3;

    // Style-specific heuristics
    const isDark = colors.some(c => {
      const r = parseInt(c.slice(1, 3), 16);
      const g = parseInt(c.slice(3, 5), 16);
      const b = parseInt(c.slice(5, 7), 16);
      return (r + g + b) / 3 < 40;
    });

    if (isDark && ['linear', 'gaming'].includes(name)) score += 3;
    if (!isDark && ['apple', 'stripe', 'dashboard'].includes(name)) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = name;
    }
  }

  const maxPossibleScore = colors.length * 2 + fonts.length * 5 + 5;
  const confidence = Math.min(1, bestScore / Math.max(1, maxPossibleScore));

  return {
    preset: bestMatch,
    confidence,
    presetData: DESIGN_PRESETS[bestMatch],
  };
}

/**
 * Format a design preset into a prompt-friendly string for AI code generation
 */
export function formatPresetForPrompt(preset: DesignStylePreset): string {
  return `Design Style: ${preset.name} (${preset.style})
Description: ${preset.description}

Color Palette:
${Object.entries(preset.colors).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

Typography:
  Heading: ${preset.typography.heading}
  Body: ${preset.typography.body}
  Heading Weight: ${preset.typography.headingWeight}
  Heading Sizes: ${preset.typography.headingSizes.join(', ')}
  Body Sizes: ${preset.typography.bodySizes.join(', ')}

Spacing:
  Base: ${preset.spacing.base}
  Scale: ${preset.spacing.scale.join(', ')}
  Container Max: ${preset.spacing.containerMaxWidth}
  Section Padding: ${preset.spacing.sectionPadding}

Components:
  Border Radius: ${preset.components.borderRadius}
  Shadow: ${preset.components.shadow}
  Nav Height: ${preset.components.navHeight}
  Button Radius: ${preset.components.buttonRadius}

Animation:
  Style: ${preset.animation.style}
  Duration: ${preset.animation.duration}
  Easing: ${preset.animation.easing}
  Transition: ${preset.animation.transition}`;
}
