// =====================================================================
// Export Generator — Create real downloadable files from pipeline data
// Reads from the Zustand store and generates actual content
// =====================================================================

import JSZip from 'jszip';
import type { DesignAnalysis, ComponentNode, QAResult, FileNode } from '@/types/agent';
import { buildPreviewHtml } from '@/lib/preview-utils';

/** All pipeline data available for export */
export interface ExportData {
  url: string;
  goal: string | null;
  designAnalysis: DesignAnalysis | null;
  componentTree: ComponentNode | null;
  generatedCode: Map<string, string> | null;
  qaResult: QAResult | null;
  projectStructure: FileNode[] | null;
}

// =====================================================================
// JSON Exports — Real design tokens from analysis
// =====================================================================

export function generateDesignTokensJSON(data: ExportData): string {
  const analysis = data.designAnalysis;
  if (!analysis) return JSON.stringify({ error: "No design analysis data available" }, null, 2);

  const tokens: Record<string, unknown> = {
    "$schema": "https://design-tokens.github.io/community-group/format/",
    meta: {
      source: "Code Designer AI",
      url: data.url,
      generated: new Date().toISOString(),
    },
  };

  // Real colors from analysis
  if (analysis.colors?.length) {
    tokens.color = Object.fromEntries(
      analysis.colors.map((c, i) => [
        c.name?.toLowerCase().replace(/\s+/g, '-') || `color-${i}`,
        { value: c.hex, type: "color", description: c.usage || "" }
      ])
    );
  }

  // Real typography from analysis
  if (analysis.typography?.length) {
    tokens.typography = Object.fromEntries(
      analysis.typography.map((t, i) => [
        t.name?.toLowerCase().replace(/\s+/g, '-') || `font-${i}`,
        {
          fontFamily: { value: t.family || "system-ui" },
          fontWeight: { value: String(t.weight || 400) },
          fontSize: { value: t.size || "16px" },
          description: t.usage || "",
        }
      ])
    );
  }

  // Real spacing from analysis
  if (analysis.spacing?.length) {
    tokens.spacing = Object.fromEntries(
      analysis.spacing.map((s, i) => [`space-${i + 1}`, { value: `${s}px`, type: "dimension" }])
    );
  }

  // Real border radius
  if (analysis.borderRadius?.length) {
    tokens.borderRadius = Object.fromEntries(
      analysis.borderRadius.map((r, i) => [`radius-${i + 1}`, { value: `${r}px`, type: "dimension" }])
    );
  }

  // Real shadows
  if (analysis.shadows?.length) {
    tokens.shadow = Object.fromEntries(
      analysis.shadows.map(s => [s.name || "shadow", { value: s.value, type: "shadow" }])
    );
  }

  // Real animations
  if (analysis.animations?.length) {
    tokens.animation = Object.fromEntries(
      analysis.animations.map(a => [
        a.name || "anim",
        { property: a.property, duration: a.duration, easing: a.easing }
      ])
    );
  }

  // Layout info
  const analysisAny = analysis as unknown as Record<string, unknown>;
  if (analysisAny.layout) {
    tokens.layout = analysisAny.layout;
  }

  // Color recommendations (if colors goal)
  if (analysisAny.colorRecommendations) {
    tokens.colorRecommendations = analysisAny.colorRecommendations;
  }

  return JSON.stringify(tokens, null, 2);
}

export function generateLayoutTokensJSON(data: ExportData): string {
  const analysis = data.designAnalysis;
  if (!analysis) return JSON.stringify({ error: "No analysis data" }, null, 2);

  const result: Record<string, unknown> = {
    meta: { source: "Code Designer AI", url: data.url, generated: new Date().toISOString() },
    spacing: analysis.spacing?.length
      ? Object.fromEntries(analysis.spacing.map((s, i) => [`s${i + 1}`, `${s}px`]))
      : {},
    borderRadius: analysis.borderRadius?.length
      ? Object.fromEntries(analysis.borderRadius.map((r, i) => [`r${i + 1}`, `${r}px`]))
      : {},
  };

  const analysisAny = analysis as unknown as Record<string, unknown>;
  if (analysisAny.layout) {
    result.layout = analysisAny.layout;
  }
  if (analysisAny.layoutAnalysis) {
    result.layoutAnalysis = analysisAny.layoutAnalysis;
  }

  return JSON.stringify(result, null, 2);
}

export function generateAnimationConfigJSON(data: ExportData): string {
  const analysis = data.designAnalysis;
  if (!analysis) return JSON.stringify({ error: "No analysis data" }, null, 2);

  return JSON.stringify({
    meta: { source: "Code Designer AI", url: data.url, generated: new Date().toISOString() },
    animations: analysis.animations || [],
    transitions: (analysis as unknown as Record<string, unknown>).transitions || [],
  }, null, 2);
}

export function generateColorRecommendationsJSON(data: ExportData): string {
  const analysisAny = data.designAnalysis as unknown as Record<string, unknown> | null;
  if (!analysisAny) return JSON.stringify({ error: "No analysis data" }, null, 2);

  const result: Record<string, unknown> = {
    meta: { source: "Code Designer AI", url: data.url, generated: new Date().toISOString() },
    extractedColors: data.designAnalysis?.colors || [],
  };

  if (analysisAny.colorRecommendations) {
    result.recommendations = analysisAny.colorRecommendations;
  }

  return JSON.stringify(result, null, 2);
}

// =====================================================================
// CSS Exports — Real CSS custom properties from analysis
// =====================================================================

export function generateDesignTokensCSS(data: ExportData): string {
  const analysis = data.designAnalysis;
  if (!analysis) return "/* No design analysis data available */";

  let css = `/* ============================================================\n   Design Tokens — Generated from ${data.url}\n   Source: Code Designer AI | ${new Date().toLocaleDateString('zh-CN')}\n   ============================================================ */\n\n`;

  css += `:root {\n`;

  // Colors
  if (analysis.colors?.length) {
    css += `  /* ---- Colors ---- */\n`;
    for (const c of analysis.colors) {
      const varName = `--color-${(c.name || 'unnamed').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      css += `  ${varName}: ${c.hex};${c.usage ? ` /* ${c.usage} */` : ''}\n`;
    }
    css += `\n`;
  }

  // Typography
  if (analysis.typography?.length) {
    css += `  /* ---- Typography ---- */\n`;
    const families = new Set<string>();
    for (const t of analysis.typography) {
      if (t.family) families.add(t.family);
      const varName = `--font-${(t.name || 'unnamed').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      css += `  ${varName}-family: "${t.family}", system-ui, sans-serif;\n`;
      if (t.weight) css += `  ${varName}-weight: ${t.weight};\n`;
      if (t.size) css += `  ${varName}-size: ${t.size};\n`;
    }
    css += `\n`;
  }

  // Spacing
  if (analysis.spacing?.length) {
    css += `  /* ---- Spacing ---- */\n`;
    analysis.spacing.forEach((s, i) => {
      css += `  --space-${i + 1}: ${s}px;\n`;
    });
    css += `\n`;
  }

  // Border radius
  if (analysis.borderRadius?.length) {
    css += `  /* ---- Border Radius ---- */\n`;
    analysis.borderRadius.forEach((r, i) => {
      css += `  --radius-${i + 1}: ${r}px;\n`;
    });
    css += `\n`;
  }

  // Shadows
  if (analysis.shadows?.length) {
    css += `  /* ---- Shadows ---- */\n`;
    for (const s of analysis.shadows) {
      const varName = `--shadow-${(s.name || 'default').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      css += `  ${varName}: ${s.value};\n`;
    }
    css += `\n`;
  }

  css += `}\n`;
  return css;
}

// =====================================================================
// Markdown Exports — Real documentation from pipeline data
// =====================================================================

export function generateDesignAnalysisReport(data: ExportData): string {
  const analysis = data.designAnalysis;
  if (!analysis) return `# Design Analysis Report\n\nNo analysis data available.\n`;

  let md = `# Design Analysis Report\n\n`;
  md += `> **Source:** ${data.url}\n`;
  md += `> **Generated:** ${new Date().toLocaleString('zh-CN')}\n`;
  md += `> **Tool:** Code Designer AI\n\n---\n\n`;

  // Colors
  if (analysis.colors?.length) {
    md += `## Color Palette\n\n`;
    md += `| Name | Hex | Usage |\n|------|-----|-------|\n`;
    for (const c of analysis.colors) {
      md += `| ${c.name || 'Unnamed'} | \`${c.hex}\` | ${c.usage || '—'} |\n`;
    }
    md += `\n`;
  }

  // Typography
  if (analysis.typography?.length) {
    md += `## Typography\n\n`;
    md += `| Name | Family | Weight | Size | Usage |\n|------|--------|--------|------|-------|\n`;
    for (const t of analysis.typography) {
      md += `| ${t.name || 'Unnamed'} | ${t.family || '—'} | ${t.weight || '—'} | ${t.size || '—'} | ${t.usage || '—'} |\n`;
    }
    md += `\n`;
  }

  // Spacing
  if (analysis.spacing?.length) {
    md += `## Spacing System\n\n`;
    md += `Spacing scale (px): ${analysis.spacing.join(' → ')}\n\n`;
  }

  // Border Radius
  if (analysis.borderRadius?.length) {
    md += `## Border Radius\n\n`;
    md += `Radius values (px): ${analysis.borderRadius.join(', ')}\n\n`;
  }

  // Shadows
  if (analysis.shadows?.length) {
    md += `## Shadows\n\n`;
    md += `| Name | Value |\n|------|-------|\n`;
    for (const s of analysis.shadows) {
      md += `| ${s.name || 'default'} | \`${s.value}\` |\n`;
    }
    md += `\n`;
  }

  // Animations
  if (analysis.animations?.length) {
    md += `## Animations\n\n`;
    md += `| Name | Property | Duration | Easing |\n|------|----------|----------|--------|\n`;
    for (const a of analysis.animations) {
      md += `| ${a.name || 'unnamed'} | ${a.property || '—'} | ${a.duration || '—'} | ${a.easing || '—'} |\n`;
    }
    md += `\n`;
  }

  // Layout
  const analysisAny = analysis as unknown as Record<string, unknown>;
  if (analysisAny.layout) {
    md += `## Layout\n\n`;
    const layout = analysisAny.layout as Record<string, unknown>;
    if (layout.gridType) md += `- Grid: ${layout.gridType}\n`;
    if (layout.maxWidth) md += `- Max Width: ${layout.maxWidth}\n`;
    if (layout.breakpoints) md += `- Breakpoints: ${(layout.breakpoints as number[]).join('px, ')}px\n`;
    md += `\n`;
  }

  // Goal-specific sections
  if (analysisAny.colorRecommendations) {
    md += `## Recommended Color Schemes\n\n`;
    const recs = analysisAny.colorRecommendations as Array<Record<string, string>>;
    for (const rec of recs) {
      md += `### ${rec.name || 'Scheme'}\n`;
      for (const [key, val] of Object.entries(rec)) {
        if (key !== 'name') md += `- ${key}: \`${val}\`\n`;
      }
      md += `\n`;
    }
  }

  if (analysisAny.layoutAnalysis) {
    md += `## Layout Analysis\n\n`;
    md += typeof analysisAny.layoutAnalysis === 'string'
      ? analysisAny.layoutAnalysis
      : JSON.stringify(analysisAny.layoutAnalysis, null, 2);
    md += `\n\n`;
  }

  if (analysisAny.designStyle) {
    md += `## Design Style\n\n`;
    md += typeof analysisAny.designStyle === 'string'
      ? analysisAny.designStyle
      : JSON.stringify(analysisAny.designStyle, null, 2);
    md += `\n\n`;
  }

  if (analysisAny.featureHighlights) {
    md += `## Feature Highlights\n\n`;
    const features = analysisAny.featureHighlights as Array<Record<string, string>>;
    if (Array.isArray(features)) {
      for (const f of features) {
        md += `### ${f.name || 'Feature'}\n`;
        if (f.category) md += `*Category: ${f.category}*\n`;
        if (f.description) md += `${f.description}\n`;
        md += `\n`;
      }
    } else {
      md += JSON.stringify(features, null, 2) + `\n`;
    }
  }

  return md;
}

export function generateComponentDocs(data: ExportData): string {
  const tree = data.componentTree;
  if (!tree) return `# Component Documentation\n\nNo component tree data available.\n`;

  let md = `# Component Documentation\n\n`;
  md += `> **Source:** ${data.url}\n`;
  md += `> **Generated:** ${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;

  // Flatten tree into component list
  const components: Array<{ name: string; type: string; depth: number; props: string[]; children: string[] }> = [];
  function walk(node: ComponentNode, depth: number) {
    components.push({
      name: node.name,
      type: node.type,
      depth,
      props: node.props ? Object.keys(node.props) : [],
      children: (node.children || []).map(c => c.name),
    });
    for (const child of (node.children || [])) {
      walk(child, depth + 1);
    }
  }
  walk(tree, 0);

  md += `## Overview\n\nTotal components: **${components.length}**\n\n`;

  // Component tree
  md += `## Component Tree\n\n\`\`\`\n`;
  function printTree(node: ComponentNode, prefix: string) {
    md += `${prefix}${node.name} (${node.type})\n`;
    const children = node.children || [];
    children.forEach((child, i) => {
      const isLast = i === children.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      md += `${prefix}${connector}${child.name} (${child.type})\n`;
      if (child.children?.length) {
        for (const grandchild of child.children) {
          printTree(grandchild, nextPrefix);
        }
      }
    });
  }
  printTree(tree, '');
  md += `\`\`\`\n\n`;

  // Detailed component list
  md += `## Component Details\n\n`;
  for (const comp of components) {
    if (comp.type === 'component' || comp.type === 'page') {
      md += `### ${comp.name}\n\n`;
      md += `- **Type:** ${comp.type}\n`;
      if (comp.props.length) md += `- **Props:** ${comp.props.join(', ')}\n`;
      if (comp.children.length) md += `- **Children:** ${comp.children.join(', ')}\n`;
      md += `\n`;
    }
  }

  return md;
}

export function generateAIPrompt(data: ExportData, target: 'cursor' | 'claude' | 'generic'): string {
  const analysis = data.designAnalysis;
  const tree = data.componentTree;

  let md = `# ${target === 'cursor' ? 'Cursor' : target === 'claude' ? 'Claude' : 'AI'} AI Project Context\n\n`;
  md += `> Auto-generated by Code Designer AI from: ${data.url}\n`;
  md += `> Date: ${new Date().toLocaleDateString('zh-CN')}\n\n`;

  md += `## Project Overview\n\n`;
  md += `This project is a React clone of ${data.url}, built with:\n`;
  md += `- React 19 + TypeScript\n- Tailwind CSS v4\n- Framer Motion\n- Next.js 16\n- Zustand\n\n`;

  if (data.goal) {
    const goalLabels: Record<string, string> = {
      colors: '学习配色方案', layout: '学习布局排版', style: '学习设计风格',
      features: '学习特色功能', template: '构建项目模板',
    };
    md += `**Analysis Goal:** ${goalLabels[data.goal] || data.goal}\n\n`;
  }

  if (analysis?.colors?.length) {
    md += `## Design System — Colors\n\n`;
    md += `| Name | Hex | Usage |\n|------|-----|-------|\n`;
    for (const c of analysis.colors.slice(0, 10)) {
      md += `| ${c.name} | \`${c.hex}\` | ${c.usage} |\n`;
    }
    md += `\n`;
  }

  if (analysis?.typography?.length) {
    md += `## Design System — Typography\n\n`;
    for (const t of analysis.typography.slice(0, 5)) {
      md += `- **${t.name}**: ${t.family} ${t.weight} ${t.size} (${t.usage})\n`;
    }
    md += `\n`;
  }

  if (tree) {
    md += `## Component Architecture\n\n`;
    md += `Root: ${tree.name}\n`;
    for (const child of (tree.children || []).slice(0, 10)) {
      md += `- ${child.name} (${child.type})${child.children?.length ? ` — ${child.children.length} sub-components` : ''}\n`;
    }
    md += `\n`;
  }

  if (data.qaResult) {
    md += `## Quality Metrics\n\n`;
    md += `- Visual Similarity: ${data.qaResult.similarity}%\n`;
    if (data.qaResult.accessibilityScore !== undefined) md += `- Accessibility: ${data.qaResult.accessibilityScore}/100\n`;
    if (data.qaResult.performanceScore !== undefined) md += `- Performance: ${data.qaResult.performanceScore}/100\n`;
    if (data.qaResult.issues?.length) {
      md += `- Issues Found: ${data.qaResult.issues.length}\n`;
      for (const issue of data.qaResult.issues.slice(0, 5)) {
        md += `  - [${issue.severity}] ${issue.description}\n`;
      }
    }
    md += `\n`;
  }

  md += `## Instructions for AI Assistant\n\n`;
  if (target === 'cursor') {
    md += `You are helping develop this project. Follow these conventions:\n`;
    md += `1. Use the exact design tokens listed above\n2. Match the component architecture\n3. Use Tailwind CSS utility classes\n4. Add Framer Motion for animations\n`;
  } else if (target === 'claude') {
    md += `You are assisting with this project's development. Guidelines:\n`;
    md += `1. Maintain the established design system\n2. Follow the component tree structure\n3. Generate TypeScript-first code\n4. Include responsive design support\n`;
  } else {
    md += `Use this context to assist with development of this project.\n`;
  }

  return md;
}

export function generateProjectSummary(data: ExportData): string {
  let md = `# Project Summary Report\n\n`;
  md += `> **URL:** ${data.url}\n`;
  md += `> **Generated:** ${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;

  // Design analysis summary
  if (data.designAnalysis) {
    const a = data.designAnalysis;
    md += `## Design Analysis\n\n`;
    md += `- Colors extracted: ${a.colors?.length || 0}\n`;
    md += `- Typography tokens: ${a.typography?.length || 0}\n`;
    md += `- Spacing values: ${a.spacing?.length || 0}\n`;
    md += `- Shadow definitions: ${a.shadows?.length || 0}\n`;
    md += `- Animation configs: ${a.animations?.length || 0}\n\n`;
  }

  // Component tree summary
  if (data.componentTree) {
    let total = 0;
    function count(node: ComponentNode) { total++; (node.children || []).forEach(count); }
    count(data.componentTree);
    md += `## Component Architecture\n\n`;
    md += `- Total nodes: ${total}\n`;
    md += `- Root: ${data.componentTree.name}\n`;
    md += `- Top-level sections: ${data.componentTree.children?.length || 0}\n\n`;
  }

  // Code summary
  if (data.generatedCode) {
    let totalLines = 0;
    const files = Array.from(data.generatedCode.entries());
    for (const [, code] of files) totalLines += code.split('\n').length;
    md += `## Generated Code\n\n`;
    md += `- Files: ${files.length}\n`;
    md += `- Total lines: ${totalLines.toLocaleString()}\n\n`;
    md += `### File List\n\n`;
    for (const [name, code] of files) {
      md += `- \`${name}\` (${code.split('\n').length} lines)\n`;
    }
    md += `\n`;
  }

  // QA summary
  if (data.qaResult) {
    md += `## Quality Assessment\n\n`;
    md += `- Visual similarity: ${data.qaResult.similarity}%\n`;
    md += `- Issues: ${data.qaResult.issues?.length || 0}\n`;
    md += `- Auto-fixes: ${data.qaResult.fixes?.length || 0}\n`;
    if (data.qaResult.accessibilityScore !== undefined) md += `- Accessibility score: ${data.qaResult.accessibilityScore}/100\n`;
    if (data.qaResult.performanceScore !== undefined) md += `- Performance score: ${data.qaResult.performanceScore}/100\n`;
    md += `\n`;
  }

  return md;
}

// =====================================================================
// ZIP Export — Bundle all generated code + config files
// =====================================================================

export async function generateProjectZip(data: ExportData): Promise<Blob> {
  const zip = new JSZip();

  const siteTitle = data.url
    ? new URL(data.url).hostname.replace('www.', '')
    : 'Code Designer AI Export';
  const projectName = siteTitle.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'my-project';

  // ── Phase 1: Collect & normalize source files ─────────────────
  // Fix src/src/ double nesting, categorize files
  const componentFiles: { name: string; path: string; code: string }[] = [];
  const cssFiles: { path: string; code: string }[] = [];
  let hasPageTsx = false;

  if (data.generatedCode) {
    for (const [rawFilename, code] of data.generatedCode.entries()) {
      // Flatten src/src/ → src/ (fix double nesting)
      let filename = rawFilename.replace(/^src\/src\//, 'src/');

      if (filename.includes('/')) {
        // Determine category by path
        if (filename.includes('components/')) {
          const name = filename.split('/').pop()!.replace(/\.(tsx|jsx|ts|js)$/, '');
          componentFiles.push({ name, path: filename, code });
        } else if (filename.endsWith('.css')) {
          cssFiles.push({ path: filename, code });
        } else if (filename.includes('page.tsx') || filename.includes('page.jsx')) {
          hasPageTsx = true;
          zip.file(filename, code);
        } else {
          zip.file(filename, code);
        }
      } else {
        // Flat filename — categorize by extension
        if (filename === 'page.tsx' || filename === 'page.jsx') {
          hasPageTsx = true;
          zip.file(`src/app/${filename}`, code);
        } else if (filename.endsWith('.tsx') || filename.endsWith('.jsx')) {
          const name = filename.replace(/\.(tsx|jsx)$/, '');
          componentFiles.push({ name, path: `src/components/${filename}`, code });
        } else if (filename.endsWith('.css')) {
          cssFiles.push({ path: `src/styles/${filename}`, code });
        } else {
          zip.file(`src/${filename}`, code);
        }
      }
    }
  }

  // Write component files to src/components/sections/
  for (const comp of componentFiles) {
    // Normalize path: ensure under src/components/
    let targetPath = comp.path;
    if (!targetPath.startsWith('src/')) {
      targetPath = `src/components/${targetPath.split('/').pop()}`;
    }
    // Flatten any remaining src/src/
    targetPath = targetPath.replace(/^src\/src\//, 'src/');
    zip.file(targetPath, comp.code);
  }

  // Write CSS files to src/styles/
  for (const css of cssFiles) {
    let targetPath = css.path.replace(/^src\/src\//, 'src/');
    if (!targetPath.startsWith('src/')) {
      targetPath = `src/styles/${targetPath.split('/').pop()}`;
    }
    zip.file(targetPath, css.code);
  }

  // ── Phase 2: Auto-generate page.tsx (assemble orphan components) ──
  if (!hasPageTsx && componentFiles.length > 0) {
    // Sort components by semantic order: Nav → Hero → Features → Testimonials → Partners → CTA → Footer
    const ORDER_HINTS = ['nav', 'header', 'hero', 'feature', 'story', 'testimonial', 'partner', 'institutional', 'cta', 'footer'];
    const sorted = [...componentFiles].sort((a, b) => {
      const ai = ORDER_HINTS.findIndex(h => a.name.toLowerCase().includes(h));
      const bi = ORDER_HINTS.findIndex(h => b.name.toLowerCase().includes(h));
      return (ai === -1 ? 50 : ai) - (bi === -1 ? 50 : bi);
    });

    // Determine import style: check if components use export default
    const imports = sorted.map(c => {
      const isDefault = c.code.includes('export default');
      // Derive import path from actual file location: src/components/sections/Foo.tsx → @/components/sections/Foo
      const importPath = '@/' + c.path.replace(/^src\//, '').replace(/\.(tsx|jsx|ts|js)$/, '');
      return isDefault
        ? `import ${c.name} from "${importPath}";`
        : `import { ${c.name} } from "${importPath}";`;
    });

    const jsxElements = sorted.map(c => `        <${c.name} />`);

    // Find nav-like component to place outside <main>
    const navIdx = sorted.findIndex(c => /nav|header/i.test(c.name));
    let pageBody: string;
    if (navIdx >= 0) {
      const navComp = sorted[navIdx];
      const rest = sorted.filter((_, i) => i !== navIdx);
      pageBody = `      <${navComp.name} />\n      <main>\n${rest.map(c => `        <${c.name} />`).join('\n')}\n      </main>`;
    } else {
      pageBody = `      <main>\n${jsxElements.join('\n')}\n      </main>`;
    }

    zip.file('src/app/page.tsx',
`${imports.join('\n')}

export default function Home() {
  return (
    <>
${pageBody}
    </>
  );
}
`);
  }

  // ── Phase 3: Build configuration files ────────────────────────

  // next.config.ts — enable static export
  zip.file('next.config.ts',
`import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
`);

  // tsconfig.json — with @/* path alias
  zip.file('tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }, null, 2));

  // postcss.config.mjs — Tailwind v4 via @tailwindcss/postcss
  zip.file('postcss.config.mjs',
`export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`);

  // src/app/layout.tsx
  zip.file('src/app/layout.tsx',
`import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${siteTitle}",
  description: "Generated by Code Designer AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`);

  // src/app/globals.css — Tailwind v4 + tokens import
  const hasTokensCss = cssFiles.some(c => c.path.includes('tokens'));
  zip.file('src/app/globals.css',
`@import "tailwindcss";
${hasTokensCss ? '\n/* 引入设计令牌，使 CSS 变量生效 */\n@import "../styles/tokens.css";\n' : ''}
html {
  scroll-behavior: smooth;
}

body {
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
`);

  // .gitignore
  zip.file('.gitignore', `node_modules/\n.next/\nout/\n.env*.local\n.DS_Store\n`);

  // ── Design tokens ─────────────────────────────────────────────
  if (data.designAnalysis) {
    zip.file('design-tokens.json', generateDesignTokensJSON(data));
    zip.file('design-tokens.css', generateDesignTokensCSS(data));
  }

  // ── package.json ──────────────────────────────────────────────
  zip.file('package.json', JSON.stringify({
    name: projectName,
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "next dev --turbopack",
      build: "next build",
      start: "next start",
      export: "next build",
      lint: "next lint",
    },
    dependencies: {
      "next": "^16.0.0",
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "framer-motion": "^12.0.0",
      "lucide-react": "^0.400.0",
    },
    devDependencies: {
      "typescript": "^5.0.0",
      "@types/node": "^22.0.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "tailwindcss": "^4.0.0",
      "@tailwindcss/postcss": "^4.0.0",
    },
  }, null, 2));

  // ── README.md ─────────────────────────────────────────────────
  zip.file('README.md',
`# ${siteTitle}

> 复刻自: ${data.url || '未知'}
> 生成工具: [Code Designer AI](https://codedesignerai.cn)
> 日期: ${new Date().toLocaleDateString('zh-CN')}

## 快速开始

\`\`\`bash
npm install
npm run dev
\`\`\`

浏览器打开 [http://localhost:3000](http://localhost:3000)

## 静态导出

\`\`\`bash
npm run build
\`\`\`

产出 \`out/\` 目录，含 \`index.html\` + 静态资源，可直接部署。

## 技术栈

- Next.js 16 (App Router + Turbopack + Static Export)
- React 19
- TypeScript
- Tailwind CSS v4
- Framer Motion 12 (动画)

## 项目结构

\`\`\`
src/
├── app/
│   ├── layout.tsx      # 根布局
│   ├── page.tsx        # 首页（自动组装所有组件）
│   └── globals.css     # Tailwind v4 + 设计令牌
├── components/
│   └── sections/       # 区块组件
└── styles/
    └── tokens.css      # 设计令牌 CSS 变量
\`\`\`
`);

  // ── COMPONENTS.md — 真实遍历组件生成 ──────────────────────────
  if (componentFiles.length > 0) {
    const tree = componentFiles.map(c => {
      // Extract a brief description from the component code
      const firstComment = c.code.match(/\/\/\s*(.+)/)?.[1] || '';
      const desc = firstComment || `${c.name} 组件`;
      return `├── ${c.name}  — ${desc}`;
    });
    zip.file('COMPONENTS.md',
`# Component Tree

App (page)
${tree.join('\n')}

Total components: ${componentFiles.length}
`);
  }

  // ── AI prompts ────────────────────────────────────────────────
  zip.file('prompts/cursor-prompt.md', generateAIPrompt(data, 'cursor'));
  zip.file('prompts/claude-prompt.md', generateAIPrompt(data, 'claude'));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// =====================================================================
// HTML Report Export — Printable formatted report (PDF alternative)
// =====================================================================

export function generateHTMLReport(data: ExportData, title: string): string {
  const analysis = data.designAnalysis;

  let colorRows = '';
  if (analysis?.colors?.length) {
    for (const c of analysis.colors) {
      colorRows += `<tr><td><span style="display:inline-block;width:24px;height:24px;border-radius:4px;background:${c.hex};vertical-align:middle;margin-right:8px;border:1px solid rgba(0,0,0,0.1)"></span>${c.name || 'Unnamed'}</td><td><code>${c.hex}</code></td><td>${c.usage || '—'}</td></tr>`;
    }
  }

  let typoRows = '';
  if (analysis?.typography?.length) {
    for (const t of analysis.typography) {
      typoRows += `<tr><td>${t.name || 'Unnamed'}</td><td>${t.family || '—'}</td><td>${t.weight || '—'}</td><td>${t.size || '—'}</td><td>${t.usage || '—'}</td></tr>`;
    }
  }

  let shadowRows = '';
  if (analysis?.shadows?.length) {
    for (const s of analysis.shadows) {
      shadowRows += `<tr><td>${s.name || 'default'}</td><td><code>${s.value}</code></td><td><div style="width:60px;height:30px;border-radius:6px;background:#fff;box-shadow:${s.value}"></div></td></tr>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1d1d1f; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  h2 { font-size: 20px; font-weight: 600; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
  h3 { font-size: 16px; font-weight: 600; margin: 24px 0 12px; }
  p, li { font-size: 14px; color: #333; }
  .meta { color: #86868b; font-size: 13px; margin-bottom: 32px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; }
  th { text-align: left; padding: 8px 12px; background: #f5f5f7; font-size: 12px; font-weight: 600; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  code { background: #f5f5f7; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: 'SF Mono', Menlo, monospace; }
  .spacing-bar { display: flex; align-items: center; gap: 8px; }
  .spacing-bar div { height: 8px; background: #0071E3; border-radius: 4px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
  .stat-card { background: #f5f5f7; border-radius: 12px; padding: 16px; text-align: center; }
  .stat-value { font-size: 24px; font-weight: 700; color: #0071E3; }
  .stat-label { font-size: 12px; color: #86868b; margin-top: 4px; }
  @media print { body { padding: 20px; } h2 { page-break-after: avoid; } table { page-break-inside: avoid; } }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="meta">Source: ${data.url} · Generated: ${new Date().toLocaleString('zh-CN')} · Code Designer AI</div>

${analysis ? `
<div class="stats">
  <div class="stat-card"><div class="stat-value">${analysis.colors?.length || 0}</div><div class="stat-label">Colors</div></div>
  <div class="stat-card"><div class="stat-value">${analysis.typography?.length || 0}</div><div class="stat-label">Typography</div></div>
  <div class="stat-card"><div class="stat-value">${analysis.spacing?.length || 0}</div><div class="stat-label">Spacing</div></div>
</div>

${colorRows ? `<h2>Color Palette</h2><table><thead><tr><th>Name</th><th>Hex</th><th>Usage</th></tr></thead><tbody>${colorRows}</tbody></table>` : ''}
${typoRows ? `<h2>Typography</h2><table><thead><tr><th>Name</th><th>Family</th><th>Weight</th><th>Size</th><th>Usage</th></tr></thead><tbody>${typoRows}</tbody></table>` : ''}
${analysis.spacing?.length ? `<h2>Spacing Scale</h2><div style="margin:12px 0">${analysis.spacing.map(s => `<div class="spacing-bar"><span style="width:40px;font-size:12px">${s}px</span><div style="width:${Math.min(s * 2, 200)}px"></div></div>`).join('')}</div>` : ''}
${shadowRows ? `<h2>Shadows</h2><table><thead><tr><th>Name</th><th>Value</th><th>Preview</th></tr></thead><tbody>${shadowRows}</tbody></table>` : ''}
${analysis.animations?.length ? `<h2>Animations</h2><table><thead><tr><th>Name</th><th>Property</th><th>Duration</th><th>Easing</th></tr></thead><tbody>${analysis.animations.map(a => `<tr><td>${a.name}</td><td>${a.property}</td><td>${a.duration}</td><td><code>${a.easing}</code></td></tr>`).join('')}</tbody></table>` : ''}
` : '<p>No design analysis data available.</p>'}

${data.qaResult ? `
<h2>Quality Assessment</h2>
<div class="stats">
  <div class="stat-card"><div class="stat-value">${data.qaResult.similarity}%</div><div class="stat-label">Visual Similarity</div></div>
  ${data.qaResult.accessibilityScore !== undefined ? `<div class="stat-card"><div class="stat-value">${data.qaResult.accessibilityScore}</div><div class="stat-label">Accessibility</div></div>` : ''}
  ${data.qaResult.performanceScore !== undefined ? `<div class="stat-card"><div class="stat-value">${data.qaResult.performanceScore}</div><div class="stat-label">Performance</div></div>` : ''}
</div>
${data.qaResult.issues?.length ? `<h3>Issues (${data.qaResult.issues.length})</h3><table><thead><tr><th>Severity</th><th>Type</th><th>Description</th></tr></thead><tbody>${data.qaResult.issues.map(i => `<tr><td><span class="badge" style="background:${i.severity === 'critical' ? '#FFE5E5' : i.severity === 'major' ? '#FFF3E0' : '#F0F0F0'};color:${i.severity === 'critical' ? '#D32F2F' : i.severity === 'major' ? '#E65100' : '#666'}">${i.severity}</span></td><td>${i.type || 'visual'}</td><td>${i.description}</td></tr>`).join('')}</tbody></table>` : ''}
` : ''}

</body>
</html>`;
}

// =====================================================================
// Main dispatch — generate content based on filename extension
// =====================================================================

export async function generateExportContent(filename: string, data: ExportData): Promise<{ content: string | Blob; mimeType: string }> {
  const ext = filename.split('.').pop()?.toLowerCase();

  // ZIP — return Blob directly
  if (ext === 'zip') {
    const blob = await generateProjectZip(data);
    return { content: blob, mimeType: 'application/zip' };
  }

  // HTML — dispatch based on filename
  if (ext === 'html') {
    // Report HTML files — any filename that's NOT the website export
    const isReport = filename.includes('report') || filename.includes('summary') ||
                     filename.includes('analysis') || filename.includes('architecture') ||
                     filename.includes('guide') || filename.includes('docs') ||
                     filename.includes('doc') || filename.includes('style') ||
                     filename.includes('feature');
    if (isReport) {
      const title = filename.includes('design') || filename.includes('analysis') ? 'Design Analysis Report' :
                    filename.includes('summary') ? 'Project Summary' :
                    filename.includes('architecture') ? 'Technical Architecture' :
                    filename.includes('feature') ? 'Feature Analysis Report' :
                    filename.includes('style') || filename.includes('guide') ? 'Design Language Guide' : 'Analysis Report';
      const html = generateHTMLReport(data, title);
      return { content: html, mimeType: 'text/html' };
    }
    // 复刻网站本身的自包含 HTML（含 Tailwind CDN + 内联 CSS）
    const html = data.generatedCode && data.generatedCode.size > 0
      ? buildPreviewHtml(data.generatedCode)
      : '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>暂无可导出的网页</title></head><body style="font-family:sans-serif;padding:40px;text-align:center;color:#888"><p>暂无可导出的网页代码，请先完成生成。</p></body></html>';
    return { content: html, mimeType: 'text/html' };
  }

  // PDF — legacy fallback, generate printable HTML
  if (ext === 'pdf') {
    const title = filename.includes('design') ? 'Design Analysis Report' :
                  filename.includes('architecture') ? 'Technical Architecture' :
                  filename.includes('summary') ? 'Project Summary' :
                  filename.includes('feature') ? 'Feature Analysis Report' :
                  filename.includes('style') ? 'Design Language Guide' : 'Analysis Report';
    const html = generateHTMLReport(data, title);
    return { content: html, mimeType: 'text/html' };
  }

  // JSON
  if (ext === 'json') {
    if (filename.includes('token') && filename.includes('color')) return { content: generateColorRecommendationsJSON(data), mimeType: 'application/json' };
    if (filename.includes('token') && (filename.includes('spacing') || filename.includes('layout'))) return { content: generateLayoutTokensJSON(data), mimeType: 'application/json' };
    if (filename.includes('animation') || filename.includes('motion')) return { content: generateAnimationConfigJSON(data), mimeType: 'application/json' };
    if (filename.includes('style') || filename.includes('design-system')) return { content: generateDesignTokensJSON(data), mimeType: 'application/json' };
    if (filename.includes('color')) return { content: generateColorRecommendationsJSON(data), mimeType: 'application/json' };
    return { content: generateDesignTokensJSON(data), mimeType: 'application/json' };
  }

  // CSS
  if (ext === 'css') {
    return { content: generateDesignTokensCSS(data), mimeType: 'text/css' };
  }

  // MDX
  if (ext === 'mdx') {
    if (filename.includes('component')) return { content: generateComponentDocs(data), mimeType: 'text/plain' };
    if (filename.includes('interaction') || filename.includes('feature')) return { content: generateDesignAnalysisReport(data), mimeType: 'text/plain' };
    if (filename.includes('brand') || filename.includes('style')) return { content: generateDesignAnalysisReport(data), mimeType: 'text/plain' };
    return { content: generateComponentDocs(data), mimeType: 'text/plain' };
  }

  // MD
  if (ext === 'md') {
    if (filename.includes('cursor')) return { content: generateAIPrompt(data, 'cursor'), mimeType: 'text/plain' };
    if (filename.includes('claude')) return { content: generateAIPrompt(data, 'claude'), mimeType: 'text/plain' };
    if (filename.includes('prompt')) return { content: generateAIPrompt(data, 'generic'), mimeType: 'text/plain' };
    if (filename.includes('summary') || filename.includes('report')) return { content: generateProjectSummary(data), mimeType: 'text/plain' };
    if (filename.includes('spacing') || filename.includes('responsive') || filename.includes('layout')) return { content: generateDesignAnalysisReport(data), mimeType: 'text/plain' };
    if (filename.includes('performance') || filename.includes('optimization')) return { content: generateDesignAnalysisReport(data), mimeType: 'text/plain' };
    return { content: generateDesignAnalysisReport(data), mimeType: 'text/plain' };
  }

  // Fallback
  return { content: generateDesignAnalysisReport(data), mimeType: 'text/plain' };
}
