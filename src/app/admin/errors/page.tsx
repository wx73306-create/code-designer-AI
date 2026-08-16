'use client';

import { AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { usePoll, formatTimeAgo, formatClock } from '../use-admin-poll';

interface ErrorRecord {
  id: string;
  source: string;
  message: string;
  context?: string;
  timestamp: number;
}

interface ErrorsResponse {
  errors: ErrorRecord[];
}

const SOURCE_LABELS: Record<string, string> = {
  'mimo-api': 'MiMo API',
  workflow: '生成工作流',
  frontend: '前端上报',
};

export default function ErrorsPage() {
  const { data } = usePoll<ErrorsResponse>('/api/admin/stats?section=errors', 3000);
  const errors = data?.errors ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">错误日志</h1>
          <p className="mt-1 text-sm text-white/30">系统异常实时捕获 · 每 3 秒刷新</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <AlertTriangle className="w-3.5 h-3.5 text-[#FF9F0A]" />
          <span className="text-xs text-white/50 tabular-nums">{data ? `${errors.length} 条记录` : '…'}</span>
        </div>
      </div>

      {!data && (
        <div className="flex items-center gap-3 py-16 justify-center text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">正在加载错误日志…</span>
        </div>
      )}

      {data && errors.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] py-16 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400/60" />
          <p className="text-sm text-emerald-300/80">系统运行正常，暂无错误记录</p>
          <p className="text-xs text-white/25">API 调用失败、工作流异常会实时记录在这里</p>
        </div>
      )}

      <div className="space-y-3">
        {errors.map((e) => (
          <div
            key={e.id}
            className="rounded-xl border border-red-500/15 bg-red-500/[0.03] p-5 transition-colors hover:bg-red-500/[0.05]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/60">
                    {SOURCE_LABELS[e.source] || e.source}
                  </span>
                </div>
              </div>
              <span className="text-xs text-white/30 tabular-nums whitespace-nowrap">
                {formatTimeAgo(e.timestamp)} · {formatClock(e.timestamp)}
              </span>
            </div>
            <p className="mt-3 text-sm text-red-300/90 font-mono break-all">{e.message}</p>
            {e.context && (
              <p className="mt-1.5 text-xs text-white/30 font-mono break-all">上下文: {e.context}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
