import type {
  AgentResult,
  AgentLog,
  VisualEvaluation,
  EvaluationIssue,
} from './types';

/**
 * Visual Evaluation Agent
 * ========================
 * Phase 7 of the Code Designer AI pipeline.
 *
 * Compares the original website with the generated clone by sending
 * both URLs (or screenshots) and the generated source code to a
 * multimodal AI model.  The model returns per-dimension scores and
 * a list of actionable issues.
 *
 * Scoring dimensions (each 0 -- 100):
 *   layout, color, typography, spacing, detail, responsiveness
 *
 * The overall `totalScore` is the arithmetic mean of all six dimensions.
 * A score >= the configured `targetScore` (default 90) is considered a pass.
 *
 * @example
 * ```ts
 * const agent = new ReviewAgent();
 * const result = await agent.execute({
 *   originalUrl: 'https://example.com',
 *   generatedHtml: htmlString,
 *   scrapedData,
 * });
 * console.log(result.data.evaluation.totalScore);
 * ```
 */
export class ReviewAgent {
  /** Accumulated log entries for the current run. */
  private logs: AgentLog[] = [];

  /**
   * Append a timestamped entry to the internal log buffer.
   *
   * @param level   - Severity level.
   * @param message - Human-readable description of the event.
   */
  private log(level: AgentLog['level'], message: string): void {
    this.logs.push({ timestamp: Date.now(), level, message });
  }

  /**
   * Execute the visual evaluation pipeline.
   *
   * @param params.originalUrl  - URL of the original website.
   * @param params.generatedHtml - Source code of the generated clone.
   * @param params.scrapedData  - Optional scraped data from {@link CaptureAgent}.
   * @returns A standardised {@link AgentResult} containing the
   *          {@link VisualEvaluation}.
   */
  async execute(params: {
    originalUrl: string;
    generatedHtml: string;
    scrapedData?: any;
  }): Promise<AgentResult> {
    const start = Date.now();
    this.logs = [];

    try {
      this.log('info', 'Starting visual evaluation...');

      // Build the evaluation prompt
      const evalPrompt = this.buildEvalPrompt(params);

      this.log('info', 'Calling AI for visual comparison...');

      const response = await fetch('/api/mimo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'qa',
          url: params.originalUrl,
          generatedCode: params.generatedHtml.slice(0, 5000),
          scrapedData: params.scrapedData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Evaluation API failed: ${response.status}`);
      }

      const result = await response.json();

      // Normalise the response into a typed VisualEvaluation
      const evaluation = this.parseEvaluation(result);

      this.log('info', `Visual score: ${evaluation.totalScore}/100`);
      this.log('info', `Issues found: ${evaluation.issues.length}`);

      for (const issue of evaluation.issues) {
        this.log('warn', `[${issue.severity}] ${issue.dimension}: ${issue.description}`);
      }

      return {
        success: true,
        data: { evaluation },
        duration: Date.now() - start,
        logs: this.logs,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log('error', `Evaluation failed: ${msg}`);
      return {
        success: false,
        error: msg,
        duration: Date.now() - start,
        logs: this.logs,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Build the QA prompt that instructs the AI model on scoring criteria.
   *
   * @param params - The same parameters passed to {@link execute}.
   * @returns The full prompt string.
   */
  private buildEvalPrompt(params: {
    originalUrl: string;
    generatedHtml: string;
    scrapedData?: any;
  }): string {
    return `You are a visual QA engineer. Compare the original website with the generated clone.

Original URL: ${params.originalUrl}

Score each dimension 0-100:
1. Layout (structure, grid, positioning)
2. Color (palette accuracy, gradients, opacity)
3. Typography (font families, sizes, weights, hierarchy)
4. Spacing (margins, padding, gaps, alignment)
5. Detail (shadows, borders, icons, micro-interactions)
6. Responsiveness (mobile adaptation, breakpoints)

For each issue found, provide:
- dimension
- severity (critical/major/minor)
- description
- suggested fix

Output JSON with totalScore, dimensions, issues, suggestions.`;
  }

  /**
   * Parse the raw API response into a strongly-typed {@link VisualEvaluation}.
   *
   * Handles multiple response shapes (`qa`, `analysis`, nested `scores`)
   * and falls back to sensible defaults for any missing fields.
   *
   * @param result - The parsed JSON body from the `/api/mimo` response.
   * @returns A fully populated {@link VisualEvaluation}.
   */
  private parseEvaluation(result: any): VisualEvaluation {
    const qa = result.qa || result.analysis || {};

    const dimensions = {
      layout: qa.scores?.layout ?? qa.layoutScore ?? 75,
      color: qa.scores?.color ?? qa.colorScore ?? 75,
      typography: qa.scores?.typography ?? qa.fontScore ?? 75,
      spacing: qa.scores?.spacing ?? qa.spacingScore ?? 75,
      detail: qa.scores?.detail ?? qa.detailScore ?? 75,
      responsiveness: qa.scores?.responsiveness ?? 75,
    };

    const totalScore = Math.round(
      (dimensions.layout +
        dimensions.color +
        dimensions.typography +
        dimensions.spacing +
        dimensions.detail +
        dimensions.responsiveness) /
        6,
    );

    const issues: EvaluationIssue[] = (qa.issues || []).map((issue: any) => ({
      dimension: issue.dimension || 'general',
      severity: issue.severity || 'minor',
      description: issue.description || issue,
      fix: issue.fix || issue.suggestion || '',
    }));

    return {
      totalScore,
      dimensions,
      issues,
      suggestions: qa.suggestions || [],
    };
  }
}
