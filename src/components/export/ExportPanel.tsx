'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Check, Loader2, FileText, Package, Globe, Code2, ArrowRight } from 'lucide-react';
import { EXPORT_FORMATS, type ExportFormat, type ExportFormatInfo } from '@/types/export';
import { useAgentStore } from '@/store/agent-store';

interface ExportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
}

export default function ExportPanel({ isOpen, onClose, projectName = 'my-project' }: ExportPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('nextjs');
  const [exporting, setExporting] = useState(false);
  const [exportStep, setExportStep] = useState(0);
  const [complete, setComplete] = useState(false);

  const steps = [
    'Organizing Components',
    'Optimizing Assets',
    'Generating Files',
    'Creating Package',
  ];

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportStep(0);
    setComplete(false);

    // Progress animation
    for (let i = 0; i < steps.length; i++) {
      setExportStep(i);
      await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));
    }

    try {
      // Get current code files from store
      const task = useAgentStore.getState().task;
      const files = task.generatedCode ? [...task.generatedCode.entries()] : [];

      if (files.length === 0) {
        setExporting(false);
        return;
      }

      // Map export format to API format
      const formatMap: Record<string, string> = {
        'html': 'html',
        'react': 'react',
        'nextjs': 'nextjs',
        'full-project': 'full-project',
      };

      const res = await fetch('/api/export-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: formatMap[selectedFormat] || 'nextjs',
          projectName: projectName,
          files,
        }),
      });

      if (!res.ok) throw new Error(`Export failed: ${res.status}`);

      // Download the ZIP file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setComplete(true);
    } catch (err) {
      console.error('[ExportPanel] Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [selectedFormat, projectName]);

  const selectedInfo = EXPORT_FORMATS.find(f => f.id === selectedFormat);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] mx-auto max-w-[560px] rounded-t-3xl bg-white/98 backdrop-blur-2xl border-t border-x border-black/[0.08] shadow-[0_-8px_40px_rgba(0,0,0,0.1)] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.04]">
              <div>
                <h2 className="text-[20px] font-semibold text-[#1d1d1f]">Export Project</h2>
                <p className="text-[12px] text-black/30 mt-0.5">选择导出格式，下载完整项目</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/[0.04] flex items-center justify-center text-black/30 hover:text-black/50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Format selector */}
            <div className="p-6">
              <div className="text-[11px] font-medium text-black/35 uppercase tracking-wider mb-3">Choose Format</div>
              <div className="space-y-2">
                {EXPORT_FORMATS.map(fmt => {
                  const isSelected = selectedFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      onClick={() => !exporting && setSelectedFormat(fmt.id)}
                      disabled={exporting}
                      className={`relative w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                        isSelected
                          ? 'border-transparent bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]'
                          : 'border-black/[0.04] bg-black/[0.01] hover:bg-black/[0.02] hover:border-black/[0.08]'
                      } ${exporting ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="export-selected"
                          className="absolute inset-0 rounded-xl border-2 pointer-events-none"
                          style={{ borderColor: fmt.color }}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                      )}

                      <div className="flex items-start gap-3">
                        <span className="text-xl mt-0.5">{fmt.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-semibold text-[#1d1d1f]">{fmt.title}</span>
                            {fmt.recommended && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759] font-medium">Recommended</span>
                            )}
                          </div>
                          <span className="text-[11px] font-medium" style={{ color: fmt.color }}>{fmt.subtitle}</span>
                          <p className="text-[11px] text-black/30 mt-1">{fmt.description}</p>
                          {/* File structure preview */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {fmt.fileStructure.map(f => (
                              <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-black/[0.03] text-black/25 font-mono">{f}</span>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isSelected ? (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                              className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: fmt.color }}>
                              <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            </motion.div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-black/[0.1]" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Export progress */}
            {exporting && (
              <div className="px-6 pb-4">
                <div className="p-4 rounded-xl bg-black/[0.02] border border-black/[0.04]">
                  <div className="flex items-center gap-2 mb-3">
                    <Loader2 className="w-4 h-4 text-[#0071E3] animate-spin" />
                    <span className="text-[12px] font-medium text-[#1d1d1f]">Preparing Export...</span>
                  </div>
                  <div className="space-y-1.5">
                    {steps.map((step, i) => (
                      <div key={step} className="flex items-center gap-2 text-[11px]">
                        {i < exportStep ? (
                          <Check className="w-3 h-3 text-[#34C759]" />
                        ) : i === exportStep ? (
                          <Loader2 className="w-3 h-3 text-[#0071E3] animate-spin" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-black/[0.08]" />
                        )}
                        <span className={i <= exportStep ? 'text-black/50' : 'text-black/20'}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Complete state */}
            {complete && (
              <div className="px-6 pb-4">
                <div className="p-4 rounded-xl bg-[#34C759]/[0.04] border border-[#34C759]/10 text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                    className="w-10 h-10 rounded-full bg-[#34C759]/10 flex items-center justify-center mx-auto mb-2">
                    <Check className="w-5 h-5 text-[#34C759]" strokeWidth={2.5} />
                  </motion.div>
                  <div className="text-[14px] font-semibold text-[#1d1d1f]">Export Complete</div>
                  <div className="text-[11px] text-black/30 mt-1">{selectedInfo?.title} — 下载已开始</div>
                </div>
              </div>
            )}

            {/* Export button */}
            <div className="px-6 pb-6">
              <button
                onClick={handleExport}
                disabled={exporting}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold transition-all duration-300 ${
                  exporting
                    ? 'bg-black/[0.04] text-black/25 cursor-not-allowed'
                    : 'bg-[#1d1d1f] text-white shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-black active:scale-[0.98]'
                }`}
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : complete ? (
                  <>
                    <Download className="w-4 h-4" />
                    Download Again
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Generate Export
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
