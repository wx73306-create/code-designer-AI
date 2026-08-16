'use client';

import { Gauge, Loader2, Crown, AlertTriangle, TrendingUp } from 'lucide-react';
import { usePoll, formatTimeAgo, truncateUrl } from '../use-admin-poll';

interface FailureCase {
  id: string;
  url: string;
  user: string;
  overallScore?: number;
  premiumScore?: number;
  styleName?: string;
  problems: Array<{ type: string; description: string }>;
  timestamp: number;
}

interface QualityStats {
  totalEvaluated: number;
  avgScores: {
    overall: number; layout: number; balance: number;
    spacing: number; color: number; typography: number; premium: number;
  };
  avgRuleScore: number;
  styleDistribution: Array<{ name: string; count: number; percent: number }>;
  failureCases: FailureCase[];
}

interface QualityResponse {
  quality: QualityStats;
}

const DIM_LABELS: Array<{ key: keyof QualityStats['avgScores']; label: string; premium?: boolean }> = [
  { key: 'layout', label: '布局 Layout' },
  { key: 'balance', label: '视觉平衡 Balance' },
  { key: 'spacing', label: '空间 Spacing' },
  { key: 'color', label: '色彩 Color' },
  { key: 'typography', label: '字体 Typography' },
  { key: 'premium', label: '高级感 Premium', premium: true },
];

const STYLE_COLORS: Record<string, string> = {
  'Apple Style': '#0071E3',
  'Stripe Style': '#635BFF',
  'Linear Style': '#5E6AD2',
  'Tesla Style': '#E31837',
  'Luxury Style': '#B8860B',
  'SaaS Style': '#2563EB',
  'Gaming Style': '#00FF88',
};

function scoreColor(v: number): string {
  return v >= 90 ? '#34C759' : v >= 75 ? '#FF9500' : '#FF3B30';
}

export default function QualityPage() {
  const { data } = usePoll<QualityResponse>('/api/admin/stats?section=quality', 3000);
  const q = data?.quality;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">生成质量监控</h1>
          <p className="mt-1 text-sm text-white/30">六维视觉评分 · 风格匹配分布 · 失败案例库（用于 Prompt 优化）</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <Gauge className="w-3.5 h-3.5 text-[#AF52DE]" />
          <span className="text-xs text-white/50 tabular-nums">已评估 {q?.totalEvaluated ?? 0} 个生成项目</span>
        </div>
      </div>

      {!data && (
        <div className="flex items-center gap-3 py-16 justify-center text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">正在加载质量数据…</span>
        </div>
      )}

      {data && q && q.totalEvaluated === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] py-16 text-center">
          <Gauge className="w-8 h-8 text-white/15" />
          <p className="text-sm text-white/40">暂无质量评估数据</p>
          <p className="text-xs text-white/25">完成一次网页生成后，视觉评分 / 风格匹配 / 规则校验结果会实时汇入这里</p>
        </div>
      )}

      {data && q && q.totalEvaluated > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="平均综合分" value={q.avgScores.overall} suffix="/100" color={scoreColor(q.avgScores.overall)} />
            <SummaryCard label="平均高级感 ⭐" value={q.avgScores.premium} suffix="/100" color={scoreColor(q.avgScores.premium)} icon={Crown} />
            <SummaryCard label="平均规则符合度" value={q.avgRuleScore} suffix="/100" color={scoreColor(q.avgRuleScore)} />
            <SummaryCard label="失败案例" value={q.failureCases.length} suffix="个" color={q.failureCases.length > 0 ? '#FF9500' : '#34C759'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Six-dimension average scores */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="w-4 h-4 text-[#0071E3]" />
                <h3 className="text-sm font-medium text-white/80">六维视觉评分（均值）</h3>
              </div>
              <div className="space-y-4">
                {DIM_LABELS.map(({ key, label, premium }) => {
                  const value = q.avgScores[key];
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className={`text-xs w-32 shrink-0 ${premium ? 'font-semibold text-white/80' : 'text-white/45'}`}>
                        {label}{premium && ' ⭐'}
                      </span>
                      <div className="flex-1 h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${value}%`, backgroundColor: scoreColor(value) }} />
                      </div>
                      <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color: scoreColor(value) }}>
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Style match distribution */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
              <div className="flex items-center gap-2 mb-5">
                <Gauge className="w-4 h-4 text-[#AF52DE]" />
                <h3 className="text-sm font-medium text-white/80">风格匹配分布</h3>
              </div>
              {q.styleDistribution.length > 0 ? (
                <div className="space-y-3.5">
                  {q.styleDistribution.map((s) => {
                    const color = STYLE_COLORS[s.name] || '#888';
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-white/60">{s.name}</span>
                          <span className="text-xs text-white/40 tabular-nums">{s.percent}% · {s.count} 次</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${s.percent}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-white/25 py-8 text-center">暂无风格匹配数据</p>
              )}
            </div>
          </div>

          {/* Failure case library */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 mb-5">
              <AlertTriangle className="w-4 h-4 text-[#FF9500]" />
              <h3 className="text-sm font-medium text-white/80">失败案例库</h3>
              <span className="text-[11px] text-white/30 ml-auto">低分项目 · 可用于 Prompt 优化与 Fine-tuning</span>
            </div>
            {q.failureCases.length > 0 ? (
              <div className="space-y-3">
                {q.failureCases.map((c) => (
                  <div key={c.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-white/70 truncate">{truncateUrl(c.url, 40)}</span>
                        {c.styleName && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40 shrink-0">{c.styleName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        {c.premiumScore !== undefined && (
                          <span className="text-[10px] text-white/40">高级感 <span className="font-semibold" style={{ color: scoreColor(c.premiumScore) }}>{c.premiumScore}</span></span>
                        )}
                        {c.overallScore !== undefined && (
                          <span className="text-[10px] text-white/40">综合 <span className="font-semibold" style={{ color: scoreColor(c.overallScore) }}>{c.overallScore}</span></span>
                        )}
                        <span className="text-[10px] text-white/25">{formatTimeAgo(c.timestamp)}</span>
                      </div>
                    </div>
                    {c.problems.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {c.problems.slice(0, 4).map((p, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[#FF9500]/10 text-[#FF9500]/80 border border-[#FF9500]/15">
                            [{p.type}] {p.description}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/25 py-8 text-center">暂无失败案例，生成质量良好 ✓</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, suffix, color, icon: Icon }: {
  label: string; value: number; suffix: string; color: string; icon?: typeof Crown;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-4 h-4" style={{ color }} />}
        <span className="text-2xl font-semibold tabular-nums" style={{ color }}>{value}</span>
        <span className="text-sm text-white/30 font-medium">{suffix}</span>
      </div>
      <div className="mt-1 text-xs text-white/40">{label}</div>
    </div>
  );
}
