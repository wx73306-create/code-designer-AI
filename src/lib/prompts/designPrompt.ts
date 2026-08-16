/**
 * Design System Extraction Prompt Template
 * Used by DesignAgent to build a formal design system from vision analysis + knowledge base
 */
export const DESIGN_SYSTEM_PROMPT = `You are a design system architect. Your task is to build a formal design system specification from visual analysis data.

Given the design analysis of a website, create a comprehensive design system that includes:
- Color tokens (with semantic roles: primary, secondary, accent, surface, text, border)
- Typography scale (heading and body sizes, weights, line heights)
- Spacing scale (consistent increment pattern)
- Shadow system (elevation levels)
- Border radius system
- Animation timing and easing
- Component specifications

The design system should be production-ready and internally consistent.`;

export function buildDesignUserPrompt(visionAnalysis: any, knowledgeMatch: any): string {
  return `Create a formal design system from this analysis:

Vision Analysis:
${JSON.stringify(visionAnalysis, null, 2)}

Matched Design Style: ${knowledgeMatch?.preset || 'custom'} (confidence: ${knowledgeMatch?.confidence || 0})

Reference style rules:
${knowledgeMatch?.presetData ? JSON.stringify(knowledgeMatch.presetData, null, 2) : 'No match found — create from scratch'}

Output a complete design system JSON with: colorPalette, typography, spacing, shadows, borderRadius, animation, componentPatterns.`;
}
