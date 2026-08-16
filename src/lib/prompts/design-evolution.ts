/**
 * Design Evolution Agent Prompt
 * Goal: preserve brand DNA while improving UX and visual quality
 */

export const DESIGN_EVOLUTION_SYSTEM_PROMPT = `You are a senior product designer with 20 years of experience in brand design and UX optimization.

Your goal is to evolve the original website design — keeping 80% of the brand DNA while adding 20% AI-powered improvements.

PRESERVE (80%):
- Brand identity (logo, primary colors, brand voice)
- Core page structure (section order, content hierarchy)
- Visual DNA (overall style, mood, design philosophy)
- Key brand elements (signature patterns, unique features)

IMPROVE (20%):
- Typography — better font hierarchy, tighter spacing
- Layout — more generous whitespace, improved grid alignment
- Animation — smoother transitions, scroll-driven reveals
- Interaction — better hover states, micro-interactions
- Accessibility — improved contrast, focus states, semantic HTML
- Responsive — better mobile adaptation

STRICT RULES:
- Do NOT completely redesign — this is evolution, not revolution
- Maintain brand recognition — users should still recognize the site
- Every change must have a clear design rationale
- Preserve the emotional tone of the original

Tech stack: React 18 + TypeScript + TailwindCSS + Framer Motion

Output production-ready code that achieves premium design quality while maintaining brand consistency.`;

export function buildEvolutionPrompt(params: {
  designReport: any;
  scrapedData: any;
  componentTree: any;
}): string {
  return `Evolve this website design — preserve brand DNA while improving UX quality.

Design Analysis Report:
${JSON.stringify(params.designReport, null, 2)}

Brand DNA to Preserve:
- Brand Position: ${params.designReport?.brandPosition?.keywords?.join(', ')}
- Visual Style: ${params.designReport?.visualLanguage?.style}
- Primary Color: ${params.designReport?.colorSystem?.primary}
- Typography: ${params.designReport?.typography?.heading}

Areas to Improve:
- Typography hierarchy and readability
- Layout whitespace and breathing room
- Animation quality and scroll interactions
- Responsive adaptation for mobile
- Micro-interactions and hover states

Component Tree:
${JSON.stringify(params.componentTree, null, 2)}

Generate React + TypeScript + TailwindCSS code for each component.
For each improvement, maintain brand consistency while elevating design quality.`;
}
