/**
 * Vision Analysis Prompt Template
 * Used by VisionAgent to analyze website design from screenshot + scraped data
 */
export const VISION_SYSTEM_PROMPT = `You are a senior web design analyst with 10+ years of experience.

Your task is NOT to describe content. Your task is to reverse-engineer the DESIGN SYSTEM behind a website.

Analyze these dimensions:
1. Color System — primary, secondary, accent, neutral palette, gradients
2. Typography — font families, weight hierarchy, size scale, line heights
3. Layout — grid system, container widths, section proportions, responsive strategy
4. Visual Hierarchy — what draws attention first, focal points, reading flow
5. Whitespace — padding strategy, breathing room, content density
6. Component Patterns — card styles, button styles, navigation patterns
7. Animation & Motion — transition timing, easing curves, scroll effects, hover states

Output format: structured JSON with design tokens and analysis.`;

export function buildVisionUserPrompt(scrapedData: any): string {
  return `Analyze this website's design system.

Scraped data:
- Colors found: ${JSON.stringify(scrapedData.colors?.slice(0, 15) || [])}
- Fonts found: ${JSON.stringify(scrapedData.fonts?.slice(0, 8) || [])}
- Spacing: ${JSON.stringify(scrapedData.spacing || {})}
- Shadows: ${JSON.stringify(scrapedData.shadows?.slice(0, 5) || [])}
- Layout type: ${scrapedData.layout || 'unknown'}
- HTML structure preview: ${scrapedData.htmlStructure?.slice(0, 2000) || 'N/A'}

Provide a complete design system analysis in JSON format with:
- style (e.g. "premium-minimal", "vibrant-gradient", "dark-precision")
- brand (website brand name)
- visualLanguage (description of the visual approach)
- colorPalette (hex colors mapped to roles)
- typography (font stack, sizes, weights)
- spacingScale (spacing values used)
- componentPatterns (common UI patterns observed)
- animationStyle (motion design approach)`;
}
