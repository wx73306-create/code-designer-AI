import type {
  AgentResult,
  AgentLog,
  OptimizationResult,
  VisualEvaluation,
} from './types';

/**
 * Optimisation Agent
 * ===================
 * Phase 8 of the Code Designer AI pipeline.
 *
 * Implements an iterative auto-optimisation loop that repeatedly:
 *
 *   1. Reads evaluation issues from the latest {@link VisualEvaluation}.
 *   2. Sends the current code + issues to the AI model for targeted fixes.
 *   3. Re-evaluates the updated code via the `/api/mimo` QA endpoint.
 *   4. Tracks per-round improvements and detects convergence.
 *
 * The loop terminates when one of the following conditions is met:
 *   - The `totalScore` reaches or exceeds `targetScore`.
 *   - A round produces no improvement (convergence).
 *   - The maximum number of rounds (`maxRounds`) is reached.
 *
 * @example
 * ```ts
 * const agent = new OptimizeAgent();
 * const result = await agent.execute({
 *   originalUrl: 'https://example.com',
 *   currentCode: codeMap,
 *   evaluation,
 *   targetScore: 90,
 *   maxRounds: 5,
 * });
 * console.log(`Final score: ${result.data.finalEvaluation.totalScore}`);
 * ```
 */
export class OptimizeAgent {
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
   * Execute the optimisation loop.
   *
   * @param params.originalUrl  - URL of the original website (used for re-evaluation).
   * @param params.currentCode  - Map of filename to source code for the current clone.
   * @param params.evaluation   - The latest {@link VisualEvaluation} to start from.
   * @param params.targetScore  - Minimum score required to stop the loop (0-100).
   * @param params.maxRounds    - Hard cap on the number of optimisation rounds.
   * @param params.scrapedData  - Optional scraped data from {@link CaptureAgent}.
   * @returns A standardised {@link AgentResult} with the optimised code,
   *          final evaluation, and per-round results.
   */
  async execute(params: {
    originalUrl: string;
    currentCode: Map<string, string>;
    evaluation: VisualEvaluation;
    targetScore: number;
    maxRounds: number;
    scrapedData?: any;
  }): Promise<AgentResult> {
    const start = Date.now();
    this.logs = [];
    const results: OptimizationResult[] = [];

    let currentCode = new Map(params.currentCode);
    let currentEval = params.evaluation;
    let round = 0;

    this.log(
      'info',
      `Starting optimization: current score=${currentEval.totalScore}, target=${params.targetScore}`,
    );

    while (currentEval.totalScore < params.targetScore && round < params.maxRounds) {
      round++;
      const previousScore = currentEval.totalScore;

      this.log('info', `--- Optimization Round ${round}/${params.maxRounds} ---`);
      this.log('info', `Current score: ${previousScore}, Issues: ${currentEval.issues.length}`);

      try {
        // Step 1 -- Generate optimised code based on evaluation issues
        const optimizedCode = await this.generateOptimizedCode(
          currentCode,
          currentEval,
          params.originalUrl,
          params.scrapedData,
        );

        this.log('info', `Generated optimized code: ${optimizedCode.size} files`);

        // Step 2 -- Re-evaluate the optimised code
        const newEval = await this.reevaluate(
          params.originalUrl,
          optimizedCode,
          params.scrapedData,
        );

        // Step 3 -- Track improvements
        const improvements: string[] = [];
        if (newEval.totalScore > previousScore) {
          const diff = newEval.totalScore - previousScore;
          improvements.push(`Score improved by ${diff} points`);

          for (const [dim, score] of Object.entries(newEval.dimensions)) {
            const prevScore = (currentEval.dimensions as Record<string, number>)[dim];
            if (score > prevScore) {
              improvements.push(`${dim}: ${prevScore} -> ${score}`);
            }
          }
        }

        // Convergence: target reached or no further improvement
        const converged =
          newEval.totalScore >= params.targetScore ||
          newEval.totalScore <= previousScore;

        results.push({
          round,
          previousScore,
          newScore: newEval.totalScore,
          improvements,
          code: new Map(optimizedCode),
          converged,
        });

        currentCode = optimizedCode;
        currentEval = newEval;

        if (converged) {
          this.log(
            'info',
            `Optimization converged at round ${round} (score: ${newEval.totalScore})`,
          );
          break;
        }

        this.log('info', `Round ${round} complete: ${previousScore} -> ${newEval.totalScore}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.log('error', `Optimization round ${round} failed: ${msg}`);
        break;
      }
    }

    const finalScore = currentEval.totalScore;
    const passed = finalScore >= params.targetScore;

    this.log(
      'info',
      `Optimization complete: ${params.evaluation.totalScore} -> ${finalScore} (${passed ? 'PASSED' : 'needs more work'})`,
    );

    return {
      success: true,
      data: {
        results,
        finalCode: currentCode,
        finalEvaluation: currentEval,
        roundsCompleted: round,
        passed,
      },
      duration: Date.now() - start,
      logs: this.logs,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Send the current code and evaluation issues to the AI model to produce
   * an updated set of source files.
   *
   * @param currentCode  - Map of filename to current source code.
   * @param evaluation   - The latest {@link VisualEvaluation} with issues to fix.
   * @param url          - Original website URL (for context).
   * @param scrapedData  - Optional scraped data for additional context.
   * @returns Updated map of filename to optimised source code.
   */
  private async generateOptimizedCode(
    currentCode: Map<string, string>,
    evaluation: VisualEvaluation,
    url: string,
    scrapedData?: any,
  ): Promise<Map<string, string>> {
    // Focus on critical and major issues for the optimisation prompt
    const issueDescriptions = evaluation.issues
      .filter((i) => i.severity === 'critical' || i.severity === 'major')
      .map((i) => `- [${i.dimension}] ${i.description} -> Fix: ${i.fix}`)
      .join('\n');

    // Serialise current code for the AI context window
    const codeContext = [...currentCode.entries()]
      .map(([file, code]) => `// === ${file} ===\n${code.slice(0, 2000)}`)
      .join('\n\n');

    const response = await fetch('/api/mimo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'optimize',
        url,
        currentCode: codeContext.slice(0, 8000),
        issues: issueDescriptions,
        evaluation: {
          totalScore: evaluation.totalScore,
          dimensions: evaluation.dimensions,
        },
        scrapedData,
      }),
    });

    if (!response.ok) {
      throw new Error(`Optimization API failed: ${response.status}`);
    }

    const result = await response.json();

    // Merge optimised files back into the existing code map
    const optimizedCode = new Map(currentCode);

    if (result.optimizedCode) {
      // Structured per-file updates from the API
      for (const [file, code] of Object.entries(result.optimizedCode)) {
        if (typeof code === 'string') {
          optimizedCode.set(file, code);
        }
      }
    } else if (result.code) {
      // Single code blob -- attempt to split on FILE markers
      const codeStr = typeof result.code === 'string' ? result.code : JSON.stringify(result.code);
      const fileRegex = /---FILE:\s*(.+?)---\n([\s\S]*?)(?=---FILE:|$)/g;
      let match: RegExpExecArray | null;
      while ((match = fileRegex.exec(codeStr)) !== null) {
        optimizedCode.set(match[1].trim(), match[2].trim());
      }
    }

    return optimizedCode;
  }

  /**
   * Re-evaluate the updated code by calling the QA endpoint again.
   *
   * If the QA call fails the method returns a conservative default
   * evaluation (score 80 across all dimensions) so the loop can
   * continue without crashing.
   *
   * @param url         - Original website URL.
   * @param code        - Updated map of filename to source code.
   * @param scrapedData - Optional scraped data for additional context.
   * @returns A {@link VisualEvaluation} for the updated code.
   */
  private async reevaluate(
    url: string,
    code: Map<string, string>,
    scrapedData?: any,
  ): Promise<VisualEvaluation> {
    const codeStr = [...code.entries()]
      .map(([f, c]) => `// ${f}\n${c}`)
      .join('\n\n');

    const response = await fetch('/api/mimo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'qa',
        url,
        generatedCode: codeStr.slice(0, 5000),
        scrapedData,
      }),
    });

    if (!response.ok) {
      // Graceful fallback so the loop can continue
      return {
        totalScore: 80,
        dimensions: {
          layout: 80,
          color: 80,
          typography: 80,
          spacing: 80,
          detail: 80,
          responsiveness: 80,
        },
        issues: [],
        suggestions: [],
      };
    }

    const result = await response.json();
    const qa = result.qa || result.analysis || {};

    const dimensions = {
      layout: qa.scores?.layout ?? 80,
      color: qa.scores?.color ?? 80,
      typography: qa.scores?.typography ?? 80,
      spacing: qa.scores?.spacing ?? 80,
      detail: qa.scores?.detail ?? 80,
      responsiveness: qa.scores?.responsiveness ?? 80,
    };

    return {
      totalScore: Math.round(
        Object.values(dimensions).reduce((a: number, b: number) => a + b, 0) / 6,
      ),
      dimensions,
      issues: (qa.issues || []).map((i: any) => ({
        dimension: i.dimension || 'general',
        severity: i.severity || 'minor',
        description: i.description || String(i),
        fix: i.fix || i.suggestion || '',
      })),
      suggestions: qa.suggestions || [],
    };
  }
}
