'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, Eye, Palette, Brain, Code2, Zap, ShieldCheck, Rocket, Clock, Check, Loader2, Terminal, X, MonitorPlay } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAgentStore } from '@/store/agent-store';
import { cn, formatDuration } from '@/lib/utils';
import type { AgentId, ActiveSection } from '@/types/agent';

const AGENT_ORDER: AgentId[] = ['browser', 'vision', 'stylematcher', 'planning', 'code', 'animation', 'preview', 'qa', 'deploy'];

const ICON_MAP: Record<AgentId, LucideIcon> = {
  browser: Globe,
  vision: Eye,
  stylematcher: Palette,
  planning: Brain,
  code: Code2,
  animation: Zap,
  qa: ShieldCheck,
  deploy: Rocket,
  preview: MonitorPlay,
};

const AGENT_COLOR: Record<AgentId, string> = {
  browser: '#0071E3',
  vision: '#AF52DE',
  stylematcher: '#FF6482',
  planning: '#FF9500',
  code: '#34C759',
  animation: '#88CE02',
  qa: '#FF3B30',
  deploy: '#0A84FF',
  preview: '#30D158',
};

const AGENT_LABEL: Record<AgentId, string> = {
  browser: '网页读取',
  vision: '视觉识别',
  stylematcher: '体系匹配',
  planning: '架构规划',
  code: '代码生成',
  animation: '动效恢复',
  qa: '质量检测',
  deploy: '信息导出',
  preview: '实时预览',
};

const SECTION_MAP: Record<AgentId, ActiveSection> = {
  browser: 'analysis',
  vision: 'analysis',
  stylematcher: 'stylematcher',
  planning: 'components',
  code: 'code',
  animation: 'code',
  qa: 'qa',
  deploy: 'deploy',
  preview: 'preview',
};

function useNow(ms = 1000) {
  // NOTE: must NOT use useSyncExternalStore with getSnapshot: () => Date.now() —
  // an unstable snapshot violates React's contract (same value between store changes)
  // and causes "Maximum update depth exceeded" infinite re-render loops under load.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Hex to rgba helper */
function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function AgentPipeline() {
  const agents = useAgentStore((s) => s.task.agents);
  const activeSection = useAgentStore((s) => s.activeSection);
  const setActiveSection = useAgentStore((s) => s.setActiveSection);
  const now = useNow();

  // Find the current "active" agent based on running state
  const currentAgentId = AGENT_ORDER.find((id) => agents[id].status === 'running') ?? null;

  return (
    <div className="py-4 px-3">
      {/* Section title */}
      <div className="flex items-center gap-2 px-2 mb-5">
        <Terminal className="w-3.5 h-3.5 text-black/30" />
        <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">
          Agent Pipeline
        </span>
      </div>

      {/* Agent steps */}
      <div className="relative flex flex-col gap-0.5">
        {AGENT_ORDER.map((id, i) => {
          const agent = agents[id];
          const Icon = ICON_MAP[id];
          const color = AGENT_COLOR[id];
          const isRunning = agent.status === 'running';
          const isCompleted = agent.status === 'completed';
          const isIdle = agent.status === 'idle';
          const isError = agent.status === 'error';
          const isActive = activeSection === SECTION_MAP[id] || currentAgentId === id;
          const elapsed = agent.startTime
            ? formatDuration(((agent.endTime ?? now) - agent.startTime) / 1000)
            : null;

          return (
            <div key={id} className="relative flex">
              {/* Connecting line (vertical between icons) */}
              {i < AGENT_ORDER.length - 1 && (
                <div className="absolute left-[23px] top-[44px] w-px h-[calc(100%-36px)]">
                  <div
                    className="w-full h-full rounded-full transition-colors duration-500"
                    style={{
                      background: isCompleted
                        ? hexToRgba(color, 0.2)
                        : 'rgba(0, 0, 0, 0.05)',
                    }}
                  />
                </div>
              )}

              {/* Active indicator bar */}
              <motion.div
                className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                initial={false}
                animate={{
                  scaleY: isActive ? 1 : 0,
                  opacity: isActive ? 1 : 0,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={{ backgroundColor: color }}
              />

              <button
                onClick={() => setActiveSection(SECTION_MAP[id])}
                className={cn(
                  'relative flex items-start gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all duration-200',
                  isActive
                    ? 'bg-black/[0.03]'
                    : 'hover:bg-black/[0.025]',
                )}
              >
                {/* Icon circle */}
                <div className="relative shrink-0 mt-0.5">
                  <div
                    className={cn(
                      'w-[34px] h-[34px] rounded-[10px] flex items-center justify-center transition-all duration-300',
                      isIdle && 'bg-black/[0.03] border border-black/[0.06]',
                      isRunning && 'border',
                      isCompleted && 'border',
                      isError && 'bg-red-50 border border-red-200',
                    )}
                    style={
                      isRunning
                        ? {
                            backgroundColor: hexToRgba(color, 0.08),
                            borderColor: hexToRgba(color, 0.2),
                            boxShadow: `0 0 16px ${hexToRgba(color, 0.15)}`,
                          }
                        : isCompleted
                          ? {
                              backgroundColor: hexToRgba(color, 0.06),
                              borderColor: hexToRgba(color, 0.15),
                            }
                          : undefined
                    }
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5" style={{ color }} strokeWidth={2.5} />
                    ) : isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color }} />
                    ) : isError ? (
                      <X className="w-3.5 h-3.5 text-red-400" strokeWidth={2.5} />
                    ) : (
                      <Icon className="w-3.5 h-3.5 text-black/20" />
                    )}
                  </div>

                  {/* Running pulse ring — transform-only (scale + opacity), no boxShadow paint */}
                  {isRunning && (
                    <motion.div
                      className="absolute inset-0 rounded-[10px] border"
                      style={{ borderColor: hexToRgba(color, 0.25) }}
                      animate={{
                        scale: [1, 1.6],
                        opacity: [0.6, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeOut',
                      }}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 pt-px">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-[13px] font-medium transition-colors duration-200',
                        isIdle && 'text-black/30',
                        isRunning && 'text-[#1d1d1f]',
                        isCompleted && 'text-black/60',
                        isError && 'text-red-500',
                      )}
                    >
                      {AGENT_LABEL[id]}
                    </span>

                    {/* Mini status pill */}
                    {isRunning && (
                      <span
                        className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{
                          color,
                          backgroundColor: hexToRgba(color, 0.1),
                        }}
                      >
                        Running
                      </span>
                    )}
                    {isError && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-red-500 bg-red-50">
                        Error
                      </span>
                    )}
                  </div>

                  {/* Progress bar for running */}
                  {isRunning && (
                    <div className="mt-1.5 h-[3px] rounded-full bg-black/[0.04] overflow-hidden">
                      <motion.div
                        className="h-full w-full rounded-full origin-left"
                        style={{ backgroundColor: color }}
                        animate={{ scaleX: agent.progress / 100 }}
                        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                      />
                    </div>
                  )}

                  {/* Live token stream preview while running (SSE) */}
                  {isRunning && agent.streamingText && agent.streamingText.length > 0 && (
                    <div className="mt-1.5 max-h-[88px] overflow-hidden rounded-lg bg-black/[0.03] border border-black/[0.05] px-2 py-1.5">
                      <p className="text-[10px] leading-[1.5] text-black/45 font-mono whitespace-pre-wrap break-words">
                        {agent.streamingText}
                        <span className="inline-block w-[2px] h-3 ml-0.5 align-middle bg-[#0071E3] animate-pulse" />
                      </p>
                    </div>
                  )}

                  {/* Elapsed time */}
                  <div className="mt-1">
                    {elapsed && !isIdle && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-black/25 font-mono tabular-nums">
                        <Clock className="w-2.5 h-2.5" />
                        {elapsed}
                      </span>
                    )}
                    {!elapsed && isIdle && (
                      <span className="text-[10px] text-black/30">等待中</span>
                    )}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
