import { CaptureAgent } from './captureAgent';
import { VisionAgent } from './visionAgent';
import { ReviewAgent } from './reviewAgent';
import { OptimizeAgent } from './optimizeAgent';
import { matchDesignPreset, formatPresetForPrompt, DESIGN_PRESETS } from '../knowledge/design-system';
import { VISION_SYSTEM_PROMPT, buildVisionUserPrompt } from '../prompts/visionPrompt';
import { CODE_SYSTEM_PROMPT, buildCodeUserPrompt } from '../prompts/codePrompt';
import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } from '../prompts/reviewPrompt';
import type {
  AgentResult,
  AgentLog,
  WebsitePackage,
  DesignSystem,
  VisualEvaluation,
  OptimizationResult,
  PipelineConfig,
} from './types';

// =============================================================================
// Pipeline Progress Event
// =============================================================================

export interface PipelineProgress {
  phase: string;
  agent: string;
  status: 'started' | 'running' | 'completed' | 'error' | 'skipped';
  progress: number; // 0-100
  message: string;
  data?: any;
}

export type ProgressCallback = (event: PipelineProgress) => void;

// =============================================================================
// Pipeline Configuration
// =============================================================================

const DEFAULT_CONFIG: PipelineConfig = {
  maxOptimizationRounds: 5,
  targetScore: 90,
  enablePlaywright: false,
  enableVisionAnalysis: true,
  enableAutoOptimization: true,
  knowledgeBase: ['apple', 'stripe', 'linear', 'tesla', 'gaming', 'dashboard'],
};

// =============================================================================
// Multi-Agent Pipeline Orchestrator
// =============================================================================

/**
 * Website Reverse Engineering Pipeline
 *
 * Orchestrates 8 agents in sequence:
 * 1. Capture Agent — crawl URL, extract HTML/CSS/assets
 * 2. DOM Agent — analyze page structure (integrated in Capture)
 * 3. Vision Agent — multimodal design analysis
 * 4. Design Agent — build formal design system (with knowledge base)
 * 5. Component Agent — plan component tree
 * 6. Code Agent — generate React/Tailwind code
 * 7. Review Agent — visual fidelity scoring
 * 8. Optimize Agent — auto-fix loop until score >= target
 *
 * Plus Export (handled separately by export-html endpoint)
 */
export class Pipeline {
  private config: PipelineConfig;
  private abortController: AbortController;
  private onProgress: ProgressCallback;

  // Agent instances
  private captureAgent: CaptureAgent;
  private visionAgent: VisionAgent;
  private reviewAgent: ReviewAgent;
  private optimizeAgent: OptimizeAgent;

  // Pipeline state
  private scrapedData: any = null;
  private websitePackage: Partial<WebsitePackage> | null = null;
  private designSystem: DesignSystem | null = null;
  private matchedPreset: any = null;
  private componentTree: any = null;
  private generatedCode: Map<string, string> = new Map();
  private evaluation: VisualEvaluation | null = null;
  private optimizationResults: OptimizationResult[] = [];

  constructor(config?: Partial<PipelineConfig>, onProgress?: ProgressCallback) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.abortController = new AbortController();
    this.onProgress = onProgress || (() => {});

    this.captureAgent = new CaptureAgent();
    this.visionAgent = new VisionAgent();
    this.reviewAgent = new ReviewAgent();
    this.optimizeAgent = new OptimizeAgent();
  }

  /** Cancel the pipeline */
  cancel() {
    this.abortController.abort();
  }

  /** Check if pipeline was cancelled */
  private get cancelled(): boolean {
    return this.abortController.signal.aborted;
  }

  /** Emit progress event */
  private emit(event: PipelineProgress) {
    if (!this.cancelled) {
      this.onProgress(event);
    }
  }

  /** Check cancellation and throw if aborted */
  private checkCancelled() {
    if (this.cancelled) {
      throw new Error('Pipeline cancelled');
    }
  }

  // ===========================================================================
  // Main execution
  // ===========================================================================

  async execute(url: string): Promise<{
    success: boolean;
    error?: string;
    results: {
      websitePackage: Partial<WebsitePackage> | null;
      designSystem: DesignSystem | null;
      matchedPreset: any;
      componentTree: any;
      generatedCode: Map<string, string>;
      evaluation: VisualEvaluation | null;
      optimizationResults: OptimizationResult[];
    };
    duration: number;
  }> {
    const startTime = Date.now();

    try {
      // Phase 1-2: Capture + Intelligence Package
      await this.runCapture(url);
      this.checkCancelled();

      // Phase 3: Vision Analysis
      await this.runVisionAnalysis();
      this.checkCancelled();

      // Phase 4: Design System + Knowledge Base Matching
      await this.runDesignSystemExtraction();
      this.checkCancelled();

      // Phase 5: Component Planning + Code Generation
      await this.runComponentPlanning();
      this.checkCancelled();
      await this.runCodeGeneration();
      this.checkCancelled();

      // Phase 7: Visual Evaluation
      await this.runVisualEvaluation();
      this.checkCancelled();

      // Phase 8: Auto-Optimization Loop
      if (this.config.enableAutoOptimization && this.evaluation && this.evaluation.totalScore < this.config.targetScore) {
        await this.runOptimizationLoop();
      }

      return {
        success: true,
        results: {
          websitePackage: this.websitePackage,
          designSystem: this.designSystem,
          matchedPreset: this.matchedPreset,
          componentTree: this.componentTree,
          generatedCode: this.generatedCode,
          evaluation: this.evaluation,
          optimizationResults: this.optimizationResults,
        },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: this.cancelled ? 'Pipeline cancelled' : msg,
        results: {
          websitePackage: this.websitePackage,
          designSystem: this.designSystem,
          matchedPreset: this.matchedPreset,
          componentTree: this.componentTree,
          generatedCode: this.generatedCode,
          evaluation: this.evaluation,
          optimizationResults: this.optimizationResults,
        },
        duration: Date.now() - startTime,
      };
    }
  }

  // ===========================================================================
  // Phase 1-2: Website Capture + Intelligence Package
  // ===========================================================================

  private async runCapture(url: string): Promise<void> {
    this.emit({
      phase: 'capture',
      agent: 'CaptureAgent',
      status: 'started',
      progress: 0,
      message: 'Starting website capture...',
    });

    const result = await this.captureAgent.execute(url, {
      enablePlaywright: this.config.enablePlaywright,
    });

    if (!result.success) {
      this.emit({
        phase: 'capture',
        agent: 'CaptureAgent',
        status: 'error',
        progress: 0,
        message: `Capture failed: ${result.error}`,
      });
      throw new Error(result.error || 'Capture failed');
    }

    this.scrapedData = result.data.scraped;
    this.websitePackage = result.data.package;

    this.emit({
      phase: 'capture',
      agent: 'CaptureAgent',
      status: 'completed',
      progress: 100,
      message: `Captured: ${(this.scrapedData?.html?.length / 1024).toFixed(0)}KB HTML, ${this.scrapedData?.colors?.length || 0} colors, ${this.scrapedData?.fonts?.length || 0} fonts`,
      data: { scraped: this.scrapedData, package: this.websitePackage },
    });
  }

  // ===========================================================================
  // Phase 3: Vision Understanding
  // ===========================================================================

  private async runVisionAnalysis(): Promise<void> {
    if (!this.config.enableVisionAnalysis) {
      this.emit({
        phase: 'vision',
        agent: 'VisionAgent',
        status: 'skipped',
        progress: 100,
        message: 'Vision analysis disabled',
      });
      return;
    }

    this.emit({
      phase: 'vision',
      agent: 'VisionAgent',
      status: 'started',
      progress: 0,
      message: 'Analyzing visual design...',
    });

    const result = await this.visionAgent.execute(this.scrapedData);

    if (result.success) {
      this.designSystem = result.data.designSystem;
      this.emit({
        phase: 'vision',
        agent: 'VisionAgent',
        status: 'completed',
        progress: 100,
        message: `Design style: ${this.designSystem?.style || 'unknown'}, brand: ${this.designSystem?.brand || 'unknown'}`,
        data: result.data,
      });
    } else {
      this.emit({
        phase: 'vision',
        agent: 'VisionAgent',
        status: 'error',
        progress: 100,
        message: `Vision analysis failed: ${result.error}`,
      });
      // Non-fatal: continue with scraped data only
    }
  }

  // ===========================================================================
  // Phase 4: Design System + Knowledge Base
  // ===========================================================================

  private async runDesignSystemExtraction(): Promise<void> {
    this.emit({
      phase: 'design',
      agent: 'DesignAgent',
      status: 'started',
      progress: 0,
      message: 'Building design system with knowledge base...',
    });

    // Match against design presets
    this.matchedPreset = matchDesignPreset(this.scrapedData || {});

    this.emit({
      phase: 'design',
      agent: 'DesignAgent',
      status: 'running',
      progress: 50,
      message: `Matched preset: ${this.matchedPreset.preset} (confidence: ${(this.matchedPreset.confidence * 100).toFixed(0)}%)`,
    });

    // Enhance design system with preset knowledge
    if (this.matchedPreset.presetData && this.designSystem) {
      const preset = this.matchedPreset.presetData;
      this.designSystem.colorPalette = {
        ...this.designSystem.colorPalette,
        ...preset.colors,
      };
      this.designSystem.spacingScale = preset.spacing.scale;
      this.designSystem.animationStyle = preset.animation.style;
    }

    this.emit({
      phase: 'design',
      agent: 'DesignAgent',
      status: 'completed',
      progress: 100,
      message: `Design system ready: ${this.matchedPreset.preset} style, ${Object.keys(this.designSystem?.colorPalette || {}).length} colors`,
      data: { designSystem: this.designSystem, matchedPreset: this.matchedPreset },
    });
  }

  // ===========================================================================
  // Phase 5: Component Planning
  // ===========================================================================

  private async runComponentPlanning(): Promise<void> {
    this.emit({
      phase: 'planning',
      agent: 'ComponentAgent',
      status: 'started',
      progress: 0,
      message: 'Planning component tree...',
    });

    // Use the existing /api/mimo planning endpoint
    try {
      const response = await fetch('/api/mimo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'planning',
          url: this.websitePackage?.url,
          scrapedData: this.scrapedData,
          designSystem: this.designSystem,
          stylePreset: this.matchedPreset?.presetData,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        this.componentTree = result.componentTree || result.analysis;
      }
    } catch {
      // Fallback: generate a basic component tree from DOM analysis
      this.componentTree = this.generateFallbackComponentTree();
    }

    this.emit({
      phase: 'planning',
      agent: 'ComponentAgent',
      status: 'completed',
      progress: 100,
      message: `Component tree ready: ${this.componentTree?.files?.length || 0} components planned`,
      data: { componentTree: this.componentTree },
    });
  }

  private generateFallbackComponentTree(): any {
    const dom = this.websitePackage?.dom;
    if (!dom) return { tree: [], files: [], totalComponents: 0 };

    const components = (dom.sections || []).map((section: any) => ({
      name: section.name.replace(/[^a-zA-Z]/g, '') || 'Section',
      type: section.role || 'section',
      children: [],
    }));

    return {
      tree: [{ name: 'App', type: 'root', children: components }],
      files: components.map((c: any) => ({
        filename: `${c.name}.tsx`,
        component: c.name,
        dependencies: ['react'],
      })),
      totalComponents: components.length,
    };
  }

  // ===========================================================================
  // Phase 5b: Code Generation
  // ===========================================================================

  private async runCodeGeneration(): Promise<void> {
    this.emit({
      phase: 'code',
      agent: 'CodeAgent',
      status: 'started',
      progress: 0,
      message: 'Generating React components...',
    });

    try {
      const response = await fetch('/api/mimo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'code',
          url: this.websitePackage?.url,
          componentTree: this.componentTree,
          designSystem: this.designSystem,
          scrapedData: this.scrapedData,
          stylePreset: this.matchedPreset?.presetData,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Parse generated code
        if (result.generatedCode instanceof Map) {
          this.generatedCode = result.generatedCode;
        } else if (typeof result.code === 'string') {
          // Parse FILE markers
          const codeStr = result.code;
          const fileRegex = /---FILE:\s*(.+?)---\n([\s\S]*?)(?=---FILE:|$)/g;
          let match;
          while ((match = fileRegex.exec(codeStr)) !== null) {
            this.generatedCode.set(match[1].trim(), match[2].trim());
          }
        }
      }
    } catch {
      // Code generation failed — will be handled by the caller
    }

    const fileCount = this.generatedCode.size;
    const totalLines = [...this.generatedCode.values()].reduce((sum, code) => sum + code.split('\n').length, 0);

    this.emit({
      phase: 'code',
      agent: 'CodeAgent',
      status: fileCount > 0 ? 'completed' : 'error',
      progress: 100,
      message: fileCount > 0
        ? `Generated ${fileCount} files, ${totalLines.toLocaleString()} lines of code`
        : 'Code generation failed',
      data: { generatedCode: this.generatedCode, fileCount, totalLines },
    });
  }

  // ===========================================================================
  // Phase 7: Visual Evaluation
  // ===========================================================================

  private async runVisualEvaluation(): Promise<void> {
    if (this.generatedCode.size === 0) {
      this.emit({
        phase: 'review',
        agent: 'ReviewAgent',
        status: 'skipped',
        progress: 100,
        message: 'No code to evaluate',
      });
      return;
    }

    this.emit({
      phase: 'review',
      agent: 'ReviewAgent',
      status: 'started',
      progress: 0,
      message: 'Evaluating visual fidelity...',
    });

    const codeStr = [...this.generatedCode.entries()]
      .map(([f, c]) => `// ${f}\n${c}`)
      .join('\n\n');

    const result = await this.reviewAgent.execute({
      originalUrl: this.websitePackage?.url || '',
      generatedHtml: codeStr,
      scrapedData: this.scrapedData,
    });

    if (result.success) {
      this.evaluation = result.data.evaluation;
      this.emit({
        phase: 'review',
        agent: 'ReviewAgent',
        status: 'completed',
        progress: 100,
        message: `Visual score: ${this.evaluation!.totalScore}/100 (${this.evaluation!.issues.length} issues found)`,
        data: { evaluation: this.evaluation },
      });
    } else {
      this.emit({
        phase: 'review',
        agent: 'ReviewAgent',
        status: 'error',
        progress: 100,
        message: `Evaluation failed: ${result.error}`,
      });
    }
  }

  // ===========================================================================
  // Phase 8: Auto-Optimization Loop
  // ===========================================================================

  private async runOptimizationLoop(): Promise<void> {
    if (!this.evaluation || this.generatedCode.size === 0) return;

    this.emit({
      phase: 'optimize',
      agent: 'OptimizeAgent',
      status: 'started',
      progress: 0,
      message: `Starting optimization (target: ${this.config.targetScore}, current: ${this.evaluation.totalScore})...`,
    });

    const result = await this.optimizeAgent.execute({
      originalUrl: this.websitePackage?.url || '',
      currentCode: this.generatedCode,
      evaluation: this.evaluation,
      targetScore: this.config.targetScore,
      maxRounds: this.config.maxOptimizationRounds,
      scrapedData: this.scrapedData,
    });

    if (result.success) {
      const data = result.data;
      this.optimizationResults = data.results;
      this.generatedCode = data.finalCode;
      this.evaluation = data.finalEvaluation;

      this.emit({
        phase: 'optimize',
        agent: 'OptimizeAgent',
        status: 'completed',
        progress: 100,
        message: data.passed
          ? `Optimization PASSED: score ${this.evaluation!.totalScore}/${this.config.targetScore} (${data.roundsCompleted} rounds)`
          : `Optimization incomplete: score ${this.evaluation!.totalScore}/${this.config.targetScore} after ${data.roundsCompleted} rounds`,
        data: {
          optimizationResults: this.optimizationResults,
          finalEvaluation: this.evaluation,
          passed: data.passed,
        },
      });
    } else {
      this.emit({
        phase: 'optimize',
        agent: 'OptimizeAgent',
        status: 'error',
        progress: 100,
        message: `Optimization failed: ${result.error}`,
      });
    }
  }
}

// =============================================================================
// Convenience function for simple pipeline execution
// =============================================================================

export async function runPipeline(
  url: string,
  config?: Partial<PipelineConfig>,
  onProgress?: ProgressCallback,
) {
  const pipeline = new Pipeline(config, onProgress);
  return pipeline.execute(url);
}
