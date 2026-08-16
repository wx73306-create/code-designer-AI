'use client';

import { DollarSign, Calendar, UserCheck, FolderOpen, Loader2, Coins, TrendingUp, Users, Sparkles } from 'lucide-react';
import { usePoll, formatNumber } from '../use-admin-poll';

interface ApiCall {
  id: string;
  generationId?: string;
  step: string;
  model: string;
  status: 'success' | 'error';
  totalTokens: number;
  cost: number;
  timestamp: number;
}

interface ApiCallsResponse {
  calls: ApiCall[];
}

interface OverviewResponse {
  stats: { totalCost: number; totalGenerations: number; totalUsers: number; todayApiCalls: number; todayGenerations: number; successRate: number };
}

interface UsersResponse {
  users: Array<{ name: string; email: string; generationCount: number; loginCount: number }>;
}

// ---- Pricing tiers ----

const TIERS = [
  { name: '免费用户', quota: '每日 2 次', costPerGen: 0.08, color: '#6B7280' },
  { name: '专业用户', quota: '100 次/月', costPerGen: 0.06, color: '#0071E3' },
  { name: '企业用户', quota: '无限', costPerGen: 0.04, color: '#AF52DE' },
];

export default function CostsPage() {
  const { data } = usePoll<ApiCallsResponse>('/api/admin/stats?section=api-calls', 3000);
  const { data: overview } = usePoll<OverviewResponse>('/api/admin/stats?section=overview', 3000);
  const { data: usersData } = usePoll<UsersResponse>('/api/admin/stats?section=users', 5000);

  const calls = data?.calls ?? [];
  const users = usersData?.users ?? [];
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const totalCost = calls.reduce((s, c) => s + c.cost, 0);
  const todayCost = calls.filter((c) => c.timestamp >= todayStart.getTime()).reduce((s, c) => s + c.cost, 0);
  const totalTokens = calls.reduce((s, c) => s + c.totalTokens, 0);
  const genCount = overview?.stats.totalGenerations || 0;
  const userCount = overview?.stats.totalUsers || 0;
  const todayGens = overview?.stats.todayGenerations || 0;

  // Per-user cost
  const avgCostPerUser = userCount > 0 ? totalCost / userCount : 0;
  const avgCostPerGen = genCount > 0 ? totalCost / genCount : 0;

  // By model aggregation
  const byModel = new Map<string, { calls: number; tokens: number; cost: number }>();
  for (const c of calls) {
    const agg = byModel.get(c.model) || { calls: 0, tokens: 0, cost: 0 };
    agg.calls++; agg.tokens += c.totalTokens; agg.cost += c.cost;
    byModel.set(c.model, agg);
  }
  const modelRows = [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);

  // By step aggregation
  const byStep = new Map<string, { calls: number; tokens: number; cost: number }>();
  for (const c of calls) {
    const agg = byStep.get(c.step) || { calls: 0, tokens: 0, cost: 0 };
    agg.calls++; agg.tokens += c.totalTokens; agg.cost += c.cost;
    byStep.set(c.step, agg);
  }
  const stepRows = [...byStep.entries()].sort((a, b) => b[1].cost - a[1].cost);

  // Top cost users
  const userCosts = users
    .filter((u) => u.generationCount > 0)
    .map((u) => ({ ...u, estimatedCost: u.generationCount * avgCostPerGen }))
    .sort((a, b) => b.estimatedCost - a.estimatedCost)
    .slice(0, 8);

  const summary = [
    { label: '今日费用', value: `¥${todayCost.toFixed(4)}`, icon: DollarSign, sub: `${todayGens} 次生成` },
    { label: '累计费用', value: `¥${totalCost.toFixed(4)}`, icon: Calendar, sub: `${formatNumber(totalTokens)} tokens` },
    { label: '平均每用户', value: userCount ? `¥${avgCostPerUser.toFixed(4)}` : '—', icon: UserCheck, sub: `${userCount} 用户` },
    { label: '平均每任务', value: genCount ? `¥${avgCostPerGen.toFixed(4)}` : '—', icon: FolderOpen, sub: `${genCount} 任务` },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">成本分析</h1>
          <p className="mt-1 text-sm text-white/30">API 调用费用 · 单用户成本 · 免费策略评估</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-white/50 tabular-nums">¥0.002 / 1K tokens</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.05]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                  <Icon className="h-[18px] w-[18px] text-amber-400" />
                </div>
                <div>
                  <div className="text-xl font-semibold text-white tabular-nums">{s.value}</div>
                  <div className="mt-0.5 text-xs text-white/40">{s.label} <span className="text-white/20 ml-1">{s.sub}</span></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By model */}
        <section>
          <h2 className="mb-4 text-sm font-medium text-white/60">按模型费用</h2>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {!data ? (
              <div className="flex items-center gap-3 py-12 justify-center text-white/30">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">加载中…</span>
              </div>
            ) : modelRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Coins className="w-6 h-6 text-white/10" />
                <p className="text-xs text-white/30">暂无费用记录</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {modelRows.map(([model, agg]) => (
                  <div key={model} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-white/60 font-mono">{model}</span>
                      <span className="text-[11px] text-white/30 tabular-nums">{agg.calls} 次</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-white/30 tabular-nums">{formatNumber(agg.tokens)} tok</span>
                      <span className="text-xs text-amber-300 tabular-nums font-medium">¥{agg.cost.toFixed(4)}</span>
                      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400/60" style={{ width: totalCost > 0 ? `${(agg.cost / totalCost) * 100}%` : '0%' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* By pipeline step */}
        <section>
          <h2 className="mb-4 text-sm font-medium text-white/60">按管线阶段费用</h2>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {stepRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <TrendingUp className="w-6 h-6 text-white/10" />
                <p className="text-xs text-white/30">暂无数据</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {stepRows.map(([step, agg]) => (
                  <div key={step} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/60 capitalize">{step}</span>
                      <span className="text-[11px] text-white/30 tabular-nums">{agg.calls} 次</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-white/30 tabular-nums">{formatNumber(agg.tokens)} tok</span>
                      <span className="text-xs text-amber-300 tabular-nums font-medium">¥{agg.cost.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Per-user cost analysis */}
      <section>
        <h2 className="mb-4 text-sm font-medium text-white/60">用户成本排行</h2>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {userCosts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Users className="w-6 h-6 text-white/10" />
              <p className="text-xs text-white/30">暂无用户生成数据</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-3.5 font-medium text-white/35 text-xs">用户</th>
                  <th className="px-5 py-3.5 font-medium text-white/35 text-xs">生成次数</th>
                  <th className="px-5 py-3.5 font-medium text-white/35 text-xs">估算成本</th>
                  <th className="px-5 py-3.5 font-medium text-white/35 text-xs">占比</th>
                </tr>
              </thead>
              <tbody>
                {userCosts.map((u) => (
                  <tr key={u.email} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <div className="text-xs text-white/70">{u.name}</div>
                      <div className="text-[10px] text-white/25">{u.email}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-white/50 tabular-nums">{u.generationCount} 次</td>
                    <td className="px-5 py-3 text-xs text-amber-300 tabular-nums">¥{u.estimatedCost.toFixed(4)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400/50" style={{ width: totalCost > 0 ? `${(u.estimatedCost / totalCost) * 100}%` : '0%' }} />
                        </div>
                        <span className="text-[10px] text-white/30 tabular-nums">
                          {totalCost > 0 ? `${((u.estimatedCost / totalCost) * 100).toFixed(0)}%` : '—'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Pricing strategy */}
      <section>
        <h2 className="mb-4 text-sm font-medium text-white/60 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          免费策略评估
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map((tier) => (
            <div key={tier.name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tier.color }} />
                <span className="text-sm font-medium text-white/80">{tier.name}</span>
              </div>
              <div className="space-y-2 text-xs text-white/40">
                <div className="flex justify-between">
                  <span>额度</span>
                  <span className="text-white/60">{tier.quota}</span>
                </div>
                <div className="flex justify-between">
                  <span>单次成本</span>
                  <span className="text-white/60 tabular-nums">¥{tier.costPerGen.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>月均成本/用户</span>
                  <span className="text-amber-300 tabular-nums">
                    ¥{(tier.name === '免费用户' ? tier.costPerGen * 2 * 30 : tier.name === '专业用户' ? tier.costPerGen * 100 : tier.costPerGen * 500).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.06]">
                <p className="text-[10px] text-white/25 leading-relaxed">
                  {tier.name === '免费用户' && '当前免费策略：每日 2 次体验。单用户月成本约 ¥4.8，可通过广告或转化覆盖。'}
                  {tier.name === '专业用户' && '专业用户月费 ¥49 可覆盖 ¥6 成本，毛利率约 87%。'}
                  {tier.name === '企业用户' && '企业定制方案，按量计费或包年，成本可进一步压缩。'}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-white/20">费用按 ¥0.002 / 1K tokens 估算 · 实际成本取决于模型定价和 Token 用量</p>
      </section>
    </div>
  );
}
