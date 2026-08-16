"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Code2,
  Monitor,
  Smartphone,
  FileCode2,
  Files,
  Hash,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";
import { mockGeneratedCode, mockCodeValidation } from "@/lib/mock-data";
import { useAgentStore } from "@/store/agent-store";
import { buildPreviewHtml } from "@/lib/preview-utils";

// =============================================================================
// Code Section — IDE-style code view with live preview
// =============================================================================

export function CodeSection() {
  const fileEntries = useMemo(
    () => Array.from(mockGeneratedCode.entries()),
    []
  );

  const [activeFile, setActiveFile] = useState(fileEntries[0]?.[0] ?? "");
  const [deviceView, setDeviceView] = useState<"desktop" | "mobile">("desktop");

  const activeCode = mockGeneratedCode.get(activeFile) ?? "";

  // Stats
  const totalFiles = fileEntries.length;
  const totalLines = useMemo(
    () =>
      fileEntries.reduce((sum, [, code]) => sum + code.split("\n").length, 0),
    [fileEntries]
  );

  return (
    <motion.section
      id="code"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full py-24 px-4"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#34C759]/10 border border-[#34C759]/20 mb-4">
            <Code2 className="w-3.5 h-3.5 text-[#34C759]" />
            <span className="text-xs font-medium text-[#34C759]">
              Code Agent
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight bg-gradient-to-r from-[#1d1d1f] to-black/70 bg-clip-text text-transparent">
            {"代码生成与预览"}
          </h2>
          <p className="mt-3 text-base text-black/50 max-w-xl mx-auto">
            {
              "AI 自动生成的完整 React 代码，包含所有组件、页面和配置文件"
            }
          </p>
        </motion.div>

        {/* IDE-style layout */}
        <GlassCard className="overflow-hidden" animate delay={0.2}>
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[600px]">
            {/* Left: Code editor */}
            <div className="flex flex-col border-r border-black/[0.06]">
              {/* File tabs */}
              <div className="flex items-center gap-0 overflow-x-auto hide-scrollbar border-b border-black/[0.06] bg-black/[0.02]">
                {fileEntries.map(([filename]) => {
                  const isActive = filename === activeFile;
                  return (
                    <button
                      key={filename}
                      onClick={() => setActiveFile(filename)}
                      className={cn(
                        "relative flex items-center gap-1.5 px-4 py-3 text-[12px] font-mono whitespace-nowrap transition-colors duration-150",
                        "border-r border-black/[0.04] shrink-0",
                        isActive
                          ? "text-black/90 bg-white border-b border-b-transparent"
                          : "text-black/40 hover:text-black/60 hover:bg-black/[0.03]"
                      )}
                    >
                      <FileCode2
                        className={cn(
                          "w-3 h-3 shrink-0",
                          isActive ? "text-blue-600" : "text-black/25"
                        )}
                      />
                      {filename}
                      {/* Active indicator line */}
                      {isActive && (
                        <motion.div
                          layoutId="activeFileIndicator"
                          className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0071E3]"
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Code display */}
              <div className="flex-1 overflow-auto">
                <CodeBlock
                  code={activeCode}
                  language={
                    activeFile.endsWith(".tsx")
                      ? "tsx"
                      : activeFile.endsWith(".ts")
                        ? "ts"
                        : activeFile.endsWith(".css")
                          ? "css"
                          : "tsx"
                  }
                  filename={activeFile}
                  isActive={true}
                  className="rounded-none border-0 h-full"
                />
              </div>
            </div>

            {/* Right: Preview area */}
            <div className="flex flex-col bg-[#f5f5f7]/50">
              {/* Preview header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.06] bg-black/[0.02]">
                <span className="text-xs font-medium text-black/50">
                  {"实时预览"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDeviceView("desktop")}
                    className={cn(
                      "p-1.5 rounded-md transition-colors duration-150",
                      deviceView === "desktop"
                        ? "text-black/80 bg-black/[0.08]"
                        : "text-black/30 hover:text-black/50"
                    )}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeviceView("mobile")}
                    className={cn(
                      "p-1.5 rounded-md transition-colors duration-150",
                      deviceView === "mobile"
                        ? "text-black/80 bg-black/[0.08]"
                        : "text-black/30 hover:text-black/50"
                    )}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Preview content */}
              <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
                <div
                  className={cn(
                    "relative w-full h-full rounded-xl overflow-hidden border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)]",
                    deviceView === "mobile" ? "max-w-[320px]" : "max-w-full"
                  )}
                >
                  {/* Mock preview: Apple website preview placeholder */}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#f5f5f7] via-[#f0f0f2] to-[#f5f5f7]">
                    {/* Mock navbar */}
                    <div className="h-8 bg-black/80 border-b border-black/[0.08] flex items-center justify-center gap-6 px-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-1.5 w-8 rounded-full bg-white/10"
                        />
                      ))}
                    </div>

                    {/* Mock hero */}
                    <div className="flex flex-col items-center pt-12 px-4">
                      <div className="h-5 w-48 rounded-full bg-white/20 mb-2" />
                      <div className="h-3 w-64 rounded-full bg-white/10 mb-4" />
                      <div className="flex gap-4 mb-8">
                        <div className="h-2.5 w-16 rounded-full bg-[#0071E3]/40" />
                        <div className="h-2.5 w-16 rounded-full bg-[#0071E3]/40" />
                      </div>
                      <div className="w-full max-w-sm h-40 rounded-2xl bg-gradient-to-b from-black/[0.08] to-black/[0.02] border border-black/[0.06]" />
                    </div>

                    {/* Mock grid */}
                    <div className="grid grid-cols-2 gap-2 p-3 mt-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-24 rounded-xl border border-black/[0.06]",
                            i % 2 === 0 ? "bg-black" : "bg-[#F5F5F7]/5"
                          )}
                        />
                      ))}
                    </div>

                    {/* URL bar overlay */}
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/70 backdrop-blur-md border border-black/[0.10]">
                        <div className="w-2 h-2 rounded-full bg-[#34C759]" />
                        <span className="text-[10px] text-black/50 font-mono truncate">
                          apple-clone-ai.vercel.app
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-8"
        >
          <div className="flex items-center gap-2 text-black/30">
            <Files className="w-3.5 h-3.5 text-blue-600/60" />
            <span className="text-xs">
              <span className="text-black/60 font-medium">{totalFiles}</span>{" "}
              {"个文件"}
            </span>
          </div>
          <div className="w-px h-3 bg-black/[0.08]" />
          <div className="flex items-center gap-2 text-black/30">
            <Hash className="w-3.5 h-3.5 text-emerald-400/60" />
            <span className="text-xs">
              <span className="text-black/60 font-medium">
                {totalLines.toLocaleString()}
              </span>{" "}
              {"行代码"}
            </span>
          </div>
          <div className="w-px h-3 bg-black/[0.08]" />
          <div className="flex items-center gap-2 text-black/30">
            <Code2 className="w-3.5 h-3.5 text-purple-600/60" />
            <span className="text-xs">
              <span className="text-black/60 font-medium">React 19</span>{" "}
              + TypeScript
            </span>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

// =============================================================================
// Content version for workspace tab — reads from store, uses iframe preview
export function CodeContent() {
  const storeCode = useAgentStore((s) => s.task.generatedCode);
  const codeValidation = useAgentStore((s) => s.task.codeValidation) ?? mockCodeValidation;
  const codeMap = storeCode ?? mockGeneratedCode;
  const fileEntries = useMemo(() => Array.from(codeMap.entries()), [codeMap]);
  const [activeFile, setActiveFile] = useState(fileEntries[0]?.[0] ?? '');
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showPreview, setShowPreview] = useState(true);
  const activeCode = codeMap.get(activeFile) ?? '';
  const totalFiles = fileEntries.length;
  const totalLines = useMemo(() => fileEntries.reduce((sum, [, code]) => sum + code.split('\n').length, 0), [fileEntries]);

  const previewHtml = useMemo(() => buildPreviewHtml(codeMap), [codeMap]);

  const handleOpenPreview = useCallback(() => {
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, [previewHtml]);

  return (
    <div>
      <div className="rounded-xl border border-black/[0.06] bg-white/75 backdrop-blur-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] min-h-[650px]">
          {/* Code editor side */}
          <div className="flex flex-col border-r border-black/[0.06]">
            <div className="flex items-center gap-0 overflow-x-auto hide-scrollbar border-b border-black/[0.06] bg-black/[0.02]">
              {fileEntries.map(([filename]) => {
                const isActive = filename === activeFile;
                return (
                  <button key={filename} onClick={() => setActiveFile(filename)}
                    className={cn('relative flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-mono whitespace-nowrap transition-colors border-r border-black/[0.04] shrink-0',
                      isActive ? 'text-black/90 bg-white' : 'text-black/40 hover:text-black/60 hover:bg-black/[0.03]')}>
                    <FileCode2 className={cn('w-3 h-3 shrink-0', isActive ? 'text-blue-600' : 'text-black/25')} />
                    {filename}
                    {isActive && <motion.div layoutId="ws-activeFile" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0071E3]" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                  </button>
                );
              })}
            </div>
            <div className="flex-1 overflow-auto">
              <CodeBlock code={activeCode} language={activeFile.endsWith('.tsx') ? 'tsx' : activeFile.endsWith('.ts') ? 'ts' : activeFile.endsWith('.css') ? 'css' : 'tsx'} filename={activeFile} isActive={true} className="rounded-none border-0 h-full" />
            </div>
          </div>
          {/* Preview side */}
          <div className="flex flex-col bg-[#f5f5f7]/50">
            <div className="flex items-center justify-between px-4 py-2 border-b border-black/[0.06] bg-black/[0.02]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-black/50">实时预览</span>
                <button onClick={() => setShowPreview(!showPreview)}
                  className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors', showPreview ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-black/[0.04] text-black/40')}>
                  {showPreview ? '预览中' : '源码'}
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setDeviceView('desktop')} className={cn('p-1.5 rounded-md transition-colors', deviceView === 'desktop' ? 'text-black/80 bg-black/[0.08]' : 'text-black/30 hover:text-black/50')} title="桌面端">
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeviceView('tablet')} className={cn('p-1.5 rounded-md transition-colors', deviceView === 'tablet' ? 'text-black/80 bg-black/[0.08]' : 'text-black/30 hover:text-black/50')} title="平板端">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
                </button>
                <button onClick={() => setDeviceView('mobile')} className={cn('p-1.5 rounded-md transition-colors', deviceView === 'mobile' ? 'text-black/80 bg-black/[0.08]' : 'text-black/30 hover:text-black/50')} title="移动端">
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-black/[0.08] mx-1" />
                <button onClick={handleOpenPreview} className="p-1.5 rounded-md text-black/30 hover:text-black/50 transition-colors" title="在新标签页中打开">
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-stretch p-4 relative overflow-hidden">
              <div className={cn('relative w-full h-full rounded-xl overflow-hidden border border-black/[0.08] bg-white transition-all duration-300',
                deviceView === 'mobile' ? 'max-w-[375px] mx-auto' : deviceView === 'tablet' ? 'max-w-[768px] mx-auto' : 'max-w-full')}>
                {showPreview ? (
                  <iframe
                    srcDoc={previewHtml}
                    sandbox="allow-scripts"
                    className="w-full h-full border-0"
                    title="Code Preview"
                  />
                ) : (
                  <pre className="p-4 text-[11px] text-black/60 font-mono overflow-auto h-full whitespace-pre-wrap">
                    {activeCode}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Premium Design Rules 规则校验 ─── */}
      <div className="mt-4 rounded-xl border border-black/[0.06] bg-white/75 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className={cn("w-4 h-4", codeValidation.passed ? "text-[#34C759]" : "text-[#FF9500]")} />
          <h3 className="text-sm font-medium text-black/80">Premium Design Rules 规则校验</h3>
          <span className="text-[11px] text-black/30 ml-auto">Code Validator · {codeValidation.checksRun} 项检查</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-start">
          {/* Score + status */}
          <div className="flex md:flex-col items-center md:items-start gap-3 md:pr-6 md:border-r md:border-black/[0.06]">
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-3xl font-extrabold tabular-nums",
                codeValidation.score >= 90 ? "text-[#34C759]" : codeValidation.score >= 70 ? "text-[#FF9500]" : "text-[#FF3B30]"
              )}>
                {codeValidation.score}
              </span>
              <span className="text-sm font-semibold text-black/30">/100</span>
            </div>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-medium border",
              codeValidation.passed
                ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20"
                : "bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/20"
            )}>
              {codeValidation.passed ? '✓ 规则符合' : '⚠ 存在违规'}
            </span>
            <div className="text-[10px] text-black/35 leading-relaxed">
              <div>Card ×{codeValidation.cardCount} · Icon ×{codeValidation.iconCount}</div>
              <div>渐变 ×{codeValidation.gradientCount} · 过大圆角 ×{codeValidation.oversizedRadiusCount}</div>
            </div>
          </div>

          {/* Violations list */}
          <div>
            {codeValidation.violations.length > 0 ? (
              <div className="space-y-0">
                {codeValidation.violations.map((v, idx) => (
                  <div key={v.ruleId + idx} className="flex items-start gap-3 py-2 border-b border-black/[0.04] last:border-0 px-2 rounded-lg hover:bg-black/[0.02] transition-colors">
                    {v.severity === 'error'
                      ? <AlertTriangle className="w-3.5 h-3.5 text-[#FF3B30] shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-[#FF9500] shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/[0.04] text-black/45">{v.ruleId}</span>
                        <span className="text-[11px] font-medium text-black/70">{v.ruleName}</span>
                      </div>
                      <p className="text-[11px] text-black/45 mt-0.5 leading-relaxed">{v.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-3 px-2 text-[12px] text-[#34C759]">
                <CheckCircle2 className="w-4 h-4" />
                所有 Premium Design Rules 检查通过，无卡片堆叠、随机渐变、过度圆角等违规
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-black/30">
        <span><span className="text-black/60 font-medium">{totalFiles}</span> 个文件</span>
        <span className="w-px h-3 bg-black/[0.08]" />
        <span><span className="text-black/60 font-medium">{totalLines.toLocaleString()}</span> 行代码</span>
        <span className="w-px h-3 bg-black/[0.08]" />
        <span><span className="text-black/60 font-medium">React 19</span> + TypeScript</span>
        {storeCode && <span className="w-px h-3 bg-black/[0.08]" />}
        {storeCode && <span className="text-[#34C759] font-medium">AI 生成</span>}
      </div>
    </div>
  );
}
