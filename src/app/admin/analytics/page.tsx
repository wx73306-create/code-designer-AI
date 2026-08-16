'use client';

import { Activity, Users, TrendingUp, Globe, Loader2, BarChart3 } from 'lucide-react';
import { usePoll, formatNumber, truncateUrl } from '../use-admin-poll';

interface Generation {
  id: string; user: string; url: string; goal: string;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  startedAt: number; similarity?: number;
}
interface UserRecord { name: string; email: string; lastActiveAt: number; generationCount: number; }

interface OverviewResponse {
  stats: { todayLogins: number; totalUsers: number; totalGenerations: number; successRate: number; pageVisits: number; onlineCount: number; };
  recentGenerations: Generation[];
}
interface GenerationsResponse { generations: Generation[]; }
interface UsersResponse { users: UserRecord[]; }

const GOAL_LABELS: Record<string, string> = {
  colors: '学习配色', layout: '学习排版', style: '学习风格',
  features: '学习特色', template: '构建模板', default: '标准生成',
};

const GOAL_COLORS: Record<string, string> = {
  colors: 'bg-rose-400', layout: 'bg-blue-400', style: 'bg-violet-400',
  features: 'bg-amber-400', template: 'bg-emerald-400', default: 'bg-white/40',
};

export default function AnalyticsPage() {
  const { data: overview } = usePoll<OverviewResponse>('/api/admin/stats?section=overview', 3000);
  const { data: genData } = usePoll<GenerationsResponse>('/api/admin/stats?section=generations', 3000);
  const { data: userData } = usePoll<UsersResponse>('/api/admin/stats?section=users', 3000);

  const stats = overview?.stats;
  const generations = genData?.generations ?? [];
  const users = userData?.users ?? [];

  // 目标分布
  const goalCounts = new Map<string, number>();
  for (const g of generations) goalCounts.set(g.goal, (goalCounts.get(g.goal) || 0) + 1);
  const goalRows = [...goalCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxGoal = goalRows[0]?.[1] || 1;

  // 热门网站
  const urlCounts = new Map<string, number>();
  for (const g of generations) {
    const host = g.url.replace(/^https?:\/\//, '').split('/')[0] || g.url;
    urlCounts.set(host, (urlCounts.get(host) || 0) + 1);
  }
  const topUrls = [...urlCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // 平均还原度
  const scored = generations.filter((g) => g.similarity);
  const avgSimilarity = scored.length
    ? scored.reduce((s, g) => s + (g.similarity || 0), 0) / scored.length
    : 0;

  const cards = [
    { label: '今日活跃用户', value: stats ? String(stats.todayLogins) : '—', icon: Activity, change: stats ? `${stats.onlineCount} 当前在线` : '' },
    { label: '累计用户', value: stats ? String(stats.totalUsers) : '—', icon: Users, change: stats ? `${formatNumber(stats.pageVisits)} 次页面访问` : '' },
    { label: '平均还原度', value: scored.length ? `${avgSimilarity.toFixed(1)}%` : '—', icon: TrendingUp, change: `${scored.length} 个已评分任务` },
    { label: '热门网站', value: topUrls[0] ? truncateUrl(topUrls[0][0], 14) : '—', icon: Globe, change: topUrls.length ? `Top ${topUrls.length} 站点` : '' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">数据分析</h1>
          <p className="mt-1 text-sm text-white/30">基于实时埋点数据的运营分析</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <BarChart3 className="w-3.5 h-3.5 text-[#0071E3]" />
          <span className="text-xs text-white/50 tabular-nums">{generations.length} 个任务样本</span>
        </div>
      </div>

      {!stats && (
        <div className="flex items-center gap-3 py-16 justify-center text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">正在加载分析数据…</span>
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.05]">
                  <div className="flex items-center gap-2 text-white/40">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs">{c.label}</span>
                  </div>
                  <div className="mt-2.5 text-2xl font-semibold text-white tabular-nums truncate">{c.value}</div>
                  <div className="mt-1 text-[11px] text-white/30">{c.change}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 目标分布 */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
              <h2 className="text-sm font-medium text-white mb-5">任务目标分布</h2>
              {goalRows.length === 0 ? (
                <p className="py-8 text-center text-xs text-white/30">暂无任务数据 — 前台发起生成后自动统计</p>
              ) : (
                <div className="space-y-4">
                  {goalRows.map(([goal, count]) => (
                    <div key={goal}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-white/60">{GOAL_LABELS[goal] || goal}</span>
                        <span className="text-xs text-white/40 tabular-nums">{count} 次</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${GOAL_COLORS[goal] || 'bg-white/40'} transition-all duration-700 ease-out`}
                          style={{ width: `${(count / maxGoal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 热门网站 + 活跃用户 */}
            <div className="space-y-6">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
                <h2 className="text-sm font-medium text-white mb-4">热门目标网站</h2>
                {topUrls.length === 0 ? (
                  <p className="py-4 text-center text-xs text-white/30">暂无数据</p>
                ) : (
                  <div className="space-y-2.5">
                    {topUrls.map(([host, count], i) => (
                      <div key={host} className="flex items-center gap-3">
                        <span className="w-5 text-xs text-white/25 tabular-nums">{i + 1}</span>
                        <Globe className="w-3.5 h-3.5 text-white/30 shrink-0" />
                        <span className="flex-1 text-xs text-white/70 font-mono truncate">{host}</span>
                        <span className="text-xs text-white/40 tabular-nums">{count} 次</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
                <h2 className="text-sm font-medium text-white mb-4">用户生成排行</h2>
                {users.length === 0 ? (
                  <p className="py-4 text-center text-xs text-white/30">暂无用户数据</p>
                ) : (
                  <div className="space-y-2.5">
                    {users.slice(0, 5).map((u) => (
                      <div key={u.email} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#0071E3]/15 flex items-center justify-center text-[10px] font-semibold text-[#0071E3] shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 text-xs text-white/70 truncate">{u.name}</span>
                        <span className="text-xs text-white/40 tabular-nums">{u.generationCount} 次生成</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
