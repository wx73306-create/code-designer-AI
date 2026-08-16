'use client';

import { FolderOpen, Loader2, Globe, CheckCircle2, Clock } from 'lucide-react';
import { usePoll, formatTimeAgo, truncateUrl } from '../use-admin-poll';

interface Generation {
  id: string;
  user: string;
  url: string;
  goal: string;
  model: string;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  startedAt: number;
  durationMs?: number;
  files?: number;
  similarity?: number;
}

interface GenerationsResponse {
  generations: Generation[];
}

const GOAL_LABELS: Record<string, string> = {
  colors: '学习配色', layout: '学习排版', style: '学习风格',
  features: '学习特色', template: '构建模板', default: '标准生成',
};

export default function ProjectsPage() {
  const { data } = usePoll<GenerationsResponse>('/api/admin/stats?section=generations', 3000);
  const generations = data?.generations ?? [];

  // 每个生成任务即一个"项目"
  const projects = generations.map((g) => ({
    ...g,
    host: g.url.replace(/^https?:\/\//, '').split('/')[0] || g.url,
  }));
  const completed = projects.filter((p) => p.status === 'completed').length;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">项目管理</h1>
          <p className="mt-1 text-sm text-white/30">由生成任务实时产生的项目记录</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <FolderOpen className="w-3.5 h-3.5 text-[#0071E3]" />
          <span className="text-xs text-white/50 tabular-nums">{projects.length} 个项目 · {completed} 已完成</span>
        </div>
      </div>

      {!data && (
        <div className="flex items-center gap-3 py-16 justify-center text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">正在加载项目列表…</span>
        </div>
      )}

      {data && projects.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] py-16 text-center">
          <FolderOpen className="w-8 h-8 text-white/15" />
          <p className="text-sm text-white/40">暂无项目</p>
          <p className="text-xs text-white/25">用户每完成一次生成任务，就会在这里产生一条项目记录</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 transition-all hover:bg-white/[0.05] hover:border-white/[0.12]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#0071E3]/10 border border-[#0071E3]/15 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 text-[#0071E3]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.host}</p>
                  <p className="text-[11px] text-white/30 truncate">{truncateUrl(p.url, 30)}</p>
                </div>
              </div>
              {p.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {p.status === 'running' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />}
              {p.status === 'error' && <Clock className="w-4 h-4 text-red-400 shrink-0" />}
            </div>

            {/* Meta */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">{GOAL_LABELS[p.goal] || p.goal}</span>
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50 font-mono">{p.model}</span>
              {p.files !== undefined && (
                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">{p.files} 文件</span>
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between text-[11px] text-white/30">
              <span>{p.user} · {formatTimeAgo(p.startedAt)}</span>
              {p.similarity ? (
                <span className={`tabular-nums ${p.similarity >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  还原度 {p.similarity.toFixed(1)}%
                </span>
              ) : p.status === 'running' ? (
                <span className="text-blue-400">生成中…</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
