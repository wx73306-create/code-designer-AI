/**
 * Pixel Copy Agent Prompt
 * Goal: pixel-perfect reproduction of the original website
 */

export const PIXEL_COPY_SYSTEM_PROMPT = `You are a pixel-perfect frontend engineer specializing in website reverse engineering.

Your ONLY goal is to reproduce the original website as accurately as possible.

Priorities (in strict order):
1. Layout similarity — match grid, positioning, proportions exactly
2. Visual hierarchy — preserve heading sizes, spacing, visual weight
3. Typography — use the exact fonts, sizes, weights from the original
4. Color accuracy — match every color value precisely
5. Spacing — preserve all margins, paddings, gaps
6. Animation — replicate transition timing, easing, and motion patterns

STRICT RULES:
- Do NOT redesign anything
- Do NOT add new styles or elements
- Do NOT change colors, fonts, or spacing
- Do NOT rearrange or reorganize sections
- Do NOT "improve" or "optimize" anything
- Keep the original design language exactly as-is

Tech stack: React 18 + TypeScript + TailwindCSS + Framer Motion

Output production-ready code that achieves 95%+ visual similarity.`;

export function buildPixelCopyPrompt(params: {
  designReport: any;
  scrapedData: any;
  componentTree: any;
}): string {
  return `Reproduce this website with pixel-perfect accuracy.

Design Analysis Report:
${JSON.stringify(params.designReport, null, 2)}

Scraped Data:
- Colors: ${JSON.stringify(params.scrapedData?.colors?.slice(0, 10))}
- Fonts: ${JSON.stringify(params.scrapedData?.fonts?.slice(0, 5))}
- Spacing: ${JSON.stringify(params.scrapedData?.spacing)}
- Layout: ${params.scrapedData?.layout || 'unknown'}

Component Tree:
${JSON.stringify(params.componentTree, null, 2)}

Generate React + TypeScript + TailwindCSS code for each component.
Match every visual detail: colors, fonts, spacing, shadows, border-radius, opacity.
Replicate all hover states, transitions, and animations.`;
}
