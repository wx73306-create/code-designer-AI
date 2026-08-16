'use client';

import { Bot, Loader2, Globe, Eye, Palette, Sparkles, Brain, Code2, ShieldCheck, Download, Zap, MonitorPlay } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePoll, formatNumber } from '../use-admin-poll';

interface AgentStat {
  step: string;
  calls: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCost: number;
  status: 'idle' | 'healthy' | 'warning' | 'error';
}

interface AgentsResponse {
  agents: AgentStat[];
  health: { status: string; successRate: number; avgLatencyMs: number; totalCalls: number };
}

// 管线 Agent 元数据（含非模型调用的确定性 Agent）
const AGENT_META: Record<string, { name: string; icon: LucideIcon; color: string; desc: string; deterministic?: boolean }> = {
  browser: { name: 'Browser Agent', icon: Globe, color: '#0071E3', desc: '网页读取 · DOM/CSS 抓取', deterministic: true },
  vision: { name: 'Vision Agent', icon: Eye, color: '#AF52DE', desc: '视觉识别 · 设计系统分析' },
  stylematcher: { name: 'Style Matcher', icon: Palette, color: '#FF6482', desc: '设计体系匹配 · 四维评分', deterministic: true },
  critic: { name: 'Design Critic', icon: Sparkles, color: '#FFD60A', desc: '设计评审 · 决策输出' },
  planning: { name: 'Planning Agent', icon: Brain, color: '#FF9500', desc: '架构规划 · 组件树' },
  code: { name: 'Code Agent', icon: Code2, color: '#34C759', desc: '代码生成 · React 项目' },
  qa: { name: 'Visual QA', icon: ShieldCheck, color: '#FF3B30', desc: '视觉评分 · 六维评价' },
  optimize: { name: 'Optimization', icon: Zap, color: '#0A84FF', desc: '优化方案 · 自动修复' },
  deploy: { name: 'Export Agent', icon: Download, color: '#64D2FF', desc: '信息导出 · 打包', deterministic: true },
  preview: { name: 'Preview Agent', icon: MonitorPlay, color: '#30D158', desc: 'AI 预览生成 · 高保真' },
};

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  healthy: { label: 'Healthy', dot: 'bg-[#34C759]', text: 'text-[#34C759]' },
  warning: { label: 'Warning', dot: 'bg-[#FF9500]', text: 'text-[#FF9500]' },
  error: { label: 'Error', dot: 'bg-[#FF3B30]', text: 'text-[#FF3B30]' },
  idle: { label: 'Idle', dot: 'bg-white/25', text: 'text-white/40' },
};

export default function AgentsPage() {
  const { data } = usePoll<AgentsResponse>('/api/admin/stats?section=agents', 2500);
  const agentStats = data?.agents ?? [];
  const health = data?.health;

  // 合并：管线全部 Agent + 实际调用统计
  const statByStep = new Map(agentStats.map((a) => [a.step, a]));
  const roster = Object.keys(AGENT_META).map((step) => ({
    step,
    meta: AGENT_META[step],
    stat: statByStep.get(step),
  }));

  const totalCalls = agentStats.reduce((s, a) => s + a.calls, 0);
  const totalTokens = agentStats.reduce((s, a) => s + a.totalTokens, 0);
  const totalCost = agentStats.reduce((s, a) => s + a.totalCost, 0);
  const avgSuccess = agentStats.length
    ? Math.round(agentStats.reduce((s, a) => s + a.successRate, 0) / agentStats.length * 10) / 10
    : 100;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Agent 监控中心</h1>
          <p className="mt-1 text-sm text-white/30">八大 AI Agent 运行状态 · 调用次数 / 成功率 / 响应时间 / Token 消耗</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <Bot className="w-3.5 h-3.5 text-[#0071E3]" />
          <span className="text-xs text-white/50 tabular-nums">
            {health ? `整体成功率 ${health.successRate}% · 平均 ${(health.avgLatencyMs / 1000).toFixed(1)}s` : '…'}
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '模型调用总数', value: formatNumber(totalCalls) },
          { label: '平均成功率', value: `${avgSuccess}%` },
          { label: '累计 Token', value: formatNumber(totalTokens) },
          { label: '累计费用', value: `¥${totalCost.toFixed(2)}` },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
            <div className="text-2xl font-semibold text-white tabular-nums">{c.value}</div>
            <div className="mt-1 text-xs text-white/40">{c.label}</div>
          </div>
        ))}
      </div>

      {!data && (
        <div className="flex items-center gap-3 py-16 justify-center text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">正在加载 Agent 状态…</span>
        </div>
      )}

      {/* Agent grid */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roster.map(({ step, meta, stat }) => {
            const Icon = meta.icon;
            const status = meta.deterministic
              ? 'healthy'
              : stat
                ? stat.status
                : 'idle';
            const sm = STATUS_META[status];
            return (
              <div key={step} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 hover:bg-white/[0.045] transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-white/[0.08]"
                      style={{ backgroundColor: `${meta.color}1a` }}>
                      <Icon className="w-5 h-5" style={{ color: meta.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{meta.name}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">{meta.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${sm.dot} ${status === 'healthy' && !meta.deterministic ? 'animate-pulse' : ''}`} />
                    <span className={`text-[10px] font-medium ${sm.text}`}>
                      {meta.deterministic ? '确定性' : sm.label}
                    </span>
                  </div>
                </div>

                {meta.deterministic ? (
                  <div className="text-[11px] text-white/30 leading-relaxed py-2">
                    无模型调用 · 本地算法执行（毫秒级）
                  </div>
                ) : stat ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Metric label="调用次数" value={formatNumber(stat.calls)} />
                    <Metric label="成功率" value={`${stat.successRate}%`} valueClass={stat.successRate >= 90 ? 'text-[#34C759]' : stat.successRate >= 70 ? 'text-[#FF9500]' : 'text-[#FF3B30]'} />
                    <Metric label="平均响应" value={`${(stat.avgLatencyMs / 1000).toFixed(1)}s`} />
                    <Metric label="Token" value={formatNumber(stat.totalTokens)} />
                    <Metric label="费用" value={`¥${stat.totalCost.toFixed(2)}`} />
                  </div>
                ) : (
                  <div className="text-[11px] text-white/25 leading-relaxed py-2">
                    暂无调用记录
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className={`text-base font-semibold tabular-nums ${valueClass || 'text-white/80'}`}>{value}</div>
      <div className="text-[10px] text-white/35 mt-0.5">{label}</div>
    </div>
  );
}
