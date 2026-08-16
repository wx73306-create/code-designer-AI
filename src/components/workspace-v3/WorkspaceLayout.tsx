'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code2, Eye, BarChart3, Home, Download, Monitor, Tablet, Smartphone, Sparkles, Loader2, Check, ChevronRight } from 'lucide-react';
import { useAgentStore } from '@/store/agent-store';
import { buildPreviewHtml } from '@/lib/preview-utils';
import DesignReportPanel from './DesignReportPanel';
import LivePreview from './LivePreview';
import CodeEditorPanel from './CodeEditorPanel';
import AIActionBar from './AIActionBar';
import ExportPanel from '@/components/export/ExportPanel';

type ViewDevice = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<ViewDevice, number> = { desktop: 0, tablet: 768, mobile: 390 };

export default function WorkspaceLayout() {
  const task = useAgentStore((s) => s.task);
  const resetTask = useAgentStore((s) => s.resetTask);
  const [device, setDevice] = useState<ViewDevice>('desktop');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<'code' | 'report'>('code');
  const [exportOpen, setExportOpen] = useState(false);

  // Build preview HTML from generated code
  const previewHtml = useMemo(() => {
    if (!task.generatedCode || task.generatedCode.size === 0) return null;
    return buildPreviewHtml(task.generatedCode);
  }, [task.generatedCode]);

  // Get code files as entries
  const codeFiles = useMemo(() => {
    if (!task.generatedCode) return [];
    return [...task.generatedCode.entries()];
  }, [task.generatedCode]);

  // Select first file if none selected
  const activeFile = selectedFile || codeFiles[0]?.[0] || null;
  const activeCode = activeFile ? task.generatedCode?.get(activeFile) || '' : '';

  const handleFileSelect = useCallback((filename: string) => {
    setSelectedFile(filename);
    setRightPanel('code');
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#f5f5f7] overflow-hidden">
      {/* ── Top Toolbar ── */}
      <div className="h-11 shrink-0 flex items-center justify-between px-4 border-b border-black/[0.06] bg-white/90 backdrop-blur-xl z-30">
        <div className="flex items-center gap-3">
          <button onClick={resetTask} className="flex items-center gap-1.5 text-black/40 hover:text-black/60 transition-colors" title="返回首页">
            <Home className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-black/[0.08]" />
          <span className="text-[12px] font-semibold text-[#1d1d1f]">Code Designer AI</span>
          <ChevronRight className="w-3 h-3 text-black/15" />
          <span className="text-[12px] text-black/40">{task.url ? new URL(task.url).hostname.replace('www.', '') : 'Project'}</span>
        </div>

        {/* Device switcher */}
        <div className="flex items-center gap-1">
          {([
            { id: 'desktop' as const, icon: Monitor, label: 'Desktop' },
            { id: 'tablet' as const, icon: Tablet, label: 'Tablet' },
            { id: 'mobile' as const, icon: Smartphone, label: 'Mobile' },
          ]).map(d => (
            <button
              key={d.id}
              onClick={() => setDevice(d.id)}
              className={`p-1.5 rounded-md transition-colors ${
                device === d.id ? 'bg-black/[0.06] text-black/70' : 'text-black/25 hover:text-black/40'
              }`}
              title={d.label}
            >
              <d.icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            task.mode === 'enhancement'
              ? 'bg-[#0071E3]/10 text-[#0071E3]'
              : 'bg-black/[0.04] text-black/35'
          }`}>
            {task.mode === 'enhancement' ? 'Design Evolution' : 'Pixel Copy'}
          </span>
          <button onClick={() => setExportOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-black/50 hover:text-black/70 hover:bg-black/[0.03] transition-colors">
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>

      {/* ── Main Content: Three Columns ── */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel: Design Report */}
        <div className="w-[280px] shrink-0 border-r border-black/[0.06] bg-white/50 overflow-y-auto hidden lg:block">
          <DesignReportPanel />
        </div>

        {/* Center Panel: Live Preview */}
        <div className="flex-1 min-w-0 flex flex-col">
          <LivePreview
            html={previewHtml}
            device={device}
            deviceWidth={DEVICE_WIDTHS[device]}
          />
        </div>

        {/* Right Panel: Code Editor */}
        <div className="w-[360px] shrink-0 border-l border-black/[0.06] bg-[#1e1e1e] hidden md:flex flex-col">
          <CodeEditorPanel
            files={codeFiles}
            activeFile={activeFile}
            activeCode={activeCode}
            onFileSelect={handleFileSelect}
          />
        </div>
      </div>

      {/* ── Bottom: AI Action Bar ── */}
      <AIActionBar />

      {/* ── Export Panel Modal ── */}
      <ExportPanel isOpen={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
