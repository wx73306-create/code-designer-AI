'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Eye,
  Palette,
  Sparkles,
  Brain,
  Code2,
  ShieldCheck,
  Rocket,
  Clock,
  MonitorPlay,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAgentStore } from '@/store/agent-store';
import { GlassCard } from '@/components/ui/glass-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn, formatDuration } from '@/lib/utils';
import type { AgentId, AgentStatus } from '@/types/agent';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_ORDER: AgentId[] = ['browser', 'vision', 'stylematcher', 'critic', 'planning', 'code', 'qa', 'deploy', 'preview'];

const ICON_MAP: Record<AgentId, LucideIcon> = {
  browser: Globe,
  vision: Eye,
  stylematcher: Palette,
  critic: Sparkles,
  planning: Brain,
  code: Code2,
  qa: ShieldCheck,
  deploy: Rocket,
  preview: MonitorPlay,
};

const PROGRESS_COLOR: Record<AgentId, 'blue' | 'green' | 'purple' | 'orange'> = {
  browser: 'blue',
  vision: 'purple',
  stylematcher: 'purple',
  critic: 'orange',
  planning: 'orange',
  code: 'green',
  qa: 'orange',
  deploy: 'blue',
  preview: 'green',
};

/** Agent accent colors (matches CSS vars in globals.css) */
const AGENT_GLOW: Record<AgentId, string> = {
  browser: 'rgba(0, 113, 227, 0.25)',
  vision: 'rgba(191, 90, 242, 0.25)',
  stylematcher: 'rgba(255, 100, 130, 0.25)',
  critic: 'rgba(255, 214, 10, 0.25)',
  planning: 'rgba(255, 159, 10, 0.25)',
  code: 'rgba(48, 209, 88, 0.25)',
  qa: 'rgba(255, 55, 95, 0.25)',
  deploy: 'rgba(100, 210, 255, 0.25)',
  preview: 'rgba(48, 209, 88, 0.25)',
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: '等待中',
  running: '运行中',
  completed: '已完成',
  error: '出错',
};

// ---------------------------------------------------------------------------
// Elapsed-time hook (updates every second)
// ---------------------------------------------------------------------------

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ---------------------------------------------------------------------------
// AgentStatusSection
// ---------------------------------------------------------------------------

export function AgentStatusSection() {
  const isRunning = useAgentStore((s) => s.isRunning);
  const agents = useAgentStore((s) => s.task.agents);
  const now = useNow();

  const anyStarted = useMemo(
    () => AGENT_ORDER.some((id) => agents[id].status !== 'idle'),
    [agents],
  );

  // Only render when the workflow is active or at least one agent has started
  if (!isRunning && !anyStarted) return null;

  return (
    <section className="relative w-full py-20 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight bg-gradient-to-r from-[#1d1d1f] to-black/70 bg-clip-text text-transparent">
            AI多智能体协同工作
          </h2>
          <p className="mt-2 text-sm text-black/35">
            8 个 AI Agent 流水线协作，自动完成从分析到部署的全流程
          </p>
        </motion.div>

        {/* Agent grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENT_ORDER.map((id, i) => {
            const agent = agents[id];
            const Icon = ICON_MAP[id];
            const isRunningAgent = agent.status === 'running';
            const elapsed =
              agent.startTime
                ? formatDuration(
                    ((agent.endTime ?? now) - agent.startTime) / 1000,
                  )
                : null;

            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.06,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="rounded-xl transition-shadow duration-500"
                style={
                  isRunningAgent
                    ? { boxShadow: `0 0 28px ${AGENT_GLOW[id]}` }
                    : undefined
                }
              >
                <GlassCard
                  hover
                  className={cn(
                    'p-6 flex flex-col gap-4',
                    isRunningAgent && 'border-black/[0.14]',
                  )}
                  style={{
                    borderTopWidth: '2px',
                    borderTopColor: AGENT_GLOW[id].replace('0.25', '0.30'),
                  }}
                >
                  {/* Top row: icon + name + badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {/* Icon container */}
                      <div
                        className={cn(
                          'flex items-center justify-center w-10 h-10 rounded-lg',
                          'bg-black/[0.04] border border-black/[0.06]',
                        )}
                      >
                        <Icon className="w-4 h-4 text-black/60" />
                      </div>
                      <div>
                        <p className="text-[15px] font-medium text-black/90 leading-tight">
                          {agent.name}
                        </p>
                        {elapsed && (
                          <p className="flex items-center gap-1 mt-0.5 text-xs text-black/25">
                            <Clock className="w-3 h-3" />
                            {elapsed}
                          </p>
                        )}
                      </div>
                    </div>

                    <StatusBadge status={agent.status} label={STATUS_LABEL[agent.status]} />
                  </div>

                  {/* Progress bar */}
                  <ProgressBar
                    value={agent.progress}
                    color={PROGRESS_COLOR[id]}
                    showPercentage
                  />

                  {/* Latest log */}
                  <div className="min-h-[2rem]">
                    {agent.logs.length > 0 ? (
                      <p className="text-xs text-[#86868b] leading-relaxed truncate-2-lines">
                        {agent.logs[agent.logs.length - 1].message}
                      </p>
                    ) : (
                      <p className="text-xs text-[#aeaeb2]">等待启动...</p>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
