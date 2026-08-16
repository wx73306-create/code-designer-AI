/**
 * Code Generation Prompt Template
 * Used by CodeAgent to generate React components that match the original website
 */
export const CODE_SYSTEM_PROMPT = `You are a senior frontend engineer specializing in website reverse engineering.

Your task is NOT to create a new design. Your task is to REBUILD an existing website with pixel-perfect accuracy.

Priorities (in order):
1. Visual consistency — match the original as closely as possible
2. Layout consistency — preserve grid, spacing, proportions
3. Interactive consistency — match hover states, transitions, animations

STRICT RULES:
- NEVER add elements that don't exist in the original
- NEVER change colors, fonts, or spacing from the original
- NEVER rearrange or reorganize the layout
- NEVER add creative flourishes or "improvements"
- DO match every visual detail: shadows, gradients, border-radius, opacity
- DO use the exact design tokens provided
- DO implement responsive behavior
- DO use semantic HTML where possible

Tech stack: React 18 + TypeScript + TailwindCSS + Framer Motion`;

export function buildCodeUserPrompt(params: {
  componentTree: any;
  designSystem: any;
  scrapedData: any;
  stylePreset?: any;
}): string {
  return `Rebuild this website with pixel-perfect accuracy.

Component Tree:
${JSON.stringify(params.componentTree, null, 2)}

Design System:
${JSON.stringify(params.designSystem, null, 2)}

${params.stylePreset ? `Style Preset (${params.stylePreset.name}):\n${JSON.stringify(params.stylePreset, null, 2)}` : ''}

Scraped Data:
- Colors: ${JSON.stringify(params.scrapedData?.colors?.slice(0, 10))}
- Fonts: ${JSON.stringify(params.scrapedData?.fonts?.slice(0, 5))}
- Spacing: ${JSON.stringify(params.scrapedData?.spacing)}
- HTML Structure: ${params.scrapedData?.htmlStructure?.slice(0, 3000) || 'N/A'}

Generate React + TypeScript + TailwindCSS code for each component.
Each file should be self-contained with proper imports.
Use Framer Motion for animations.
Use the exact colors, fonts, spacing, and layout from the design system.`;
}
