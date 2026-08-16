'use client';

import { useState } from 'react';
import { Bot, Loader2, CheckCircle2, XCircle, RotateCcw, Globe } from 'lucide-react';
import { usePoll, formatDuration, formatTimeAgo, formatNumber, truncateUrl } from '../use-admin-poll';

interface Generation {
  id: string;
  user: string;
  email: string;
  url: string;
  goal: string;
  model: string;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  currentStage: string;
  startedAt: number;
  durationMs?: number;
  tokens?: number;
  cost?: number;
  files?: number;
  similarity?: number;
  error?: string;
}

interface GenerationsResponse {
  generations: Generation[];
}

const GOAL_LABELS: Record<string, string> = {
  colors: '学习配色', layout: '学习排版', style: '学习风格',
  features: '学习特色', template: '构建模板', default: '标准生成',
};

const STAGE_LABELS: Record<string, string> = {
  browser: '网页读取', vision: '视觉分析', planning: '架构规划',
  code: '代码生成', qa: '质量检测', deploy: '导出打包', done: '已完成',
};

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'running', label: '进行中' },
  { key: 'completed', label: '成功' },
  { key: 'error', label: '失败' },
  { key: 'cancelled', label: '已取消' },
] as const;

export default function GenerationsPage() {
  const { data } = usePoll<GenerationsResponse>('/api/admin/stats?section=generations', 2500);
  const [filter, setFilter] = useState<string>('all');

  const generations = data?.generations ?? [];
  const filtered = filter === 'all' ? generations : generations.filter((g) => g.status === filter);

  const counts = {
    all: generations.length,
    running: generations.filter((g) => g.status === 'running').length,
    completed: generations.filter((g) => g.status === 'completed').length,
    error: generations.filter((g) => g.status === 'error').length,
    cancelled: generations.filter((g) => g.status === 'cancelled').length,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">AI 生成记录</h1>
          <p className="mt-1 text-sm text-white/30">前端工作流全生命周期实时追踪</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <Bot className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs text-white/50 tabular-nums">{counts.running} 运行中</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              filter === f.key
                ? 'bg-[#0071E3]/15 text-[#0071E3] border border-[#0071E3]/25'
                : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:text-white/70'
            }`}
          >
            {f.label}
            <span className="ml-1.5 tabular-nums opacity-60">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {!data && (
        <div className="flex items-center gap-3 py-16 justify-center text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">正在加载生成记录…</span>
        </div>
      )}

      {data && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] py-16 text-center">
          <Globe className="w-8 h-8 text-white/15" />
          <p className="text-sm text-white/40">暂无{filter === 'all' ? '' : FILTERS.find((f) => f.key === filter)?.label}记录</p>
          <p className="text-xs text-white/25">在前台发起生成任务后，完整生命周期会实时记录在这里</p>
        </div>
      )}

      {/* Record cards */}
      <div className="space-y-3">
        {filtered.map((g) => (
          <div
            key={g.id}
            className={`rounded-xl border p-5 transition-colors ${
              g.status === 'running'
                ? 'border-blue-500/20 bg-blue-500/[0.04]'
                : g.status === 'error'
                ? 'border-red-500/15 bg-red-500/[0.03]'
                : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              {/* Left: user + url */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-[#0071E3]/15 border border-[#0071E3]/20 flex items-center justify-center text-xs font-semibold text-[#0071E3] shrink-0">
                  {g.user.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{g.user}</span>
                    <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">{GOAL_LABELS[g.goal] || g.goal}</span>
                    <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50 font-mono">{g.model}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/40 font-mono truncate">{g.url}</p>
                  {g.error && <p className="mt-1.5 text-xs text-red-400/80">{g.error}</p>}
                </div>
              </div>

              {/* Right: status */}
              <div className="flex items-center gap-2 shrink-0">
                {g.status === 'running' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs text-blue-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {STAGE_LABELS[g.currentStage] || g.currentStage}
                  </span>
                )}
                {g.status === 'completed' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> 成功
                  </span>
                )}
                {g.status === 'error' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs text-red-400">
                    <XCircle className="w-3 h-3" /> 失败
                  </span>
                )}
                {g.status === 'cancelled' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400">
                    <RotateCcw className="w-3 h-3" /> 已取消
                  </span>
                )}
              </div>
            </div>

            {/* Metrics row */}
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-xs tabular-nums">
              <div>
                <span className="text-white/30">开始时间 </span>
                <span className="text-white/60">{formatTimeAgo(g.startedAt)}</span>
              </div>
              <div>
                <span className="text-white/30">耗时 </span>
                <span className={g.status === 'running' ? 'text-blue-400' : 'text-white/60'}>
                  {g.status === 'running' ? formatDuration(Date.now() - g.startedAt) : formatDuration(g.durationMs)}
                </span>
              </div>
              <div>
                <span className="text-white/30">Token </span>
                <span className="text-white/60">{g.tokens ? formatNumber(g.tokens) : '—'}</span>
              </div>
              <div>
                <span className="text-white/30">费用 </span>
                <span className="text-white/60">{g.cost ? `¥${g.cost.toFixed(4)}` : '—'}</span>
              </div>
              <div>
                <span className="text-white/30">文件数 </span>
                <span className="text-white/60">{g.files ?? '—'}</span>
              </div>
              <div>
                <span className="text-white/30">还原度 </span>
                <span className={g.similarity && g.similarity >= 90 ? 'text-emerald-400' : 'text-white/60'}>
                  {g.similarity ? `${g.similarity.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>

            {/* Running progress hint */}
            {g.status === 'running' && (
              <div className="mt-3 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-blue-500/60 animate-[indeterminate_1.4s_ease-in-out_infinite]" />
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
