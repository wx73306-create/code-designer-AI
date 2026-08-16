'use client';

import { useParams, useRouter } from 'next/navigation';
import { usePoll, formatDuration, formatNumber, formatClock } from '../../use-admin-poll';
import {
  ArrowLeft, Globe, Eye, Palette, Sparkles, Brain, Code2, ShieldCheck, Zap,
  Download, CheckCircle2, XCircle, Clock, Loader2, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ---- Types ----

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
  completedAt?: number;
  durationMs?: number;
  tokens?: number;
  cost?: number;
  files?: number;
  similarity?: number;
  error?: string;
}

interface ApiCall {
  id: string;
  generationId?: string;
  step: string;
  model: string;
  status: 'success' | 'error';
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: number;
  error?: string;
}

interface GenerationsResponse {
  generations: Generation[];
}

interface ApiCallsResponse {
  calls: ApiCall[];
}

// ---- Pipeline definition ----

const PIPELINE: Array<{ key: string; label: string; icon: LucideIcon; color: string; desc: string }> = [
  { key: 'browser', label: 'Browser Agent', icon: Globe, color: '#0071E3', desc: '网页读取 · DOM/CSS 抓取' },
  { key: 'vision', label: 'Vision Agent', icon: Eye, color: '#AF52DE', desc: '视觉识别 · 设计系统分析' },
  { key: 'stylematcher', label: 'Style Matcher', icon: Palette, color: '#FF6482', desc: '设计体系匹配 · 四维评分' },
  { key: 'critic', label: 'Design Critic', icon: Sparkles, color: '#FFD60A', desc: '设计评审 · 决策输出' },
  { key: 'planning', label: 'Planning Agent', icon: Brain, color: '#FF9500', desc: '架构规划 · 组件树' },
  { key: 'code', label: 'Code Agent', icon: Code2, color: '#34C759', desc: '代码生成 · React 项目' },
  { key: 'qa', label: 'Visual QA', icon: ShieldCheck, color: '#FF3B30', desc: '视觉评分 · 六维评价' },
  { key: 'optimize', label: 'Optimization', icon: Zap, color: '#0A84FF', desc: '优化方案 · 自动修复' },
  { key: 'deploy', label: 'Export Agent', icon: Download, color: '#64D2FF', desc: '信息导出 · 打包' },
];

const STAGE_ORDER = PIPELINE.map((p) => p.key);

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  running:   { label: '生成中', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20', dot: 'bg-blue-400 animate-pulse' },
  completed: { label: '成功',   cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' },
  error:     { label: '失败',   cls: 'bg-red-500/10 text-red-400 border-red-500/20', dot: 'bg-red-400' },
  cancelled: { label: '已取消', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-400' },
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const { data: genData } = usePoll<GenerationsResponse>('/api/admin/stats?section=generations', 2500);
  const { data: apiData } = usePoll<ApiCallsResponse>('/api/admin/stats?section=api-calls', 3000);

  const generation = genData?.generations.find((g) => g.id === taskId);
  const relatedCalls = (apiData?.calls ?? []).filter((c) => c.generationId === taskId);

  if (!generation) {
    return (
      <div className="space-y-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回任务列表
        </button>
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
          <p className="text-sm text-white/40">正在查找任务 {taskId}…</p>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[generation.status];
  const currentStageIdx = STAGE_ORDER.indexOf(generation.currentStage);
  const totalTokens = relatedCalls.reduce((s, c) => s + c.totalTokens, 0);
  const totalCost = relatedCalls.reduce((s, c) => s + c.cost, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> 返回任务列表
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white tracking-tight">Task #{generation.id.slice(-6)}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border ${meta.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-white/30 font-mono">{generation.url}</p>
        </div>
      </div>

      {/* Task meta cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetaCard label="用户" value={generation.user} />
        <MetaCard label="模型" value={generation.model} />
        <MetaCard label="耗时" value={generation.status === 'running' ? formatDuration(Date.now() - generation.startedAt) : formatDuration(generation.durationMs)} />
        <MetaCard label="Token" value={formatNumber(generation.tokens || totalTokens)} />
        <MetaCard label="还原度" value={generation.similarity ? `${generation.similarity.toFixed(1)}%` : '—'} />
      </div>

      {/* ─── Pipeline Debug View ─── */}
      <section>
        <h2 className="text-sm font-medium text-white/60 mb-5">Pipeline 链路</h2>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="space-y-0">
            {PIPELINE.map((stage, idx) => {
              const Icon = stage.icon;
              const stageCalls = relatedCalls.filter((c) => c.step === stage.key);
              const stageSuccess = stageCalls.filter((c) => c.status === 'success').length;
              const stageFailed = stageCalls.filter((c) => c.status === 'error').length;
              const stageTokens = stageCalls.reduce((s, c) => s + c.totalTokens, 0);
              const stageDuration = stageCalls.reduce((s, c) => s + c.durationMs, 0);

              // Determine stage state
              let stageState: 'done' | 'active' | 'pending' | 'error' = 'pending';
              if (generation.status === 'completed' || generation.status === 'cancelled') {
                stageState = idx <= currentStageIdx || generation.currentStage === 'done' ? 'done' : 'pending';
              } else if (generation.status === 'error') {
                stageState = idx < currentStageIdx ? 'done' : idx === currentStageIdx ? 'error' : 'pending';
              } else {
                // running
                stageState = idx < currentStageIdx ? 'done' : idx === currentStageIdx ? 'active' : 'pending';
              }
              if (stageFailed > 0) stageState = 'error';

              return (
                <div key={stage.key} className="relative flex gap-4">
                  {/* Vertical line */}
                  {idx < PIPELINE.length - 1 && (
                    <div className={`absolute left-[19px] top-[40px] bottom-0 w-px ${
                      stageState === 'done' ? 'bg-[#34C759]/30' : 'bg-white/[0.06]'
                    }`} />
                  )}

                  {/* Icon */}
                  <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                    stageState === 'done' ? 'border-[#34C759]/30 bg-[#34C759]/10' :
                    stageState === 'active' ? 'border-blue-500/30 bg-blue-500/10' :
                    stageState === 'error' ? 'border-[#FF3B30]/30 bg-[#FF3B30]/10' :
                    'border-white/[0.06] bg-white/[0.02]'
                  }`}>
                    {stageState === 'done' ? (
                      <CheckCircle2 className="w-4.5 h-4.5 text-[#34C759]" />
                    ) : stageState === 'error' ? (
                      <XCircle className="w-4.5 h-4.5 text-[#FF3B30]" />
                    ) : stageState === 'active' ? (
                      <Loader2 className="w-4.5 h-4.5 text-blue-400 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4 text-white/20" />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 pb-6 ${idx === PIPELINE.length - 1 ? 'pb-0' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-sm font-medium ${
                          stageState === 'pending' ? 'text-white/30' : 'text-white/80'
                        }`}>{stage.label}</span>
                        <span className="text-[10px] text-white/25">{stage.desc}</span>
                      </div>
                      {stageCalls.length > 0 && (
                        <span className="text-[10px] text-white/30 tabular-nums">
                          {formatDuration(stageDuration)} · {formatNumber(stageTokens)} tok
                        </span>
                      )}
                    </div>

                    {/* API call details */}
                    {stageCalls.length > 0 && (
                      <div className="mt-2.5 space-y-1.5">
                        {stageCalls.map((call) => (
                          <div key={call.id} className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${call.status === 'success' ? 'bg-[#34C759]' : 'bg-[#FF3B30]'}`} />
                            <span className="text-[11px] text-white/40 font-mono">{call.model}</span>
                            <span className="text-[11px] text-white/25 tabular-nums">{(call.durationMs / 1000).toFixed(1)}s</span>
                            <span className="text-[11px] text-white/25 tabular-nums">{formatNumber(call.totalTokens)} tok</span>
                            <span className="text-[11px] text-white/20 tabular-nums">¥{call.cost.toFixed(4)}</span>
                            {call.error && <span className="text-[10px] text-[#FF3B30]/70 truncate max-w-[200px]">{call.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Active indicator */}
                    {stageState === 'active' && stageCalls.length === 0 && (
                      <div className="mt-2 text-[11px] text-blue-400/60">等待模型响应…</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Error info */}
      {generation.error && (
        <section className="rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/[0.04] p-5">
          <h3 className="text-xs font-medium text-[#FF3B30] mb-2">错误信息</h3>
          <p className="text-sm text-white/60 font-mono">{generation.error}</p>
        </section>
      )}

      {/* Timeline */}
      <section>
        <h2 className="text-sm font-medium text-white/60 mb-4">时间线</h2>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
          <TimelineItem time={generation.startedAt} label="任务创建" desc={`${generation.user} 发起生成 → ${generation.url}`} />
          {relatedCalls.slice().reverse().map((c) => (
            <TimelineItem
              key={c.id}
              time={c.timestamp}
              label={`${c.step} ${c.status === 'success' ? '完成' : '失败'}`}
              desc={`${c.model} · ${(c.durationMs / 1000).toFixed(1)}s · ${formatNumber(c.totalTokens)} tokens`}
              isError={c.status === 'error'}
            />
          ))}
          {generation.completedAt && (
            <TimelineItem
              time={generation.completedAt}
              label={generation.status === 'completed' ? '生成完成' : generation.status === 'error' ? '生成失败' : '任务取消'}
              desc={generation.status === 'completed' ? `还原度 ${generation.similarity?.toFixed(1) ?? '—'}% · ${formatNumber(generation.tokens)} tokens` : generation.error || ''}
              isError={generation.status === 'error'}
              isSuccess={generation.status === 'completed'}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="text-sm font-medium text-white/80 truncate">{value}</div>
      <div className="text-[10px] text-white/30 mt-1">{label}</div>
    </div>
  );
}

function TimelineItem({ time, label, desc, isError, isSuccess }: {
  time: number; label: string; desc: string; isError?: boolean; isSuccess?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
        isError ? 'bg-[#FF3B30]' : isSuccess ? 'bg-[#34C759]' : 'bg-white/25'
      }`} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${isError ? 'text-[#FF3B30]/80' : 'text-white/60'}`}>{label}</span>
          <span className="text-[10px] text-white/20 tabular-nums">{formatClock(time)}</span>
        </div>
        {desc && <p className="text-[11px] text-white/30 mt-0.5 truncate">{desc}</p>}
      </div>
    </div>
  );
}
