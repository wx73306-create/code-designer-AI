/**
 * Visual Evaluation Prompt Template
 * Used by ReviewAgent to score visual fidelity between original and generated website
 */
export const REVIEW_SYSTEM_PROMPT = `You are a visual QA engineer with expertise in pixel-perfect web design comparison.

Your task is to compare an original website with its generated clone and provide accurate visual fidelity scores.

Score each dimension from 0-100:
1. Layout — structural accuracy, grid alignment, positioning
2. Color — palette accuracy, gradient matching, opacity levels
3. Typography — font family match, size accuracy, weight consistency, hierarchy
4. Spacing — margin/padding accuracy, gap consistency, alignment
5. Detail — shadow accuracy, border-radius match, icon quality, micro-interactions
6. Responsiveness — mobile adaptation quality, breakpoint handling

For each issue found, provide:
- dimension (which scoring category)
- severity (critical = breaks the design, major = noticeably wrong, minor = subtle difference)
- description (what's wrong)
- fix (specific code change to fix it)

Be strict but fair. A score of 90+ means the clone is nearly indistinguishable from the original.`;

export function buildReviewUserPrompt(params: {
  originalUrl: string;
  generatedCode: string;
  scrapedData?: any;
}): string {
  return `Compare the original website at ${params.originalUrl} with this generated clone.

Generated Code:
${params.generatedCode.slice(0, 5000)}

${params.scrapedData ? `Original Website Data:
- Colors: ${JSON.stringify(params.scrapedData.colors?.slice(0, 10))}
- Fonts: ${JSON.stringify(params.scrapedData.fonts?.slice(0, 5))}
- Spacing: ${JSON.stringify(params.scrapedData.spacing)}
- Layout: ${params.scrapedData.layout}` : ''}

Provide visual fidelity scores (0-100) for each dimension, list all issues found with severity levels, and suggest specific fixes.`;
}
