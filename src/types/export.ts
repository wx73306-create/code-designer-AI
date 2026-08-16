// =============================================================================
// Export System Types — 4 export formats: HTML, React, Next.js, Full Project
// =============================================================================

export type ExportFormat = 'html' | 'react' | 'nextjs' | 'full-project';

export interface ExportConfig {
  format: ExportFormat;
  projectName: string;
  includeAssets: boolean;
  includeReadme: boolean;
  designMode: 'pixel-copy' | 'design-evolution';
}

export interface ExportFormatInfo {
  id: ExportFormat;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  fileStructure: string[];
  color: string;
  recommended?: boolean;
}

export interface ExportProgress {
  status: 'idle' | 'preparing' | 'generating' | 'packaging' | 'complete' | 'error';
  step: number;
  totalSteps: number;
  message: string;
  downloadUrl?: string;
  fileSize?: string;
}

export const EXPORT_FORMATS: ExportFormatInfo[] = [
  {
    id: 'html',
    title: 'Web Export',
    subtitle: 'HTML + CSS + JS',
    description: '自包含静态网页，双击 index.html 即可在浏览器中打开。适合展示和学习。',
    icon: '🌐',
    fileStructure: ['index.html', 'style.css', 'script.js'],
    color: '#0071E3',
  },
  {
    id: 'react',
    title: 'React Project',
    subtitle: 'React + Tailwind',
    description: '组件化 React 项目，可直接 npm install 并继续开发。适合前端工程师。',
    icon: '⚛️',
    fileStructure: ['src/App.jsx', 'src/components/', 'package.json', 'tailwind.config.js'],
    color: '#5856D6',
  },
  {
    id: 'nextjs',
    title: 'Next.js Project',
    subtitle: 'Production Ready',
    description: '完整 Next.js 生产项目，含 App Router、TypeScript、Tailwind。适合商业部署。',
    icon: '▲',
    fileStructure: ['src/app/page.tsx', 'src/components/', 'package.json', 'tailwind.config.ts'],
    color: '#1d1d1f',
    recommended: true,
  },
  {
    id: 'full-project',
    title: 'Full Project ZIP',
    subtitle: '完整项目资产',
    description: '包含所有源码、配置、资源和 README 的完整项目压缩包。',
    icon: '📦',
    fileStructure: ['package.json', 'src/', 'components/', 'assets/', 'public/', 'README.md'],
    color: '#FF9500',
  },
];
