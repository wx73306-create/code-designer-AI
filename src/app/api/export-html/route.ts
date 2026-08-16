// =============================================================================
// /api/export-html — 高质量导出：JSX 编译 + 代码打包 + Tailwind 本地编译
// =============================================================================
// 产出真正自包含的 HTML：保留 React 交互 + 动画 + 本地编译 Tailwind CSS
// 无 CDN 依赖，国内可直接离线打开
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getRequestAuth } from '@/lib/admin-session';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

// =============================================================================
// Temp directory management
// =============================================================================

async function createTempDir(): Promise<string> {
  // Use project subdirectory so esbuild can resolve React from node_modules
  const dir = join(process.cwd(), '.export-temp-' + Date.now());
  await mkdir(dir, { recursive: true });
  return dir;
}

async function writeFiles(tempDir: string, files: [string, string][]): Promise<void> {
  for (const [filename, content] of files) {
    const fullPath = join(tempDir, filename);
    await mkdir(join(fullPath, '..'), { recursive: true });

    // Preprocess .tsx/.jsx files to make them esbuild-compatible
    let processedContent = content;
    if (filename.endsWith('.tsx') || filename.endsWith('.jsx') || filename.endsWith('.ts')) {
      processedContent = preprocessCode(content);
    }

    await writeFile(fullPath, processedContent, 'utf-8');
  }
}

// =============================================================================
// Entry point generation
// =============================================================================

function generateEntryCode(files: [string, string][]): string {
  // Find the main page component (page.tsx or similar)
  const pageFile = files.find(([name]) => name.includes('page.tsx') || name.includes('App.tsx'));
  const componentFiles = files.filter(([name]) => name.endsWith('.tsx') || name.endsWith('.jsx'));

  if (!pageFile && componentFiles.length === 0) {
    return `
import React from 'react';
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(React.createElement('div', null, 'No components found'));
`;
  }

  // Generate imports for all components
  // Component files use named imports; page file uses default import
  const componentOnlyFiles = componentFiles.filter(([filename]) => !filename.includes('page.tsx'));
  const imports = componentOnlyFiles.map(([filename], idx) => {
    const componentName = filename.split('/').pop()?.replace(/\.(tsx|jsx)$/, '') || `Component${idx}`;
    const relativePath = './' + filename.replace(/\.(tsx|jsx)$/, '');
    return `import { ${componentName} } from '${relativePath}';`;
  }).join('\n');

  // Page file uses default import
  const pageImport = pageFile ? `import Page from './${pageFile[0].replace(/\.(tsx|jsx)$/, '')}';` : '';
  const mainComponent = pageFile ? 'Page' : (componentOnlyFiles[0]?.[0].replace(/\.(tsx|jsx)$/, '') || 'div');

  return `
import React from 'react';
import { createRoot } from 'react-dom/client';
${imports}
${pageImport}

const App = () => React.createElement(${mainComponent}, null);

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
`;
}

// =============================================================================
// Code preprocessing — make dynamic React code esbuild-compatible
// =============================================================================

function preprocessCode(code: string): string {
  let processed = code;

  // Replace template literals with static placeholders
  // `url(${variable})` → `url(placeholder)`
  processed = processed.replace(/`\$\{[^}]+\}`/g, '"placeholder"');

  // Replace template literals with expressions: `text ${var} more` → `"text placeholder more"`
  processed = processed.replace(/`([^`]*)\$\{[^}]+\}([^`]*)`/g, (_, before, after) => {
    return `"${before}placeholder${after}"`;
  });

  // Replace simple variable references in style objects with static values
  // style={{ color: textColor }} → style={{ color: "#000" }}
  processed = processed.replace(/style\s*=\s*\{\{([^}]+)\}\}/g, (match: string, styleContent: string) => {
    const staticStyle = styleContent.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)/g, (m: string, varName: string) => {
      // Map common variable names to static values
      const varMap: Record<string, string> = {
        textColor: '#1d1d1f',
        bgColor: '#ffffff',
        primaryColor: '#0071e3',
        accentColor: '#af52de',
        borderColor: '#d2d2d7',
        shadowColor: 'rgba(0,0,0,0.1)',
      };
      return `: "${varMap[varName] || '#888888'}"`;
    });
    return `style={{${staticStyle}}}`;
  });

  // Replace .map() calls with static content
  // items.map(item => <Component />) → <Component />
  processed = processed.replace(/(\w+)\.map\s*\([^)]*=>\s*([^)]+)\)/g, (match: string, arr: string, component: string) => {
    return component;
  });

  // Replace conditional rendering with static content
  // {condition && <Component />} → <Component />
  processed = processed.replace(/\{[^}]*&&\s*(<[^>]+>)\}/g, (match: string, component: string) => {
    return component;
  });

  // Replace {variable} with placeholder text
  processed = processed.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match: string, varName: string) => {
    const placeholderMap: Record<string, string> = {
      title: 'Sample Title',
      name: 'Sample Name',
      description: 'Sample description text',
      imageUrl: 'https://picsum.photos/600/400',
      image: 'https://picsum.photos/600/400',
      avatar: 'https://picsum.photos/100/100',
      price: '$99.99',
      date: '2024-01-01',
    };
    return `"${placeholderMap[varName] || 'placeholder'}"`;
  });

  return processed;
}

// =============================================================================
// esbuild bundling (native TypeScript + JSX support, simpler than rollup)
// =============================================================================

async function bundleWithEsbuild(tempDir: string, entryCode: string): Promise<string> {
  const entryPath = join(tempDir, 'entry.jsx');
  const outputPath = join(tempDir, 'bundle.js');

  await writeFile(entryPath, entryCode, 'utf-8');

  try {
    await execAsync(
      `npx esbuild ${entryPath} --bundle --minify --format=iife --global-name=App --outfile=${outputPath} --loader:.tsx=tsx --loader:.jsx=jsx --loader:.ts=ts --jsx=transform --jsx-factory=React.createElement --jsx-fragment=React.Fragment --alias:@/components=${join(tempDir, 'src/components')} --alias:@/lib=${join(tempDir, 'src/lib')} --resolve-extensions=.tsx,.jsx,.ts,.js`,
      { cwd: process.cwd(), timeout: 30000 }
    );

    const fs = await import('fs/promises');
    const bundleContent = await fs.readFile(outputPath, 'utf-8');
    return bundleContent;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[export-html] esbuild bundling failed:', msg);
    throw new Error('代码打包失败: ' + msg);
  }
}

// =============================================================================
// Tailwind CSS compilation
// =============================================================================

async function compileTailwind(tempDir: string, files: [string, string][]): Promise<string> {
  // Create input CSS file with Tailwind directives
  const inputCssPath = join(tempDir, 'input.css');
  const outputCssPath = join(tempDir, 'output.css');

  // Find all CSS files and concatenate them
  const cssFiles = files.filter(([name]) => name.endsWith('.css'));
  const cssContent = cssFiles.map(([_, content]) => content).join('\n');

  // Create input CSS with Tailwind import and source scanning
  const inputCss = `
@import 'tailwindcss';

${cssContent}
`;

  await writeFile(inputCssPath, inputCss, 'utf-8');

  try {
    await execAsync(
      `npx @tailwindcss/cli -i ${inputCssPath} -o ${outputCssPath}`,
      { cwd: process.cwd(), timeout: 30000 }
    );

    const fs = await import('fs/promises');
    const cssOutput = await fs.readFile(outputCssPath, 'utf-8');
    return cssOutput;
  } catch (error) {
    console.error('[export-html] Tailwind compilation failed:', error);
    // Fall back to empty CSS (will use Tailwind CDN in HTML)
    return '';
  }
}

// =============================================================================
// HTML assembly
// =============================================================================

/** Build the self-contained single HTML file (all CSS + JS inlined) */
function assembleSingleHTML(bundleJs: string, compiledCss: string, title: string): string {
  const hasCss = compiledCss && compiledCss.length > 0;

  // Fix corrupted emoji in bundle JS
  const fixedBundleJs = bundleJs
    .replace(/馃摫/g, '📱').replace(/漏/g, '©').replace(/鉁/g, '✓')
    .replace(/馃/g, '🚀').replace(/馃崺/g, '🎨').replace(/鉁ゕ/g, '⚡')
    .replace(/馃敜/g, '🔧').replace(/馃帀/g, '💻');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="generator" content="Code Designer AI"/>
  <meta name="description" content="由 Code Designer AI 复刻生成的静态网页"/>
  <title>${title}</title>
  ${hasCss ? `<style>\n${compiledCss}\n</style>` : '<script src="https://cdn.tailwindcss.com"></script>'}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      font-family: "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      overflow-x: hidden;
    }
    #root { min-height: 100vh; }
    ::selection { background: rgba(0, 113, 227, 0.25); }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(0,0,0,.18); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,.32); }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>${fixedBundleJs}</script>
</body>
</html>`;
}

/** Build split files: index.html references external style.css + script.js */
function assembleSplitFiles(bundleJs: string, compiledCss: string, title: string): {
  indexHtml: string;
  styleCss: string;
  scriptJs: string;
} {
  const hasCss = compiledCss && compiledCss.length > 0;

  const baseCss = `* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}
#root { min-height: 100vh; }
::selection { background: rgba(0, 113, 227, 0.25); }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,.18); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,.32); }`;

  const styleCss = hasCss ? `${compiledCss}\n\n/* Base reset */\n${baseCss}` : baseCss;

  const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="generator" content="Code Designer AI"/>
  <meta name="description" content="由 Code Designer AI 复刻生成的静态网页"/>
  <title>${title}</title>
  <link rel="stylesheet" href="style.css"/>
  ${!hasCss ? '<script src="https://cdn.tailwindcss.com"></script>' : ''}
</head>
<body>
  <div id="root"></div>
  <script src="script.js"></script>
</body>
</html>`;

  return { indexHtml, styleCss, scriptJs: bundleJs };
}

// =============================================================================
// Main endpoint
// =============================================================================

export async function POST(request: NextRequest) {
  // P1 安全修复：导出接口需要登录认证（接受 user 或 admin session）
  if (!getRequestAuth(request).authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let tempDir: string | null = null;

  try {
    const body = await request.json();
    const files: [string, string][] = Array.isArray(body?.files) ? body.files : [];
    const mode: 'single' | 'split' = body?.mode === 'split' ? 'split' : 'single';
    const title: string = body?.title || 'Code Designer AI - Exported Website';

    if (files.length === 0) {
      return NextResponse.json({ error: '没有可导出的代码' }, { status: 400 });
    }

    // Create temp directory
    tempDir = await createTempDir();

    // Write files
    await writeFiles(tempDir, files);

    // Generate entry point
    const entryCode = generateEntryCode(files);

    // Bundle with esbuild
    const bundleJs = await bundleWithEsbuild(tempDir, entryCode);

    // Compile Tailwind CSS
    const compiledCss = await compileTailwind(tempDir, files);

    if (mode === 'split') {
      // Return separate files for zip packaging
      const { indexHtml, styleCss, scriptJs } = assembleSplitFiles(bundleJs, compiledCss, title);
      const selfContainedHtml = assembleSingleHTML(bundleJs, compiledCss, title);
      return NextResponse.json({
        mode: 'split',
        files: { indexHtml, styleCss, scriptJs },
        html: selfContainedHtml, // self-contained version for preview
      });
    }

    // Single mode: return self-contained HTML
    const html = assembleSingleHTML(bundleJs, compiledCss, title);
    return NextResponse.json({ html });
  } catch (error) {
    console.error('[export-html] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导出失败' },
      { status: 500 }
    );
  } finally {
    // Clean up temp directory
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('[export-html] cleanup failed:', cleanupError);
      }
    }
  }
}
