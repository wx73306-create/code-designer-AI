'use client';

import { Activity, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { usePoll, formatTimeAgo, formatNumber, truncateUrl } from '../use-admin-poll';

interface ApiCall {
  id: string;
  generationId?: string;
  step: string;
  model: string;
  targetUrl: string;
  status: 'success' | 'error';
  httpStatus?: number;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: number;
  error?: string;
}

interface ApiHealth {
  status: 'idle' | 'ok' | 'degraded';
  successRate: number;
  avgLatencyMs: number;
  totalCalls: number;
}

interface ApiCallsResponse {
  calls: ApiCall[];
  health: ApiHealth;
}

const STEP_LABELS: Record<string, string> = {
  vision: 'Vision 分析', planning: 'Planning 规划',
  code: 'Code 生成', qa: 'QA 检测', unknown: '未知',
};

export default function ApiCallsPage() {
  const { data } = usePoll<ApiCallsResponse>('/api/admin/stats?section=api-calls', 2500);
  const calls = data?.calls ?? [];
  const health = data?.health;

  const totalTokens = calls.reduce((s, c) => s + c.totalTokens, 0);
  const totalCost = calls.reduce((s, c) => s + c.cost, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">API 调用</h1>
          <p className="mt-1 text-sm text-white/30">MiMo 模型推理调用实时记录 · 服务端直采</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <Activity className="w-3.5 h-3.5 text-[#0071E3]" />
          <span className="text-xs text-white/50 tabular-nums">
            {health ? `成功率 ${health.successRate}% · 平均 ${(health.avgLatencyMs / 1000).toFixed(1)}s` : '…'}
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '总调用次数', value: health ? formatNumber(health.totalCalls) : '—' },
          { label: '累计 Token', value: formatNumber(totalTokens) },
          { label: '累计费用', value: `¥${totalCost.toFixed(2)}` },
          { label: '平均延迟', value: health?.avgLatencyMs ? `${(health.avgLatencyMs / 1000).toFixed(1)}s` : '—' },
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
          <span className="text-sm">正在加载调用记录…</span>
        </div>
      )}

      {data && calls.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] py-16 text-center">
          <Activity className="w-8 h-8 text-white/15" />
          <p className="text-sm text-white/40">暂无 API 调用记录</p>
          <p className="text-xs text-white/25">工作流调用 MiMo 模型时，每次请求都会实时记录在这里</p>
        </div>
      )}

      {calls.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3.5 font-medium text-white/40">时间</th>
                <th className="px-5 py-3.5 font-medium text-white/40">阶段</th>
                <th className="px-5 py-3.5 font-medium text-white/40">模型</th>
                <th className="px-5 py-3.5 font-medium text-white/40">目标网站</th>
                <th className="px-5 py-3.5 font-medium text-white/40">耗时</th>
                <th className="px-5 py-3.5 font-medium text-white/40">Token</th>
                <th className="px-5 py-3.5 font-medium text-white/40">费用</th>
                <th className="px-5 py-3.5 font-medium text-white/40">状态</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5 text-white/50 text-xs tabular-nums whitespace-nowrap">{formatTimeAgo(c.timestamp)}</td>
                  <td className="px-5 py-3.5 text-white/70 whitespace-nowrap">{STEP_LABELS[c.step] || c.step}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-white/70 font-mono whitespace-nowrap">{c.model}</span>
                  </td>
                  <td className="px-5 py-3.5 text-white/50 text-xs font-mono">{truncateUrl(c.targetUrl, 26)}</td>
                  <td className="px-5 py-3.5 text-white/70 tabular-nums whitespace-nowrap">{(c.durationMs / 1000).toFixed(1)}s</td>
                  <td className="px-5 py-3.5 text-white/70 tabular-nums whitespace-nowrap">
                    {formatNumber(c.promptTokens)} + {formatNumber(c.completionTokens)}
                  </td>
                  <td className="px-5 py-3.5 text-white/70 tabular-nums whitespace-nowrap">¥{c.cost.toFixed(4)}</td>
                  <td className="px-5 py-3.5">
                    {c.status === 'success' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400 whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3" /> {c.httpStatus}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400 whitespace-nowrap"
                        title={c.error}
                      >
                        <XCircle className="w-3 h-3" /> 失败
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
