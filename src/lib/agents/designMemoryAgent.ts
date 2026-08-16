// =============================================================================
// Design Memory Agent — extracts design patterns from analysis reports
// and saves them to the Design Memory Database
// =============================================================================

import type { DesignReport } from '@/types/design-report';
import { saveDesignMemory, type DesignMemoryInput } from '@/lib/services/design-memory';

/**
 * Design Memory Agent
 *
 * Takes a Design Analysis Report and extracts reusable design patterns.
 * Saves them to the database for future AI generation reference.
 *
 * Key principle: save design METHODS, not content.
 */
export class DesignMemoryAgent {
  /**
   * Extract design patterns from a report and save to memory
   */
  async execute(report: DesignReport): Promise<{
    success: boolean;
    memoryId?: string;
    patterns: string[];
  }> {
    try {
      // Extract patterns from each dimension
      const patterns: string[] = [];

      // 1. Style pattern extraction
      const stylePattern = this.extractStylePattern(report);
      patterns.push(`Style: ${stylePattern.keywords.join(', ')}`);

      // 2. Color system extraction
      const colorPattern = this.extractColorPattern(report);
      patterns.push(`Color: ${colorPattern.primary}, ${colorPattern.accent}`);

      // 3. Typography pattern extraction
      const typographyPattern = this.extractTypographyPattern(report);
      patterns.push(`Typography: ${typographyPattern.fontFamily}`);

      // 4. Layout pattern extraction
      const layoutPattern = this.extractLayoutPattern(report);
      patterns.push(`Layout: ${layoutPattern.grid}`);

      // 5. Component pattern extraction
      const componentPattern = this.extractComponentPattern(report);
      patterns.push(`Components: ${componentPattern.length} extracted`);

      // 6. Animation pattern extraction
      const animationPattern = this.extractAnimationPattern(report);
      patterns.push(`Animation: ${animationPattern.scrollAnimation}`);

      // Generate website ID from URL
      const websiteId = this.generateWebsiteId(report.website.url);

      // Build memory input
      const memoryInput: DesignMemoryInput = {
        websiteId,
        websiteName: report.website.name,
        websiteUrl: report.website.url,
        category: this.detectCategory(report),
        style: stylePattern,
        color: colorPattern,
        typography: typographyPattern,
        layout: layoutPattern,
        component: componentPattern,
        animation: animationPattern,
        confidence: report.score.total / 100,
      };

      // Save to database
      const memory = await saveDesignMemory(memoryInput);

      return {
        success: true,
        memoryId: memory.id,
        patterns,
      };
    } catch (error) {
      console.error('[DesignMemoryAgent] Failed to save memory:', error);
      return {
        success: false,
        patterns: [],
      };
    }
  }

  private extractStylePattern(report: DesignReport) {
    return {
      keywords: report.brandPosition.keywords,
      mood: report.visualLanguage.mood,
      density: report.visualLanguage.density,
      whitespace: report.visualLanguage.whitespace,
      motion: report.visualLanguage.motion,
    };
  }

  private extractColorPattern(report: DesignReport) {
    return {
      primary: report.colorSystem.primary,
      secondary: report.colorSystem.secondary,
      background: report.colorSystem.background,
      accent: report.colorSystem.accent,
      tokens: report.colorSystem.tokens,
      contrast: this.calculateContrast(report.colorSystem.primary, report.colorSystem.background),
    };
  }

  private extractTypographyPattern(report: DesignReport) {
    return {
      fontFamily: report.typography.heading,
      bodyFont: report.typography.body,
      headingSize: report.typography.scale[0]?.size || '48px',
      bodySize: report.typography.scale.find(s => s.label === 'Body')?.size || '16px',
      weights: report.typography.scale.map(s => s.weight),
      lineHeight: report.typography.lineHeight,
      letterSpacing: report.typography.letterSpacing,
    };
  }

  private extractLayoutPattern(report: DesignReport) {
    return {
      grid: report.layout.grid,
      maxWidth: report.layout.maxWidth,
      breakpoints: report.layout.breakpoints,
      sectionCount: report.layout.sections.length,
      sectionTypes: report.layout.sections.map(s => s.type),
    };
  }

  private extractComponentPattern(report: DesignReport) {
    return report.components.map(c => ({
      name: c.name,
      type: c.description,
      priority: c.priority,
    }));
  }

  private extractAnimationPattern(report: DesignReport) {
    return {
      scrollAnimation: report.visualLanguage.motion,
      transition: 'ease-out',
      duration: 600,
      hover: 'scale + shadow',
    };
  }

  private detectCategory(report: DesignReport): string {
    const keywords = report.brandPosition.keywords.join(' ').toLowerCase();
    const industry = report.brandPosition.industry.toLowerCase();

    if (industry.includes('tech') || keywords.includes('technology')) return 'technology';
    if (industry.includes('ecommerce') || keywords.includes('shop')) return 'ecommerce';
    if (industry.includes('finance') || keywords.includes('fintech')) return 'finance';
    if (keywords.includes('creative') || keywords.includes('design')) return 'creative';
    if (keywords.includes('portfolio') || keywords.includes('agency')) return 'portfolio';
    if (keywords.includes('saas') || keywords.includes('dashboard')) return 'saas';
    if (keywords.includes('luxury') || keywords.includes('premium')) return 'luxury';
    return 'general';
  }

  private generateWebsiteId(url: string): string {
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      return hostname.replace(/\./g, '_');
    } catch {
      return `site_${Date.now()}`;
    }
  }

  private calculateContrast(fg: string, bg: string): string {
    // Simple luminance check
    const fgLum = this.getLuminance(fg);
    const bgLum = this.getLuminance(bg);
    const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);
    return ratio > 7 ? 'high' : ratio > 4.5 ? 'medium' : 'low';
  }

  private getLuminance(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
}
