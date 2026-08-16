'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Circle, Play, Pause, RotateCcw, Eye, Sparkles, FileCode, Palette, Type, Layout, Component } from 'lucide-react';
import { AI_PROCESS_STEPS, type AIProcessStep } from '@/lib/data/ai-process';

const ease = [0.25, 0.46, 0.45, 0.94] as const;
const STEP_GAP_MS = 1200; // pause between steps
const LOOP_HOLD_MS = 5000; // hold at "complete" before restarting

// =============================================================================
// Step status icon
// =============================================================================
function StepIcon({ status }: { status: 'waiting' | 'running' | 'completed' }) {
  if (status === 'completed') {
    return (
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className="w-6 h-6 rounded-full bg-[#34C759] flex items-center justify-center shrink-0">
        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
      </motion.div>
    );
  }
  if (status === 'running') {
    return (
      <div className="relative w-6 h-6 shrink-0">
        <motion.div className="absolute inset-0 rounded-full bg-[#0071E3]/20"
          animate={{ scale: [1, 1.7, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="relative w-6 h-6 rounded-full bg-[#0071E3] flex items-center justify-center">
          <Loader2 className="w-3 h-3 text-white animate-spin" />
        </div>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full border-2 border-black/[0.08] flex items-center justify-center shrink-0">
      <Circle className="w-2 h-2 text-black/12" />
    </div>
  );
}

// =============================================================================
// Step row — clickable
// =============================================================================
function ProcessStepRow({ step, status, index, onClick }: {
  step: AIProcessStep; status: 'waiting' | 'running' | 'completed'; index: number; onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-300 cursor-pointer group
        ${status === 'running'
          ? 'bg-white/80 backdrop-blur-sm border border-[#0071E3]/15 shadow-[0_2px_16px_rgba(0,113,227,0.07)]'
          : status === 'completed'
          ? 'bg-white/40 border border-black/[0.04] hover:bg-white/60'
          : 'bg-transparent border border-transparent hover:bg-black/[0.02]'
        }`}
    >
      <StepIcon status={status} />
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-medium transition-colors duration-300 ${
          status === 'running' ? 'text-[#1d1d1f]' : status === 'completed' ? 'text-black/45' : 'text-black/20'
        }`}>
          <span className="mr-1.5">{step.icon}</span>
          {step.title}
        </div>
        <AnimatePresence>
          {status === 'running' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
              className="text-[11px] text-black/30 mt-0.5 overflow-hidden">
              {step.description}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Hover arrow */}
      {status !== 'running' && (
        <motion.div initial={{ opacity: 0 }} whileHover={{ opacity: 1, x: 2 }}
          className="text-black/15 group-hover:text-black/30 text-[11px] shrink-0">
          →
        </motion.div>
      )}
    </motion.button>
  );
}

// =============================================================================
// Right-side panels — one per step
// =============================================================================

// -- File tree panel (capture step) --
function FileTreePanel({ active }: { active: boolean }) {
  const files = ['page.tsx', 'Navbar.tsx', 'Hero.tsx', 'ProductGrid.tsx', 'Footer.tsx', 'globals.css'];
  const [shown, setShown] = useState(0);
  useEffect(() => { if (!active) { setShown(0); return; }
    const t = setInterval(() => setShown(p => Math.min(p + 1, files.length)), 350);
    return () => clearInterval(t);
  }, [active, files.length]);
  if (!active) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="rounded-xl bg-[#1d1d1f] p-3 font-mono text-[11px]">
      <div className="text-white/30 mb-2 text-[10px]">📁 src/components/</div>
      {files.slice(0, shown).map((f, i) => (
        <motion.div key={f} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }} className="text-white/60 py-0.5 pl-3 border-l border-white/[0.06]">
          <FileCode className="w-3 h-3 inline mr-1.5 text-[#0071E3]/60 -mt-0.5" />{f}
        </motion.div>
      ))}
    </motion.div>
  );
}

// -- Scan labels panel (vision step) --
function ScanPanel({ labels, active }: { labels: string[]; active: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { if (!active) { setShown(0); return; }
    const t = setInterval(() => setShown(p => Math.min(p + 1, labels.length)), 500);
    return () => clearInterval(t);
  }, [active, labels.length]);
  if (!active) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="space-y-3">
      {/* Mock browser */}
      <div className="rounded-xl border border-black/[0.06] bg-white/50 overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-black/[0.04] bg-black/[0.02]">
          <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-black/[0.06]" /><div className="w-2 h-2 rounded-full bg-black/[0.06]" /><div className="w-2 h-2 rounded-full bg-black/[0.06]" /></div>
          <div className="flex-1 h-3.5 rounded bg-black/[0.03] ml-2 flex items-center px-2"><span className="text-[8px] text-black/15 font-mono">apple.com</span></div>
        </div>
        <div className="relative p-3 min-h-[80px]">
          <div className="space-y-1.5"><div className="h-2.5 w-3/4 rounded bg-black/[0.04]" /><div className="h-6 w-full rounded bg-black/[0.03]" /><div className="grid grid-cols-3 gap-1"><div className="h-5 rounded bg-black/[0.03]" /><div className="h-5 rounded bg-black/[0.03]" /><div className="h-5 rounded bg-black/[0.03]" /></div></div>
          <motion.div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#0071E3]/50 to-transparent"
            animate={{ top: ['0%', '100%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }} />
          <div className="absolute inset-0 p-1.5 flex flex-col gap-1 pointer-events-none">
            {labels.slice(0, shown).map(l => (
              <motion.div key={l} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="self-start px-1.5 py-0.5 rounded text-[8px] font-medium bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/15">
                <Eye className="w-2 h-2 inline mr-0.5 -mt-0.5" />{l}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// -- Design tokens panel (design + tokens steps) --
function DesignTokensPanel({ active }: { active: boolean }) {
  const colors = ['#0071E3', '#1d1d1f', '#F5F5F7', '#86868B', '#FF375F', '#34C759'];
  const fonts = ['SF Pro Display', 'SF Pro Text', 'Helvetica Neue'];
  const spacing = ['4px', '8px', '16px', '24px', '32px', '48px'];
  const [stage, setStage] = useState(0);
  useEffect(() => { if (!active) { setStage(0); return; }
    const t1 = setTimeout(() => setStage(1), 600);
    const t2 = setTimeout(() => setStage(2), 1400);
    const t3 = setTimeout(() => setStage(3), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);
  if (!active) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="space-y-3">
      {stage >= 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-black/[0.06] bg-white/50 p-3">
          <div className="flex items-center gap-1.5 mb-2"><Palette className="w-3 h-3 text-[#0071E3]" /><span className="text-[10px] font-medium text-black/50">Colors</span></div>
          <div className="flex gap-1.5 flex-wrap">
            {colors.map((c, i) => (
              <motion.div key={c} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.08 }}
                className="w-8 h-8 rounded-lg border border-black/[0.06] shadow-sm" style={{ backgroundColor: c }} title={c} />
            ))}
          </div>
        </motion.div>
      )}
      {stage >= 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-black/[0.06] bg-white/50 p-3">
          <div className="flex items-center gap-1.5 mb-2"><Type className="w-3 h-3 text-[#5856D6]" /><span className="text-[10px] font-medium text-black/50">Typography</span></div>
          {fonts.map((f, i) => (
            <div key={f} className="flex items-center gap-2 py-0.5">
              <span className="text-[9px] text-black/20 w-8">{['H1', 'Body', 'UI'][i]}</span>
              <span className={`text-[12px] text-black/60 ${i === 0 ? 'font-semibold' : ''}`} style={{ fontFamily: f }}>{f}</span>
            </div>
          ))}
        </motion.div>
      )}
      {stage >= 3 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-black/[0.06] bg-white/50 p-3">
          <div className="flex items-center gap-1.5 mb-2"><Layout className="w-3 h-3 text-[#FF9500]" /><span className="text-[10px] font-medium text-black/50">Spacing</span></div>
          <div className="flex items-end gap-1">
            {spacing.map((s, i) => (
              <motion.div key={s} initial={{ height: 0 }} animate={{ height: 4 + i * 5 }} transition={{ delay: i * 0.06 }}
                className="w-5 rounded bg-[#FF9500]/20 border border-[#FF9500]/15" title={s} />
            ))}
          </div>
          <div className="flex gap-1 mt-1">{spacing.map(s => <span key={s} className="text-[7px] text-black/20 w-5 text-center">{s}</span>)}</div>
        </motion.div>
      )}
    </motion.div>
  );
}

// -- Code editor panel (code step) --
function CodePanel({ lines, active }: { lines: string[]; active: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { if (!active) { setShown(0); return; }
    const t = setInterval(() => setShown(p => Math.min(p + 1, lines.length)), 200);
    return () => clearInterval(t);
  }, [active, lines.length]);
  if (!active) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="rounded-xl bg-[#1d1d1f] overflow-hidden border border-black/[0.1]">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06]">
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" /><div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" /><div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-2 text-[10px] text-white/25 font-mono">Hero.tsx</span>
        <span className="ml-auto text-[9px] text-white/15">{shown}/{lines.length} lines</span>
      </div>
      <div className="p-3 font-mono text-[11px] leading-relaxed max-h-[200px] overflow-hidden">
        {lines.slice(0, shown).map((line, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.12 }}
            className="text-white/65 whitespace-pre">
            <span className="text-white/15 mr-3 select-none inline-block w-4 text-right">{i + 1}</span>{line || '\u00A0'}
          </motion.div>
        ))}
        {shown < lines.length && <motion.span className="inline-block w-1.5 h-3.5 bg-[#0071E3] ml-[52px]" animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }} />}
      </div>
    </motion.div>
  );
}

// -- Complete panel --
function CompletePanel({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      className="rounded-xl border border-[#34C759]/15 bg-[#34C759]/[0.03] p-5 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
        className="w-14 h-14 rounded-full bg-[#34C759]/10 border-2 border-[#34C759]/25 flex items-center justify-center mx-auto mb-3">
        <Check className="w-7 h-7 text-[#34C759]" strokeWidth={2.5} />
      </motion.div>
      <div className="text-[15px] font-semibold text-[#1d1d1f] mb-1">项目就绪</div>
      <div className="text-[12px] text-black/35 mb-4">已生成 6 个组件文件，可预览和导出</div>
      <div className="flex items-center justify-center gap-2">
        {['HTML', 'React', 'ZIP'].map(fmt => (
          <span key={fmt} className="px-3 py-1 rounded-lg text-[11px] font-medium bg-white/70 border border-black/[0.06] text-black/50">{fmt}</span>
        ))}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================
export default function AIProcessAnimation() {
  const [currentStep, setCurrentStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const advance = useCallback(() => {
    if (currentStep < AI_PROCESS_STEPS.length - 1) {
      setTransitioning(true);
      timerRef.current = setTimeout(() => {
        setTransitioning(false);
        setCurrentStep(prev => prev + 1);
      }, STEP_GAP_MS);
    } else {
      // Hold at complete, then loop
      timerRef.current = setTimeout(() => {
        setCurrentStep(0);
        setTransitioning(false);
        setCycleKey(prev => prev + 1);
      }, LOOP_HOLD_MS);
    }
  }, [currentStep]);

  useEffect(() => {
    if (paused) return;
    const step = AI_PROCESS_STEPS[currentStep];
    if (!step) return;
    timerRef.current = setTimeout(advance, step.duration);
    return () => clearTimeout(timerRef.current);
  }, [currentStep, cycleKey, paused, advance]);

  // Jump to step on click
  const jumpTo = useCallback((idx: number) => {
    clearTimeout(timerRef.current);
    setTransitioning(false);
    setCurrentStep(idx);
    setCycleKey(prev => prev + 1);
  }, []);

  // Restart
  const restart = useCallback(() => {
    clearTimeout(timerRef.current);
    setTransitioning(false);
    setPaused(false);
    setCurrentStep(0);
    setCycleKey(prev => prev + 1);
  }, []);

  // Progress
  const elapsedMs = AI_PROCESS_STEPS.slice(0, currentStep).reduce((s, st) => s + st.duration, 0);
  const totalMs = AI_PROCESS_STEPS.reduce((s, st) => s + st.duration, 0);
  const progress = Math.round((elapsedMs / totalMs) * 100);

  const stepData = AI_PROCESS_STEPS[currentStep];
  const stepId = stepData?.id || '';

  return (
    <motion.section initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7, ease }}
      className="relative py-16 px-4">
      <div className="max-w-[820px] mx-auto">
        {/* Header with controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#34C759]/8 border border-[#34C759]/15">
              <Sparkles className="w-3 h-3 text-[#34C759]" />
              <span className="text-[10px] font-medium text-[#34C759]">AI Design Agent</span>
            </div>
            <span className="text-[12px] text-black/30">正在分析 apple.com</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPaused(!paused)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-black/30 hover:text-black/50 hover:bg-black/[0.04] transition-colors" title={paused ? '继续' : '暂停'}>
              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            <button onClick={restart}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-black/30 hover:text-black/50 hover:bg-black/[0.04] transition-colors" title="重新开始">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5" key={cycleKey}>
          {/* Left: Steps (3 cols) */}
          <div className="md:col-span-3 space-y-1">
            {AI_PROCESS_STEPS.map((step, i) => {
              const status = i < currentStep || (i === currentStep && transitioning)
                ? 'completed' : i === currentStep ? 'running' : 'waiting';
              return <ProcessStepRow key={step.id} step={step} status={status} index={i} onClick={() => jumpTo(i)} />;
            })}

            {/* Progress bar — clickable */}
            <div className="mt-4 flex items-center gap-3">
              <button className="flex-1 h-1.5 rounded-full bg-black/[0.04] overflow-hidden cursor-pointer group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  const idx = Math.min(AI_PROCESS_STEPS.length - 1, Math.floor(pct * AI_PROCESS_STEPS.length));
                  jumpTo(idx);
                }}>
                <motion.div className="h-full rounded-full bg-gradient-to-r from-[#0071E3] to-[#5856D6] group-hover:shadow-[0_0_8px_rgba(0,113,227,0.3)]"
                  animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
              </button>
              <span className="text-[11px] font-mono text-black/20 tabular-nums w-8 text-right">{progress}%</span>
            </div>
          </div>

          {/* Right: Dynamic preview (2 cols) */}
          <div className="md:col-span-2">
            <AnimatePresence mode="wait">
              {stepId === 'capture' && <FileTreePanel key="files" active={!transitioning} />}
              {stepId === 'vision' && <ScanPanel key="scan" labels={stepData.scanLabels || []} active={!transitioning} />}
              {(stepId === 'design' || stepId === 'tokens') && <DesignTokensPanel key="tokens" active={!transitioning} />}
              {stepId === 'code' && <CodePanel key="code" lines={stepData.codeLines || []} active={!transitioning} />}
              {stepId === 'complete' && <CompletePanel key="done" active={!transitioning} />}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
