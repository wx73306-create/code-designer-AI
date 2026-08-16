'use client';

import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Loader2, Sparkles, Wand2, Bug, Download, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useAgentStore } from '@/store/agent-store';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FEATURE_TAGS = [
  { label: 'AI智能分析', icon: Sparkles },
  { label: '自动生代码', icon: Wand2 },
  { label: '自动修复优化', icon: Bug },
  { label: '一键信息导出', icon: Download },
] as const;

const STAGGER_DELAY = 0.08;

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      delay: i * STAGGER_DELAY,
      ease: EASE,
    },
  }),
};

// ---------------------------------------------------------------------------
// HeroSection
// ---------------------------------------------------------------------------

export function HeroSection() {
  const [url, setUrl] = useState('');
  const startTask = useAgentStore((s) => s.startTask);
  const resetTask = useAgentStore((s) => s.resetTask);
  const isRunning = useAgentStore((s) => s.isRunning);
  const taskStatus = useAgentStore((s) => s.task.status);
  const taskUrl = useAgentStore((s) => s.task.url);

  const isCompleted = !isRunning && taskStatus === 'completed';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || isRunning) return;
    startTask(trimmed);
  }

  function handleRerun() {
    resetTask();
    setTimeout(() => {
      if (taskUrl) startTask(taskUrl);
    }, 300);
  }

  return (
    <section
      className={cn(
        'relative flex items-center justify-center overflow-hidden transition-all duration-700',
        'hero-gradient',
        isCompleted ? 'min-h-[50vh]' : 'min-h-screen',
      )}
    >
      {/* Radial glow overlay */}
      <div className="absolute inset-0 hero-radial pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 flex flex-col items-center text-center">

        {/* Badge */}
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mb-8"
        >
          <span
            className={cn(
              'inline-flex items-center gap-2 px-4 py-1.5 rounded-full',
              'bg-black/[0.05] border border-black/[0.08]',
              'text-xs font-medium text-[#86868b] tracking-wide',
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0071E3]" />
            AI 驱动的网页逆向工程
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          custom={1}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className={cn(
            'text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.08]',
            'bg-gradient-to-b from-[#1d1d1f] via-[#1d1d1f] to-[#0071E3]',
            'bg-clip-text text-transparent',
            'drop-shadow-[0_0_30px_rgba(0,113,227,0.15)]',
          )}
        >
          Code Designer AI
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          custom={2}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-5 text-base sm:text-lg text-black/40 max-w-[540px] leading-relaxed"
        >
          输入任意网站 URL，AI 自动理解设计、分析语言、拆分组件、生成 React 项目
        </motion.p>

        {/* URL Input / Status */}
        <motion.div
          custom={3}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-10 w-full max-w-xl"
        >
          <AnimatePresence mode="wait">
            {isRunning ? (
              /* --- Running state --- */
              <motion.div
                key="running"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={cn(
                  'flex items-center justify-center gap-3 w-full px-5 py-4 rounded-2xl',
                  'bg-black/[0.04] border border-black/[0.08] backdrop-blur-xl',
                )}
              >
                <Loader2 className="w-5 h-5 text-[#0071E3] animate-spin" />
                <span className="text-sm text-black/60">正在分析 {taskUrl}...</span>
              </motion.div>
            ) : isCompleted ? (
              /* --- Completed state --- */
              <motion.div
                key="completed"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={cn(
                  'flex flex-col items-center gap-4 w-full px-5 py-6 rounded-2xl',
                  'bg-black/[0.04] border border-[#34C759]/20 backdrop-blur-xl',
                  'shadow-[0_0_30px_rgba(52,199,89,0.1)]',
                )}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#34C759]" />
                  <span className="text-sm font-medium text-[#34C759]">分析完成</span>
                </div>
                <p className="text-xs text-[#86868b]">
                  {taskUrl} — 所有 Agent 已完成工作
                </p>
                <button
                  onClick={handleRerun}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium',
                    'bg-[#0071E3] text-white',
                    'hover:bg-[#0077ED] active:scale-[0.97]',
                    'transition-all duration-200',
                  )}
                >
                  <RotateCcw className="w-4 h-4" />
                  重新运行
                </button>
              </motion.div>
            ) : (
              /* --- Idle state: input form --- */
              <motion.form
                key="idle"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                onSubmit={handleSubmit}
                className={cn(
                  'relative flex items-center w-full rounded-2xl',
                  'bg-black/[0.04] border border-black/[0.08] backdrop-blur-xl',
                  'focus-within:border-[#0071E3]/50 focus-within:shadow-[0_0_20px_rgba(0,113,227,0.15)] focus-within:bg-black/[0.06]',
                  'transition-all duration-300',
                )}
              >
                {/* Globe icon */}
                <Globe className="ml-5 mr-3 w-4.5 h-4.5 text-[#86868b] shrink-0" />

                {/* Input */}
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://apple.com"
                  className={cn(
                    'flex-1 bg-transparent py-4 text-sm text-[#1d1d1f] placeholder:text-[#aeaeb2]',
                    'outline-none border-none',
                  )}
                />

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!url.trim()}
                  className={cn(
                    'shrink-0 mr-2 px-5 py-2.5 rounded-xl text-sm font-medium',
                    'bg-[#0071E3] text-white shadow-[0_2px_12px_rgba(0,113,227,0.15)]',
                    'hover:bg-[#0077ED] active:scale-[0.97]',
                    'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#0071E3] disabled:shadow-none',
                    'transition-all duration-200',
                  )}
                >
                  开始生成 →
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Feature Tags */}
        <motion.div
          custom={4}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          {FEATURE_TAGS.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full',
                'bg-black/[0.03] border border-black/[0.08]',
                'text-xs text-[#86868b]',
                'hover:border-black/[0.15] hover:bg-black/[0.05]',
                'transition-all duration-200',
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
