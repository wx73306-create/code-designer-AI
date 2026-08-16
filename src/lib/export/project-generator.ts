// =============================================================================
// Project Generator — converts generated code into React/Next.js project structure
// =============================================================================

import type { ExportFormat } from '@/types/export';

interface ProjectFile {
  path: string;
  content: string;
}

interface GeneratedCodeEntry {
  filename: string;
  code: string;
}

/**
 * Generate a complete project file list from AI-generated code
 */
export function generateProjectFiles(
  format: ExportFormat,
  codeEntries: GeneratedCodeEntry[],
  projectName: string = 'my-project',
): ProjectFile[] {
  switch (format) {
    case 'html':
      return generateHtmlProject(codeEntries);
    case 'react':
      return generateReactProject(codeEntries, projectName);
    case 'nextjs':
      return generateNextProject(codeEntries, projectName);
    case 'full-project':
      return generateFullProject(codeEntries, projectName);
    default:
      return generateHtmlProject(codeEntries);
  }
}

// ── HTML Project ──
function generateHtmlProject(entries: GeneratedCodeEntry[]): ProjectFile[] {
  // Already handled by export-html endpoint
  return entries.map(e => ({ path: e.filename, content: e.code }));
}

// ── React Project ──
function generateReactProject(entries: GeneratedCodeEntry[], name: string): ProjectFile[] {
  const files: ProjectFile[] = [];

  // package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify({
      name,
      version: '1.0.0',
      private: true,
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', 'framer-motion': '^10.16.0', 'lucide-react': '^0.263.0' },
      devDependencies: { '@vitejs/plugin-react': '^4.0.0', vite: '^5.0.0', tailwindcss: '^3.3.0', postcss: '^8.4.0', autoprefixer: '^10.4.0' },
    }, null, 2),
  });

  // vite.config.js
  files.push({
    path: 'vite.config.js',
    content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n`,
  });

  // tailwind.config.js
  files.push({
    path: 'tailwind.config.js',
    content: `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ['./index.html', './src/**/*.{js,jsx}'],\n  theme: { extend: {} },\n  plugins: [],\n}\n`,
  });

  // postcss.config.js
  files.push({
    path: 'postcss.config.js',
    content: `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n}\n`,
  });

  // index.html
  files.push({
    path: 'index.html',
    content: `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${name}</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.jsx"></script>\n</body>\n</html>\n`,
  });

  // src/main.jsx
  const componentImports = entries
    .filter(e => !e.filename.includes('page'))
    .map(e => {
      const name = e.filename.replace(/\.(tsx|jsx|ts|js)$/, '');
      return `import ${name} from './components/${name}'`;
    }).join('\n');

  const pageEntry = entries.find(e => e.filename.includes('page'));

  files.push({
    path: 'src/main.jsx',
    content: `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n)\n`,
  });

  // src/index.css
  files.push({
    path: 'src/index.css',
    content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }\n`,
  });

  // src/App.jsx
  const componentNames = entries
    .filter(e => !e.filename.includes('page'))
    .map(e => e.filename.replace(/\.(tsx|jsx|ts|js)$/, ''));

  files.push({
    path: 'src/App.jsx',
    content: `${componentImports}\n\nexport default function App() {\n  return (\n    <main>\n${componentNames.map(n => `      <${n} />`).join('\n')}\n    </main>\n  )\n}\n`,
  });

  // Component files
  for (const entry of entries) {
    if (entry.filename.includes('page')) continue;
    const name = entry.filename.replace(/\.(tsx|jsx|ts|js)$/, '');
    files.push({
      path: `src/components/${name}.jsx`,
      content: convertToJsx(entry.code),
    });
  }

  // README
  files.push({
    path: 'README.md',
    content: generateReadme(name, 'React + Vite + TailwindCSS'),
  });

  return files;
}

// ── Next.js Project ──
function generateNextProject(entries: GeneratedCodeEntry[], name: string): ProjectFile[] {
  const files: ProjectFile[] = [];

  // package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify({
      name,
      version: '1.0.0',
      private: true,
      scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' },
      dependencies: { next: '14.2.0', react: '^18.2.0', 'react-dom': '^18.2.0', 'framer-motion': '^10.16.0', 'lucide-react': '^0.263.0' },
      devDependencies: { typescript: '^5.0.0', '@types/react': '^18.0.0', '@types/node': '^20.0.0', tailwindcss: '^3.3.0', postcss: '^8.4.0', autoprefixer: '^10.4.0' },
    }, null, 2),
  });

  // tsconfig.json
  files.push({
    path: 'tsconfig.json',
    content: JSON.stringify({
      compilerOptions: { target: 'es5', lib: ['dom', 'es2017'], jsx: 'preserve', module: 'esnext', moduleResolution: 'bundler', strict: true, esModuleInterop: true, paths: { '@/*': ['./src/*'] } },
      include: ['src/**/*.ts', 'src/**/*.tsx'],
    }, null, 2),
  });

  // next.config.js
  files.push({
    path: 'next.config.js',
    content: `/** @type {import('next').NextConfig} */\nconst nextConfig = {}\nmodule.exports = nextConfig\n`,
  });

  // tailwind.config.ts
  files.push({
    path: 'tailwind.config.ts',
    content: `import type { Config } from 'tailwindcss'\n\nconst config: Config = {\n  content: ['./src/**/*.{ts,tsx}'],\n  theme: { extend: {} },\n  plugins: [],\n}\nexport default config\n`,
  });

  // src/app/layout.tsx
  files.push({
    path: 'src/app/layout.tsx',
    content: `import type { Metadata } from 'next'\nimport './globals.css'\n\nexport const metadata: Metadata = {\n  title: '${name}',\n  description: 'Generated by Code Designer AI',\n}\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="zh-CN">\n      <body>{children}</body>\n    </html>\n  )\n}\n`,
  });

  // src/app/globals.css
  files.push({
    path: 'src/app/globals.css',
    content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }\n`,
  });

  // src/app/page.tsx
  const componentNames = entries
    .filter(e => !e.filename.includes('page'))
    .map(e => e.filename.replace(/\.(tsx|jsx|ts|js)$/, ''));

  const imports = componentNames.map(n => `import ${n} from '@/components/${n}'`).join('\n');

  files.push({
    path: 'src/app/page.tsx',
    content: `${imports}\n\nexport default function Page() {\n  return (\n    <main>\n${componentNames.map(n => `      <${n} />`).join('\n')}\n    </main>\n  )\n}\n`,
  });

  // Component files
  for (const entry of entries) {
    if (entry.filename.includes('page')) continue;
    const name = entry.filename.replace(/\.(tsx|jsx|ts|js)$/, '');
    files.push({
      path: `src/components/${name}.tsx`,
      content: convertToTsx(entry.code),
    });
  }

  // README
  files.push({
    path: 'README.md',
    content: generateReadme(name, 'Next.js 14 + TypeScript + TailwindCSS'),
  });

  return files;
}

// ── Full Project (Next.js + extra assets) ──
function generateFullProject(entries: GeneratedCodeEntry[], name: string): ProjectFile[] {
  const base = generateNextProject(entries, name);

  // Add extra directories
  base.push({ path: 'public/.gitkeep', content: '' });
  base.push({ path: 'assets/images/.gitkeep', content: '' });
  base.push({ path: 'assets/icons/.gitkeep', content: '' });

  return base;
}

// ── Helpers ──

function convertToJsx(code: string): string {
  // Basic TypeScript → JSX conversion (strip type annotations)
  return code
    .replace(/:\s*\w+(\[\])?(\s*[,)=])/g, '$2')
    .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
    .replace(/type\s+\w+\s*=\s*[^;]+;/g, '')
    .replace(/<\w+>/g, ''); // Remove generic type params
}

function convertToTsx(code: string): string {
  // Keep TypeScript syntax, just ensure 'use client' directive
  if (!code.includes("'use client'") && !code.includes('"use client"')) {
    return `'use client';\n\n${code}`;
  }
  return code;
}

function generateReadme(name: string, stack: string): string {
  return `# ${name}\n\nGenerated by [Code Designer AI](https://codedesigner.ai)\n\n## Tech Stack\n\n${stack}\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Build\n\n\`\`\`bash\nnpm run build\n\`\`\`\n\n## Project Structure\n\nGenerated with AI-powered design analysis. Each component is extracted from the original website's visual structure.\n\n## License\n\nThis project was auto-generated. Please respect the original website's terms of use.\n`;
}
