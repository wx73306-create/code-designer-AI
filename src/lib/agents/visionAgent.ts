import type {
  AgentResult,
  AgentLog,
  DesignSystem,
  VisualEvaluation,
} from './types';

/**
 * Vision Understanding Agent
 * ===========================
 * Phase 3 of the Code Designer AI pipeline.
 *
 * Analyses website screenshots (when available) and scraped data using a
 * multimodal AI model to produce a rich {@link DesignSystem} description.
 *
 * The agent sends a structured prompt to the `/api/mimo` endpoint which
 * routes the request to a vision-capable model.  The response is parsed
 * into the canonical {@link DesignSystem} interface consumed by downstream
 * code-generation agents.
 *
 * @example
 * ```ts
 * const agent = new VisionAgent();
 * const result = await agent.execute(scrapedData, screenshotDataUrl);
 * if (result.success) {
 *   console.log(result.data.designSystem.brand);
 * }
 * ```
 */
export class VisionAgent {
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
   * Execute the vision analysis pipeline.
   *
   * @param scrapedData - Raw scraped data produced by {@link CaptureAgent}.
   * @param screenshot  - Optional base-64 data URL of a page screenshot.
   * @returns A standardised {@link AgentResult} containing the AI analysis
   *          and the parsed {@link DesignSystem}.
   */
  async execute(scrapedData: any, screenshot?: string): Promise<AgentResult> {
    const start = Date.now();
    this.logs = [];

    try {
      this.log('info', 'Starting vision analysis...');

      // Build the structured prompt for the multimodal model
      const prompt = this.buildVisionPrompt(scrapedData);

      this.log('info', 'Calling multimodal AI for design analysis...');

      // Invoke the vision-capable model via the internal API
      const response = await fetch('/api/mimo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'vision',
          url: scrapedData.url,
          screenshot, // forwarded when Playwright is enabled
          scrapedData: {
            colors: scrapedData.colors?.slice(0, 15),
            fonts: scrapedData.fonts?.slice(0, 8),
            spacing: scrapedData.spacing,
            shadows: scrapedData.shadows?.slice(0, 5),
            layout: scrapedData.layout,
            htmlStructure: scrapedData.htmlStructure?.slice(0, 3000),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Vision API call failed: ${response.status}`);
      }

      const result = await response.json();

      this.log(
        'info',
        `Vision analysis complete: ${result.analysis?.brand || 'unknown'} brand`,
      );

      // Normalise the AI output into a typed DesignSystem
      const designSystem = this.parseDesignSystem(result.analysis);

      return {
        success: true,
        data: { analysis: result.analysis, designSystem },
        duration: Date.now() - start,
        logs: this.logs,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log('error', `Vision analysis failed: ${msg}`);
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
   * Construct the system prompt sent to the multimodal AI model.
   *
   * The prompt is intentionally content-agnostic -- it instructs the model
   * to focus on design patterns rather than page content.
   *
   * @param data - Scraped data subset to embed as known context.
   * @returns The full prompt string.
   */
  private buildVisionPrompt(data: any): string {
    return `You are a senior web design analyst. Analyze this website's design system.

DO NOT describe content. Focus on design patterns.

Analyze:
1. Color system (primary, secondary, accent, neutral palette)
2. Typography hierarchy (heading sizes, body text, font families)
3. Layout proportions (grid system, container widths, section ratios)
4. Visual focus points (what draws attention first)
5. Whitespace strategy (padding, margins, breathing room)
6. Image/asset treatment (aspect ratios, border radius, shadows)
7. Animation feel (transition timing, easing, motion patterns)

Known data:
- Colors: ${JSON.stringify(data.colors?.slice(0, 10))}
- Fonts: ${JSON.stringify(data.fonts?.slice(0, 5))}
- Spacing: ${JSON.stringify(data.spacing)}

Output a structured JSON design analysis.`;
  }

  /**
   * Normalise the raw AI response into a strongly-typed {@link DesignSystem}.
   *
   * Missing fields fall back to sensible defaults so downstream agents
   * always receive a complete object.
   *
   * @param analysis - The `analysis` object from the AI response.
   * @returns A fully populated {@link DesignSystem}.
   */
  private parseDesignSystem(analysis: any): DesignSystem {
    return {
      style: analysis?.style || 'modern-minimal',
      brand: analysis?.brand || 'Unknown',
      visualLanguage:
        analysis?.visualLanguage || 'Clean, modern design with generous whitespace',
      colorPalette: analysis?.colorPalette || {},
      typography: analysis?.typography || {},
      spacingScale: analysis?.spacingScale || [
        '4px',
        '8px',
        '16px',
        '24px',
        '32px',
        '48px',
      ],
      componentPatterns: analysis?.componentPatterns || [],
      animationStyle: analysis?.animationStyle || 'subtle-ease',
    };
  }
}
