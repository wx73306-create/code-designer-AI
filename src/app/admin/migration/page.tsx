'use client';

import { GitBranch, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { usePoll } from '../use-admin-poll';
import { deprecateReadiness, type MigrationSummary } from '@/lib/migration/observe';

interface MigrationResponse {
  migration: MigrationSummary;
}

/** 覆盖率的展示：null 表示「没有可观测样本」，不能显示成 0%。 */
function formatPercent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function DistributionBar({
  segments,
}: {
  segments: Array<{ label: string; count: number; dot: string; bar: string }>;
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  return (
    <div className="space-y-3">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-white/[0.06]">
        {total > 0 &&
          segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <div key={s.label} className={s.bar} style={{ width: `${(s.count / total) * 100}%` }} />
            ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            <span className="text-white/40">{s.label}</span>
            <span className="text-white/70 tabular-nums">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MigrationPage() {
  const { data } = usePoll<MigrationResponse>('/api/admin/stats?section=migration', 5000);
  const m = data?.migration;
  const readiness = m ? deprecateReadiness(m) : null;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">迁移观察</h1>
          <p className="mt-1 text-sm text-white/30">
            B.2 契约 §6 第三阶段 · 统计口径为「已完成」的生成任务
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <GitBranch className="w-3.5 h-3.5 text-[#0071E3]" />
          <span className="text-xs text-white/50">Phase 3 · Observe</span>
        </div>
      </div>

      {!m && (
        <div className="flex items-center gap-3 py-16 justify-center text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">正在统计迁移状态…</span>
        </div>
      )}

      {m && (
        <>
          {/* 概览 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: '可观测样本',
                value: String(m.total),
                tone: 'text-white',
                hint: m.total === 0 ? '还没有已完成的生成任务' : '已完成的任务数',
              },
              {
                label: '质量分新字段覆盖率',
                value: formatPercent(m.quality.coverage),
                tone: m.quality.coverage === 1 ? 'text-emerald-400' : 'text-amber-400',
                hint: 'null 也计入 —— 它证明字段在生产',
              },
              {
                label: '还原度覆盖率',
                value: formatPercent(m.reconstruction.coverage),
                tone: m.reconstruction.coverage === 1 ? 'text-emerald-400' : 'text-amber-400',
                hint: '没有历史兜底字段',
              },
              {
                label: '双写漂移',
                value: String(m.drift.mismatch),
                tone: m.drift.mismatch > 0 ? 'text-[#FF3B30]' : 'text-emerald-400',
                hint: `${m.drift.comparable} 条记录可比`,
              },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.05]"
              >
                <div className="text-xs text-white/40">{c.label}</div>
                <div className={`mt-2.5 text-2xl font-semibold tabular-nums ${c.tone}`}>
                  {c.value}
                </div>
                <div className="mt-1 text-[11px] text-white/30">{c.hint}</div>
              </div>
            ))}
          </div>

          {/* 构成 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
              <h2 className="text-sm font-medium text-white mb-1">质量分字段构成</h2>
              <p className="text-[11px] text-white/30 mb-5">
                legacyOnly 是尚未迁移的历史数据（只有 similarity）
              </p>
              <DistributionBar
                segments={[
                  { label: '新字段有值', count: m.quality.measured, dot: 'bg-emerald-400', bar: 'bg-emerald-400/70' },
                  { label: '不可得（null）', count: m.quality.unavailable, dot: 'bg-amber-400', bar: 'bg-amber-400/70' },
                  { label: '仅历史字段', count: m.quality.legacyOnly, dot: 'bg-blue-400', bar: 'bg-blue-400/70' },
                  { label: '无评分', count: m.quality.none, dot: 'bg-white/30', bar: 'bg-white/20' },
                ]}
              />
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
              <h2 className="text-sm font-medium text-white mb-1">还原度字段构成</h2>
              <p className="text-[11px] text-white/30 mb-5">
                还原度没有历史兜底，missing 即开关未开或老客户端
              </p>
              <DistributionBar
                segments={[
                  { label: '新字段有值', count: m.reconstruction.measured, dot: 'bg-emerald-400', bar: 'bg-emerald-400/70' },
                  { label: '不可得（null）', count: m.reconstruction.unavailable, dot: 'bg-amber-400', bar: 'bg-amber-400/70' },
                  { label: '未采集', count: m.reconstruction.missing, dot: 'bg-white/30', bar: 'bg-white/20' },
                ]}
              />
            </div>
          </div>

          {/* Phase 4 闸门 */}
          {readiness && (
            <div
              className={`rounded-xl border p-5 ${
                readiness.kind === 'ready'
                  ? 'border-[#34C759]/20 bg-[#34C759]/[0.04]'
                  : 'border-amber-500/20 bg-amber-500/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {readiness.kind === 'ready' ? (
                  <ShieldCheck className="w-4 h-4 text-[#34C759]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <h3
                  className={`text-xs font-medium ${
                    readiness.kind === 'ready' ? 'text-[#34C759]' : 'text-amber-400'
                  }`}
                >
                  Phase 4（停止生产 similarity）准入
                </h3>
              </div>
              <p className="text-sm text-white/60">
                {readiness.kind === 'ready'
                  ? '观察数据满足准入条件：新字段已全覆盖，且双写无漂移。'
                  : readiness.reason}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
