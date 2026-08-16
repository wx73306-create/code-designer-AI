'use client';

import { useEffect, useState } from 'react';
import {
  Users, Cpu, CheckCircle2, Clock, DollarSign, Wifi, Activity,
  Globe, Loader2, TrendingUp, TrendingDown, ArrowRight, Bot, Sparkles,
  Eye, Code2, ShieldCheck, Zap, Power, AlertTriangle,
} from 'lucide-react';
import { usePoll, formatDuration, formatNumber } from '../use-admin-poll';

// ---- Types ----

interface DashboardStats {
  serverTime: number;
  uptimeMs: number;
  generationEnabled: boolean;
  todayNewUsers: number;
  todayLogins: number;
  totalUsers: number;
  onlineCount: number;
  totalGenerations: number;
  todayGenerations: number;
  runningGenerations: number;
  todayCompleted: number;
  successRate: number;
  avgDurationMs: number;
  totalTokens: number;
  totalCost: number;
  todayApiCalls: number;
  totalApiCalls: number;
  errorCount24h: number;
  pageVisits: number;
  todayVisits: number;
  cpu: number;
  memory: { percent: number; usedGB: number; totalGB: number };
}

interface Generation {
  id: string;
  user: string;
  url: string;
  goal: string;
  model: string;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  currentStage: string;
  startedAt: number;
  durationMs?: number;
  tokens?: number;
  cost?: number;
  similarity?: number;
}

interface AgentStat {
  step: string;
  calls: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCost: number;
  status: 'idle' | 'healthy' | 'warning' | 'error';
}

interface QualityStats {
  totalEvaluated: number;
  avgScores: {
    overall: number;
    layout: number;
    balance: number;
    spacing: number;
    color: number;
    typography: number;
    premium: number;
  };
  styleDistribution: Array<{ name: string; count: number; percent: number }>;
}

interface OverviewResponse {
  stats: DashboardStats;
  recentGenerations: Generation[];
}

interface AgentsResponse {
  agents: AgentStat[];
}

interface QualityResponse {
  quality: QualityStats;
}

// ---- Pipeline stages ----

const PIPELINE_STAGES = [
  { key: 'browser', label: 'Browser', icon: Globe, color: '#0071E3' },
  { key: 'vision', label: 'Vision', icon: Eye, color: '#AF52DE' },
  { key: 'stylematcher', label: 'Style', icon: Sparkles, color: '#FF6482' },
  { key: 'critic', label: 'Critic', icon: Sparkles, color: '#FFD60A' },
  { key: 'planning', label: 'Planning', icon: Cpu, color: '#FF9500' },
  { key: 'code', label: 'Code', icon: Code2, color: '#34C759' },
  { key: 'qa', label: 'QA', icon: ShieldCheck, color: '#FF3B30' },
  { key: 'optimize', label: 'Optimize', icon: Zap, color: '#0A84FF' },
];

const STATUS_META: Record<Generation['status'], { label: string; cls: string; dot: string }> = {
  running:   { label: '生成中', cls: 'bg-blue-500/10 text-blue-400', dot: 'bg-blue-400 animate-pulse' },
  completed: { label: '成功',   cls: 'bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-400' },
  error:     { label: '失败',   cls: 'bg-red-500/10 text-red-400', dot: 'bg-red-400' },
  cancelled: { label: '已取消', cls: 'bg-amber-500/10 text-amber-400', dot: 'bg-amber-400' },
};

export default function DashboardPage() {
  const { data, lastUpdated } = usePoll<OverviewResponse>('/api/admin/stats?section=overview', 2500);
  const { data: agentsData } = usePoll<AgentsResponse>('/api/admin/stats?section=agents', 3000);
  const { data: qualityData } = usePoll<QualityResponse>('/api/admin/stats?section=quality', 5000);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const stats = data?.stats;
  const generations = data?.recentGenerations ?? [];
  const agents = agentsData?.agents ?? [];
  const quality = qualityData?.quality;

  // ---- 总控制开关 ----
  const [genEnabled, setGenEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);

  // 服务端状态同步到本地（轮询拉取）
  useEffect(() => {
    if (stats && !toggling) setGenEnabled(stats.generationEnabled);
  }, [stats?.generationEnabled, toggling]);

  async function toggleGeneration() {
    if (toggling) return;
    const next = !genEnabled;
    setToggling(true);
    setGenEnabled(next); // 乐观更新
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationEnabled: next }),
      });
      if (!res.ok) throw new Error('toggle failed');
    } catch {
      setGenEnabled(!next); // 失败回滚
    } finally {
      setToggling(false);
    }
  }

  // Build agent status map
  const agentByStep = new Map(agents.map((a) => [a.step, a]));

  // Task queue counts
  const runningTasks = generations.filter((g) => g.status === 'running');
  const analyzingCount = runningTasks.filter((g) => ['browser', 'vision', 'stylematcher'].includes(g.currentStage)).length;
  const generatingCount = runningTasks.filter((g) => ['planning', 'code'].includes(g.currentStage)).length;
  const optimizingCount = runningTasks.filter((g) => ['qa', 'optimize', 'critic'].includes(g.currentStage)).length;
  const failedCount = generations.filter((g) => g.status === 'error').length;

  return (
    <div className="space-y-10">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">System Overview</h1>
          <p className="mt-1.5 text-sm text-white/30">AI Agent 运营控制中心 · 30 秒掌握全局</p>
        </div>
        <div className="flex items-center gap-3">
          {/* ─── 总控制开关 ─── */}
          <button
            onClick={toggleGeneration}
            disabled={toggling}
            className={`group flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-full border transition-all cursor-pointer disabled:opacity-60 ${
              genEnabled
                ? 'bg-[#34C759]/10 border-[#34C759]/25 hover:bg-[#34C759]/15'
                : 'bg-[#FF9F0A]/10 border-[#FF9F0A]/25 hover:bg-[#FF9F0A]/15'
            }`}
            title={genEnabled ? '点击暂停网页生成服务' : '点击恢复网页生成服务'}
          >
            <Power className={`w-3.5 h-3.5 ${genEnabled ? 'text-[#34C759]' : 'text-[#FF9F0A]'}`} />
            <span className={`text-xs font-medium ${genEnabled ? 'text-[#34C759]' : 'text-[#FF9F0A]'}`}>
              {toggling ? '切换中…' : genEnabled ? '生成服务运行中' : '生成服务已暂停'}
            </span>
            {/* switch track */}
            <span className={`relative w-8 h-[18px] rounded-full transition-colors ${genEnabled ? 'bg-[#34C759]' : 'bg-white/15'}`}>
              <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all ${genEnabled ? 'left-[16px]' : 'left-[2px]'}`} />
            </span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34C759]" />
            </span>
            <span className="text-xs text-white/50 tabular-nums">
              {lastUpdated ? `${Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000))}s ago` : '连接中…'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 服务暂停警告横幅 ─── */}
      {!genEnabled && (
        <div className="flex items-center gap-3 rounded-xl border border-[#FF9F0A]/25 bg-[#FF9F0A]/[0.06] px-5 py-3.5">
          <AlertTriangle className="w-4 h-4 text-[#FF9F0A] shrink-0" />
          <span className="text-sm text-[#FF9F0A]/90">
            网页生成功能已<strong className="mx-1">暂停</strong>——前台「开始生成」按钮已禁用，所有 AI 生成请求将被拒绝。点击右上角开关即可恢复。
          </span>
        </div>
      )}

      {/* Loading */}
      {!stats && (
        <div className="flex items-center gap-3 py-24 justify-center text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">正在连接实时数据源…</span>
        </div>
      )}

      {stats && (
        <>
          {/* ─── Hero Metrics (Vercel-style big numbers) ─── */}
          <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
            <HeroMetric label="今日用户" value={String(stats.todayLogins)} sub={`+${stats.todayNewUsers} 新增`} icon={Users} />
            <HeroMetric label="今日访问" value={formatNumber(stats.todayVisits)} sub={`累计 ${formatNumber(stats.pageVisits)}`} icon={Eye} />
            <HeroMetric label="今日生成" value={String(stats.todayGenerations)} sub={`累计 ${stats.totalGenerations}`} icon={Cpu} />
            <HeroMetric label="成功率" value={`${stats.successRate}%`} sub={stats.successRate >= 90 ? '优秀' : '需关注'} icon={CheckCircle2} valueClass={stats.successRate >= 90 ? 'text-[#34C759]' : 'text-[#FF9F0A]'} />
            <HeroMetric label="平均耗时" value={formatDuration(stats.avgDurationMs)} sub="每次生成" icon={Clock} />
            <HeroMetric label="AI 成本" value={`¥${stats.totalCost.toFixed(2)}`} sub={`${formatNumber(stats.totalTokens)} tokens`} icon={DollarSign} />
            <HeroMetric label="异常" value={String(stats.errorCount24h)} sub="24h 内" icon={Activity} valueClass={stats.errorCount24h > 10 ? 'text-[#FF3B30]' : 'text-white'} />
          </section>

          {/* ─── AI Pipeline Status ─── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-white/60 flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#0071E3]" />
                AI Pipeline
              </h2>
              <span className="text-xs text-white/25 tabular-nums">{agents.length} agents 活跃</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {PIPELINE_STAGES.map(({ key, label, icon: Icon, color }) => {
                const agent = agentByStep.get(key);
                const status = agent?.status ?? 'idle';
                const isActive = status === 'healthy' || status === 'warning';
                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-4 transition-all duration-200 ${
                      isActive
                        ? 'border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.06]'
                        : 'border-white/[0.04] bg-white/[0.015]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <span className={`w-2 h-2 rounded-full ${
                        status === 'healthy' ? 'bg-[#34C759]' :
                        status === 'warning' ? 'bg-[#FF9F0A]' :
                        status === 'error' ? 'bg-[#FF3B30]' : 'bg-white/15'
                      } ${status === 'healthy' ? 'animate-pulse' : ''}`} />
                    </div>
                    <div className="text-xs font-medium text-white/70">{label}</div>
                    <div className="text-[10px] text-white/30 mt-1 tabular-nums">
                      {agent ? `${(agent.avgLatencyMs / 1000).toFixed(1)}s` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ─── Task Queue + Quality ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Queue */}
            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="text-sm font-medium text-white/60 mb-5">Generation Queue</h2>
              <div className="grid grid-cols-2 gap-4">
                <QueueItem label="正在分析" count={analyzingCount} color="text-blue-400" bg="bg-blue-500/10" />
                <QueueItem label="正在生成" count={generatingCount} color="text-violet-400" bg="bg-violet-500/10" />
                <QueueItem label="正在优化" count={optimizingCount} color="text-amber-400" bg="bg-amber-500/10" />
                <QueueItem label="失败" count={failedCount} color="text-red-400" bg="bg-red-500/10" />
              </div>
              {runningTasks.length > 0 && (
                <div className="mt-5 pt-4 border-t border-white/[0.06] space-y-2">
                  {runningTasks.slice(0, 3).map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-xs">
                      <span className="text-white/50 truncate max-w-[180px]">{g.user} → {g.url.replace(/^https?:\/\//, '').slice(0, 24)}</span>
                      <span className="text-blue-400/70 tabular-nums">{g.currentStage} · {formatDuration(Date.now() - g.startedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Quality Overview */}
            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-medium text-white/60">Generation Quality</h2>
                {quality && (
                  <span className="text-xs text-white/25 tabular-nums">{quality.totalEvaluated} 次评估</span>
                )}
              </div>
              {quality && quality.totalEvaluated > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <QualityBar label="Layout" score={quality.avgScores.layout} />
                    <QualityBar label="Color" score={quality.avgScores.color} />
                    <QualityBar label="Typography" score={quality.avgScores.typography} />
                    <QualityBar label="Spacing" score={quality.avgScores.spacing} />
                    <QualityBar label="Balance" score={quality.avgScores.balance} />
                    <QualityBar label="Premium" score={quality.avgScores.premium} highlight />
                  </div>
                  {quality.styleDistribution.length > 0 && (
                    <div className="pt-3 border-t border-white/[0.06]">
                      <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Style Distribution</div>
                      <div className="flex gap-2 flex-wrap">
                        {quality.styleDistribution.slice(0, 4).map((s) => (
                          <span key={s.name} className="px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] text-white/50">
                            {s.name} <span className="text-white/30">{s.percent}%</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Sparkles className="w-6 h-6 text-white/10" />
                  <p className="text-xs text-white/30">暂无质量评估数据</p>
                </div>
              )}
            </section>
          </div>

          {/* ─── Recent Tasks Table ─── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-white/60">Recent Tasks</h2>
              <a href="/admin/generations" className="text-xs text-[#0071E3] hover:text-[#0071E3]/80 flex items-center gap-1 transition-colors">
                查看全部 <ArrowRight className="w-3 h-3" />
              </a>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02]">
              {generations.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-14 text-center">
                  <Globe className="w-8 h-8 text-white/15" />
                  <p className="text-sm text-white/40">暂无生成任务</p>
                  <p className="text-xs text-white/25">在左侧前台预览中输入 URL 并发起生成，任务会实时出现在这里</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-5 py-3.5 font-medium text-white/35 text-xs">用户</th>
                      <th className="px-5 py-3.5 font-medium text-white/35 text-xs">目标网站</th>
                      <th className="px-5 py-3.5 font-medium text-white/35 text-xs">阶段</th>
                      <th className="px-5 py-3.5 font-medium text-white/35 text-xs">耗时</th>
                      <th className="px-5 py-3.5 font-medium text-white/35 text-xs">Token</th>
                      <th className="px-5 py-3.5 font-medium text-white/35 text-xs">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generations.slice(0, 8).map((g) => {
                      const meta = STATUS_META[g.status];
                      return (
                        <tr key={g.id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3 text-white/80 whitespace-nowrap text-xs">{g.user}</td>
                          <td className="px-5 py-3 text-white/50 font-mono text-[11px]">{g.url.replace(/^https?:\/\//, '').slice(0, 28)}</td>
                          <td className="px-5 py-3">
                            <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/50">{g.currentStage}</span>
                          </td>
                          <td className="px-5 py-3 text-white/50 tabular-nums text-xs whitespace-nowrap">
                            {g.status === 'running' ? (
                              <span className="text-blue-400">{formatDuration(Date.now() - g.startedAt)}</span>
                            ) : formatDuration(g.durationMs)}
                          </td>
                          <td className="px-5 py-3 text-white/50 tabular-nums text-xs">{g.tokens ? formatNumber(g.tokens) : '—'}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap ${meta.cls}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* ─── Footer Stats ─── */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-white/20 tabular-nums pt-2">
            <span>在线 {stats.onlineCount} 人</span>
            <span>页面访问 {formatNumber(stats.pageVisits)}</span>
            <span>API {stats.todayApiCalls} 今日 / {stats.totalApiCalls} 累计</span>
            <span>CPU {stats.cpu}% · 内存 {stats.memory.percent}%</span>
            <span>运行 {formatDuration(stats.uptimeMs)}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Sub Components ----

function HeroMetric({ label, value, sub, icon: Icon, valueClass }: {
  label: string; value: string; sub?: string; icon: React.ElementType; valueClass?: string;
}) {
  return (
    <div className="bg-[#0d1117] p-5 flex flex-col gap-3 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-white/25" />
        <span className="text-[11px] text-white/35">{label}</span>
      </div>
      <div className={`text-2xl font-semibold tabular-nums tracking-tight ${valueClass || 'text-white'}`}>{value}</div>
      {sub && <div className="text-[11px] text-white/25">{sub}</div>}
    </div>
  );
}

function QueueItem({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div className={`rounded-xl ${bg} p-4`}>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{count}</div>
      <div className="text-[11px] text-white/40 mt-1">{label}</div>
    </div>
  );
}

function QualityBar({ label, score, highlight }: { label: string; score: number; highlight?: boolean }) {
  const color = score >= 85 ? '#34C759' : score >= 70 ? '#FF9F0A' : '#FF3B30';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-white/35">{label}</span>
        <span className={`text-xs font-semibold tabular-nums ${highlight ? 'text-white' : 'text-white/60'}`}>{score || '—'}</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
