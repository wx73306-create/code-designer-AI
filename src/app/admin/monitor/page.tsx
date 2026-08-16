'use client';

import { useEffect, useState } from 'react';
import {
  Cpu, HardDrive, Server, Activity, Wifi, Terminal, Loader2, Users, Zap,
  Globe, Database, Layers, CheckCircle2, AlertTriangle, XCircle, Eye,
} from 'lucide-react';
import { usePoll, formatDuration, formatClock, formatNumber } from '../use-admin-poll';

// ---- Types ----

interface LiveSnapshot {
  serverTime: number;
  uptimeMs: number;
  cpu: number;
  memory: { percent: number; usedGB: number; totalGB: number; heapUsedMB: number; rssMB: number };
  loadAvg: number[];
  platform: string;
  nodeVersion: string;
  onlineCount: number;
  pageVisits: number;
  todayVisits: number;
  runningGenerations: Array<{ id: string; user: string; url: string; stage: string; elapsedMs: number }>;
  queueLength: number;
  recentEvents: Array<{ id: string; type: string; message: string; level: 'info' | 'success' | 'warning' | 'error'; timestamp: number }>;
  apiHealth: { status: 'idle' | 'ok' | 'degraded'; successRate: number; avgLatencyMs: number; totalCalls: number };
}

// ---- Service definitions ----

const SERVICES = [
  { key: 'frontend', name: 'Frontend', desc: 'Next.js 前端服务', icon: Globe },
  { key: 'backend', name: 'Backend API', desc: 'API Routes 后端', icon: Server },
  { key: 'database', name: 'Database', desc: 'Prisma + SQLite', icon: Database },
  { key: 'ai', name: 'AI Service', desc: 'MiMo API 推理', icon: Zap },
  { key: 'queue', name: 'Task Queue', desc: '生成任务队列', icon: Layers },
  { key: 'storage', name: 'Storage', desc: '文件系统存储', icon: HardDrive },
] as const;

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-white/50',
  success: 'text-[#34C759]',
  warning: 'text-[#FF9F0A]',
  error: 'text-[#FF3B30]',
};

const TYPE_LABELS: Record<string, string> = {
  generation: '生成',
  user: '用户',
  api: 'API',
  system: '系统',
  error: '错误',
};

function PulsingDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#34C759]" />
    </span>
  );
}

function ProgressBar({ percent, danger }: { percent: number; danger?: boolean }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${danger ? 'bg-[#FF3B30]' : percent > 70 ? 'bg-[#FF9F0A]' : 'bg-[#0071E3]'}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export default function MonitorPage() {
  const { data } = usePoll<LiveSnapshot>('/api/admin/live', 2000);
  const [lastCheck, setLastCheck] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setLastCheck((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { setLastCheck(0); }, [data?.serverTime]);

  const apiStatus = data?.apiHealth.status ?? 'idle';

  // Derive service statuses
  const getServiceStatus = (key: string): { status: 'online' | 'degraded' | 'offline'; label: string } => {
    if (!data) return { status: 'offline', label: '检测中' };
    switch (key) {
      case 'frontend': return { status: 'online', label: 'Online' };
      case 'backend': return { status: 'online', label: 'Online' };
      case 'database': return { status: 'online', label: 'Healthy' };
      case 'ai': return apiStatus === 'ok' ? { status: 'online', label: 'Running' } : apiStatus === 'degraded' ? { status: 'degraded', label: 'Degraded' } : { status: 'online', label: 'Idle' };
      case 'queue': return data.queueLength > 5 ? { status: 'degraded', label: 'Busy' } : { status: 'online', label: 'Healthy' };
      case 'storage': return { status: 'online', label: 'Healthy' };
      default: return { status: 'online', label: 'Online' };
    }
  };

  return (
    <div className="space-y-8">
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">系统监控</h1>
          <p className="mt-1 text-sm text-white/30">服务状态 · 资源使用 · AI 服务 · 实时事件</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <PulsingDot />
          <span className="text-xs text-white/50">实时刷新 · 2s</span>
        </div>
      </div>

      {!data && (
        <div className="flex items-center gap-3 py-16 justify-center text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">正在连接实时监控…</span>
        </div>
      )}

      {data && (
        <>
          {/* ---- Service Status Matrix ---- */}
          <section>
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">服务状态</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {SERVICES.map(({ key, name, desc, icon: Icon }) => {
                const { status, label } = getServiceStatus(key);
                return (
                  <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                        <Icon className="w-4 h-4 text-white/40" />
                      </div>
                      {status === 'online' ? (
                        <CheckCircle2 className="w-4 h-4 text-[#34C759]" />
                      ) : status === 'degraded' ? (
                        <AlertTriangle className="w-4 h-4 text-[#FF9F0A]" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#FF3B30]" />
                      )}
                    </div>
                    <div className="text-xs font-medium text-white/70">{name}</div>
                    <div className="text-[10px] text-white/25 mt-0.5">{desc}</div>
                    <div className={`mt-2 text-[10px] font-medium ${
                      status === 'online' ? 'text-[#34C759]' : status === 'degraded' ? 'text-[#FF9F0A]' : 'text-[#FF3B30]'
                    }`}>{label}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---- System Resources ---- */}
          <section>
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">系统资源</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CPU */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col gap-4 transition-colors hover:bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                      <Cpu className="w-4 h-4 text-white/40" />
                    </div>
                    <span className="text-xs text-white/50">CPU 使用率</span>
                  </div>
                  <span className="text-lg font-semibold text-white tabular-nums">
                    {data.cpu}<span className="text-xs text-white/30 ml-0.5">%</span>
                  </span>
                </div>
                <ProgressBar percent={data.cpu} danger={data.cpu > 85} />
              </div>

              {/* Memory */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col gap-4 transition-colors hover:bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                      <HardDrive className="w-4 h-4 text-white/40" />
                    </div>
                    <span className="text-xs text-white/50">内存使用率</span>
                  </div>
                  <span className="text-lg font-semibold text-white tabular-nums">
                    {data.memory.percent}<span className="text-xs text-white/30 ml-0.5">%</span>
                  </span>
                </div>
                <ProgressBar percent={data.memory.percent} danger={data.memory.percent > 85} />
                <p className="text-[11px] text-white/25 tabular-nums -mt-2">
                  {data.memory.usedGB} / {data.memory.totalGB} GB · Node 堆 {data.memory.heapUsedMB} MB
                </p>
              </div>

              {/* Node process */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                      <Server className="w-4 h-4 text-white/40" />
                    </div>
                    <span className="text-xs text-white/50">Node 进程</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34C759]" />
                    </span>
                    <span className="text-sm font-medium text-[#34C759]">正常</span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-white/30 tabular-nums leading-relaxed">
                  {data.nodeVersion} · RSS {data.memory.rssMB} MB<br />
                  负载 {data.loadAvg.join(' / ')} · 运行 {formatDuration(data.uptimeMs)}
                </p>
              </div>

              {/* Online users */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                      <Users className="w-4 h-4 text-white/40" />
                    </div>
                    <span className="text-xs text-white/50">在线用户 (5min)</span>
                  </div>
                  <span className="text-lg font-semibold text-white tabular-nums">{data.onlineCount}</span>
                </div>
                <p className="mt-3 text-[11px] text-white/30">{data.platform}</p>
              </div>

              {/* Page visits */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                      <Eye className="w-4 h-4 text-white/40" />
                    </div>
                    <span className="text-xs text-white/50">今日网页访问</span>
                  </div>
                  <span className="text-lg font-semibold text-white tabular-nums">{formatNumber(data.todayVisits)}</span>
                </div>
                <p className="mt-3 text-[11px] text-white/30 tabular-nums">累计访问 {formatNumber(data.pageVisits)} 次</p>
              </div>
            </div>
          </section>

          {/* ---- AI Service Status ---- */}
          <section>
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">AI 服务状态</h2>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <Activity className="w-4 h-4 text-white/40" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">MiMo API</p>
                    <p className="text-[11px] text-white/30">模型推理服务</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    apiStatus === 'ok' ? 'bg-[#34C759]' : apiStatus === 'degraded' ? 'bg-[#FF9F0A]' : 'bg-white/30'
                  } ${apiStatus !== 'idle' ? 'animate-pulse' : ''}`} />
                  <span className={`text-xs font-medium ${
                    apiStatus === 'ok' ? 'text-[#34C759]' : apiStatus === 'degraded' ? 'text-[#FF9F0A]' : 'text-white/40'
                  }`}>
                    {apiStatus === 'ok' ? 'Running' : apiStatus === 'degraded' ? 'Degraded' : 'Idle'}
                  </span>
                </div>
              </div>

              {/* Success rate bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-white/30">近 20 次调用成功率</span>
                  <span className="text-[11px] text-white/50 tabular-nums">{data.apiHealth.successRate}%</span>
                </div>
                <ProgressBar percent={data.apiHealth.successRate} danger={data.apiHealth.successRate < 80} />
              </div>

              <div className="border-t border-white/[0.06]" />

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white/40" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium tabular-nums">{data.apiHealth.avgLatencyMs ? `${(data.apiHealth.avgLatencyMs / 1000).toFixed(1)}s` : '—'}</p>
                    <p className="text-[11px] text-white/30">平均延迟</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <Server className="w-4 h-4 text-white/40" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium tabular-nums">{data.queueLength}</p>
                    <p className="text-[11px] text-white/30">任务排队中</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <Wifi className="w-4 h-4 text-white/40" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium tabular-nums">{lastCheck} 秒前</p>
                    <p className="text-[11px] text-white/30">上次检查</p>
                  </div>
                </div>
              </div>

              {/* Running tasks */}
              {data.runningGenerations.length > 0 && (
                <>
                  <div className="border-t border-white/[0.06]" />
                  <div className="space-y-2">
                    {data.runningGenerations.map((g) => (
                      <div key={g.id} className="flex items-center justify-between rounded-lg bg-blue-500/[0.06] border border-blue-500/15 px-3.5 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                          <span className="text-xs text-blue-300 truncate">
                            {g.user} → <span className="font-mono">{g.url.replace(/^https?:\/\//, '').slice(0, 30)}</span>
                          </span>
                        </div>
                        <span className="text-[11px] text-blue-400/70 tabular-nums shrink-0 ml-3">
                          {g.stage} · {formatDuration(g.elapsedMs)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ---- Live Event Stream ---- */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5" />
                实时事件流
              </h2>
              <span className="text-[11px] text-white/25 tabular-nums">{data.recentEvents.length} 条事件</span>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#0a0d12] overflow-hidden">
              {data.recentEvents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Terminal className="w-6 h-6 text-white/10" />
                  <p className="text-xs text-white/30">暂无事件 — 前台的登录、生成、API 调用会实时出现在这里</p>
                </div>
              ) : (
                <div className="max-h-[360px] overflow-y-auto p-4 space-y-1 font-mono">
                  {data.recentEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-start gap-3 rounded-md px-2.5 py-1.5 text-xs leading-relaxed hover:bg-white/[0.03] transition-colors"
                    >
                      <span className="text-white/25 tabular-nums shrink-0">{formatClock(evt.timestamp)}</span>
                      <span className={`shrink-0 rounded px-1.5 py-px text-[10px] border border-white/[0.08] ${LEVEL_COLORS[evt.level]}`}>
                        {TYPE_LABELS[evt.type] || evt.type}
                      </span>
                      <span className={`${LEVEL_COLORS[evt.level]} break-all`}>{evt.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
