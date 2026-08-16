'use client';

import { useMemo, useRef, useEffect } from 'react';
import { Terminal, Globe, Eye, Palette, Sparkles, Brain, Code2, ShieldCheck, Rocket, MonitorPlay } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAgentStore } from '@/store/agent-store';
import { cn, formatTime } from '@/lib/utils';
import type { AgentId, LogEntry } from '@/types/agent';

const AGENT_ICON: Record<AgentId, LucideIcon> = {
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

const AGENT_COLOR: Record<AgentId, string> = {
  browser: '#0071E3',
  vision: '#AF52DE',
  stylematcher: '#FF6482',
  critic: '#FFD60A',
  planning: '#FF9500',
  code: '#34C759',
  qa: '#FF3B30',
  deploy: '#0A84FF',
  preview: '#30D158',
};

interface MergedLog {
  agentId: AgentId;
  entry: LogEntry;
}

export function LogPanel() {
  const agents = useAgentStore((s) => s.task.agents);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Merge all logs from all agents, sorted by timestamp
  const allLogs = useMemo(() => {
    const merged: MergedLog[] = [];
    for (const id of Object.keys(agents) as AgentId[]) {
      for (const entry of agents[id].logs) {
        merged.push({ agentId: id, entry });
      }
    }
    merged.sort((a, b) => a.entry.timestamp - b.entry.timestamp);
    return merged;
  }, [agents]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allLogs.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-black/[0.06]">
        <Terminal className="w-3.5 h-3.5 text-black/40" />
        <span className="text-[11px] font-semibold text-black/40 uppercase tracking-wider">
          Activity Log
        </span>
        <span className="ml-auto text-[10px] text-black/20 font-mono">
          {allLogs.length} entries
        </span>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {allLogs.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-black/20">等待日志...</p>
          </div>
        )}
        {allLogs.map((log, i) => {
          const Icon = AGENT_ICON[log.agentId];
          const color = AGENT_COLOR[log.agentId];
          const isError = log.entry.type === 'error';
          const isSuccess = log.entry.type === 'success';
          const isWarning = log.entry.type === 'warning';

          return (
            <div
              key={`${log.agentId}-${log.entry.timestamp}-${i}`}
              className={cn(
                'flex items-start gap-2 py-1.5 px-1.5 rounded-md transition-colors hover:bg-black/[0.03]',
              )}
            >
              <Icon
                className="w-3 h-3 shrink-0 mt-0.5"
                style={{ color: `${color}80` }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-[11px] leading-relaxed',
                    isError
                      ? 'text-red-500/80'
                      : isSuccess
                        ? 'text-[#34C759]/80'
                        : isWarning
                          ? 'text-yellow-600/70'
                          : 'text-black/40',
                  )}
                >
                  {log.entry.message}
                </p>
              </div>
              <span className="text-[9px] text-black/15 font-mono shrink-0 mt-0.5 tabular-nums">
                {formatTime(log.entry.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
