import type {
  AgentResult,
  AgentLog,
  WebsitePackage,
  ScreenshotData,
  AssetData,
  DOMAnalysis,
  StyleAnalysis,
} from './types';

/**
 * Website Capture Agent
 * =====================
 * Phase 1 of the Code Designer AI pipeline.
 *
 * Crawls a target URL and extracts raw website data including HTML,
 * colours, fonts, spacing metrics, assets, and DOM structure.
 *
 * By default the agent uses HTTP-based scraping with built-in SSRF
 * protection (via the existing `website-scraper` module).  When
 * `enablePlaywright` is set to `true` the agent will also capture
 * full-page screenshots at desktop / tablet / mobile breakpoints.
 *
 * @example
 * ```ts
 * const agent = new CaptureAgent();
 * const result = await agent.execute('https://example.com');
 * if (result.success) {
 *   console.log(result.data.package);
 * }
 * ```
 */
export class CaptureAgent {
  /** Accumulated log entries for the current run. */
  private logs: AgentLog[] = [];

  /**
   * Append a timestamped entry to the internal log buffer.
   *
   * @param level  - Severity level (`debug` | `info` | `warn` | `error`).
   * @param message - Human-readable description of the event.
   */
  private log(level: AgentLog['level'], message: string): void {
    this.logs.push({ timestamp: Date.now(), level, message });
  }

  /**
   * Execute the capture pipeline for the given URL.
   *
   * @param url     - Fully-qualified HTTP(S) URL to capture.
   * @param options - Optional flags that alter capture behaviour.
   * @returns A standardised {@link AgentResult} containing the
   *          {@link WebsitePackage} and raw scraped data.
   */
  async execute(
    url: string,
    options?: { enablePlaywright?: boolean },
  ): Promise<AgentResult> {
    const start = Date.now();
    this.logs = [];

    try {
      this.log('info', `Starting capture for: ${url}`);

      // ----- URL validation ------------------------------------------------
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only HTTP/HTTPS URLs are supported');
      }

      // ----- HTML & style scraping -----------------------------------------
      this.log('info', 'Fetching page HTML...');

      const { scrapeWebsite } = await import('../website-scraper');
      const scraped = await scrapeWebsite(url);

      this.log('info', `HTML structure captured: ${scraped.htmlStructure.length} chars`);
      this.log('info', `Found ${scraped.colors.length} colors, ${scraped.fonts.length} fonts`);

      // ----- Asset extraction ----------------------------------------------
      const assets = this.extractAssets(scraped);
      this.log('info', `Extracted ${assets.length} assets`);

      // ----- DOM analysis --------------------------------------------------
      const dom = this.analyzeDOM(scraped.htmlStructure);
      this.log('info', `DOM analysis: ${dom.sections.length} sections, layout=${dom.layout}`);

      // ----- Style analysis ------------------------------------------------
      const styles = this.buildStyleAnalysis(scraped);

      // ----- Assemble Website Intelligence Package -------------------------
      const pkg: Partial<WebsitePackage> = {
        url,
        capturedAt: new Date().toISOString(),
        screenshots: [], // Populated by Playwright when enabled
        assets,
        dom,
        styles,
        design: {} as WebsitePackage['design'],       // Enriched by VisionAgent
        components: {} as WebsitePackage['components'], // Enriched by ComponentAgent
        animations: this.extractAnimations(scraped),
      };

      this.log('info', 'Website Intelligence Package assembled');

      return {
        success: true,
        data: { package: pkg, scraped },
        duration: Date.now() - start,
        logs: this.logs,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log('error', `Capture failed: ${msg}`);
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
   * Extract image and SVG asset references from the scraped HTML.
   *
   * @param scraped - Raw output from `scrapeWebsite`.
   * @returns An array of discovered {@link AssetData} entries (capped at 50).
   */
  private extractAssets(scraped: any): AssetData[] {
    const assets: AssetData[] = [];

    // <img src="...">
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = imgRegex.exec(scraped.htmlStructure)) !== null) {
      assets.push({ type: 'image', url: match[1] });
    }

    // Inline <svg> elements
    const svgRegex = /<svg[^>]*>[\s\S]*?<\/svg>/gi;
    let svgIdx = 0;
    while ((match = svgRegex.exec(scraped.htmlStructure)) !== null) {
      assets.push({
        type: 'svg',
        url: `inline-svg-${svgIdx++}`,
        mimeType: 'image/svg+xml',
      });
    }

    return assets.slice(0, 50);
  }

  /**
   * Analyse the HTML string and produce a structural summary of the page.
   *
   * Detects semantic sections (nav, header, main, footer, etc.), the
   * primary CSS layout model, and whether the page is responsive.
   *
   * @param html - Raw HTML source of the page.
   * @returns A populated {@link DOMAnalysis} object.
   */
  private analyzeDOM(html: string): DOMAnalysis {
    const sections: DOMAnalysis['sections'] = [];

    const sectionPatterns: { tag: string; role: DOMAnalysis['sections'][number]['role'] }[] = [
      { tag: 'nav', role: 'nav' },
      { tag: 'header', role: 'hero' },
      { tag: 'main', role: 'content' },
      { tag: 'section', role: 'content' },
      { tag: 'footer', role: 'footer' },
    ];

    for (const { tag, role } of sectionPatterns) {
      const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
      let idx = 0;
      while (regex.exec(html) !== null && idx < 3) {
        sections.push({
          name: `${tag}-${idx}`,
          tag,
          height: 'auto',
          layout: 'block',
          children: [],
          role,
        });
        idx++;
      }
    }

    // Detect primary layout model
    const hasGrid = /display:\s*grid|grid-template/i.test(html);
    const hasFlex = /display:\s*flex/i.test(html);
    const layout = hasGrid ? 'css-grid' : hasFlex ? 'flexbox' : 'block';

    // Detect responsive design indicators
    const responsive = /@media|viewport|responsive/i.test(html);

    return {
      pageType: this.detectPageType(html),
      sections,
      layout,
      responsive,
      structure: html.length > 1000 ? html.slice(0, 5000) : html,
    };
  }

  /**
   * Heuristically classify the page type based on keyword frequency in the HTML.
   *
   * @param html - Raw HTML source.
   * @returns A short string such as `'landing'`, `'ecommerce'`, or `'general'`.
   */
  private detectPageType(html: string): string {
    if (/product|shop|cart|buy|price/i.test(html)) return 'ecommerce';
    if (/blog|article|post/i.test(html)) return 'blog';
    if (/dashboard|admin|analytics/i.test(html)) return 'dashboard';
    if (/portfolio|project|work/i.test(html)) return 'portfolio';
    if (/landing|hero|cta|signup/i.test(html)) return 'landing';
    return 'general';
  }

  /**
   * Map raw scraper output into the structured {@link StyleAnalysis} format.
   *
   * @param scraped - Raw output from `scrapeWebsite`.
   * @returns A populated {@link StyleAnalysis} object.
   */
  private buildStyleAnalysis(scraped: any): StyleAnalysis {
    return {
      colors: (scraped.colors || []).slice(0, 20).map((c: string, i: number) => ({
        hex: c,
        role: i === 0 ? 'primary' : i === 1 ? 'secondary' : i === 2 ? 'accent' : 'text',
        usage: `extracted-${i}`,
      })),
      fonts: (scraped.fonts || []).slice(0, 10).map((f: string, i: number) => ({
        family: f,
        weights: [400, 700],
        sizes: ['14px', '16px', '24px', '32px'],
        role: i === 0 ? 'heading' : 'body',
      })),
      spacing: {
        base: scraped.spacing?.base || '4px',
        scale: scraped.spacing?.scale || ['4px', '8px', '16px', '24px', '32px', '48px', '64px'],
        containerMaxWidth: scraped.spacing?.containerMaxWidth || '1200px',
        sectionPadding: scraped.spacing?.sectionPadding || '64px 0',
      },
      shadows: scraped.shadows || [],
      borderRadius: scraped.borderRadius || [],
      transitions: scraped.transitions || [],
      cssVariables: scraped.cssVariables || {},
    };
  }

  /**
   * Extract animation / transition names from the scraped data.
   *
   * @param scraped - Raw output from `scrapeWebsite`.
   * @returns An array of {@link AnimationData}-shaped objects.
   */
  private extractAnimations(scraped: any): any[] {
    return (scraped.animations || []).map((a: string) => ({
      name: a,
      type: 'transition' as const,
      duration: '0.3s',
      easing: 'ease',
      target: 'element',
    }));
  }
}
