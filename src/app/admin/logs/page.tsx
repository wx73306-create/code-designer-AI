'use client';

import { useState } from 'react';
import { Terminal, Users, Bot, Server, Loader2, Filter, Search } from 'lucide-react';
import { usePoll, formatClock, formatTimeAgo } from '../use-admin-poll';

// ---- Types ----

interface SystemEvent {
  id: string;
  type: 'generation' | 'user' | 'api' | 'system' | 'error';
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

interface LiveSnapshot {
  recentEvents: SystemEvent[];
}

// ---- Constants ----

const TABS = [
  { key: 'all', label: '全部', icon: Terminal },
  { key: 'user', label: '用户日志', icon: Users },
  { key: 'generation', label: 'AI 日志', icon: Bot },
  { key: 'api', label: 'API 日志', icon: Server },
  { key: 'system', label: '系统日志', icon: Server },
  { key: 'error', label: '错误日志', icon: Filter },
] as const;

type TabKey = typeof TABS[number]['key'];

const LEVEL_META: Record<string, { dot: string; text: string; bg: string }> = {
  info:    { dot: 'bg-white/25', text: 'text-white/50', bg: 'bg-white/[0.02]' },
  success: { dot: 'bg-[#34C759]', text: 'text-[#34C759]', bg: 'bg-[#34C759]/[0.03]' },
  warning: { dot: 'bg-[#FF9F0A]', text: 'text-[#FF9F0A]', bg: 'bg-[#FF9F0A]/[0.03]' },
  error:   { dot: 'bg-[#FF3B30]', text: 'text-[#FF3B30]', bg: 'bg-[#FF3B30]/[0.04]' },
};

const TYPE_LABELS: Record<string, string> = {
  generation: 'AI 生成',
  user: '用户',
  api: 'API',
  system: '系统',
  error: '错误',
};

export default function LogsPage() {
  const { data } = usePoll<LiveSnapshot>('/api/admin/live', 2500);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const events = data?.recentEvents ?? [];

  // Filter by tab
  const filtered = events.filter((e) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'error') return e.level === 'error';
    return e.type === activeTab;
  });

  // Filter by search
  const searched = searchQuery
    ? filtered.filter((e) => e.message.toLowerCase().includes(searchQuery.toLowerCase()))
    : filtered;

  // Counts per tab
  const counts: Record<string, number> = { all: events.length };
  for (const e of events) {
    counts[e.type] = (counts[e.type] || 0) + 1;
    if (e.level === 'error') counts['error'] = (counts['error'] || 0) + 1;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">日志中心</h1>
          <p className="mt-1 text-sm text-white/30">用户行为 · AI 调用 · 系统事件 · 实时追踪</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34C759]" />
          </span>
          <span className="text-xs text-white/50 tabular-nums">{events.length} 条日志</span>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                activeTab === key
                  ? 'bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/15'
                  : 'text-white/40 hover:text-white/60 border border-transparent'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
              {counts[key] !== undefined && counts[key] > 0 && (
                <span className="text-[9px] tabular-nums opacity-60">{counts[key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索日志…"
            className="w-56 pl-9 pr-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-[#0071E3]/30 transition-colors"
          />
        </div>
      </div>

      {/* Log stream */}
      {!data ? (
        <div className="flex items-center gap-3 py-16 justify-center text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">正在加载日志…</span>
        </div>
      ) : searched.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <Terminal className="w-8 h-8 text-white/10" />
          <p className="text-sm text-white/40">{searchQuery ? '没有匹配的日志' : '暂无日志记录'}</p>
          <p className="text-xs text-white/25">前台的登录、生成、API 调用会实时出现在这里</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] bg-[#0a0d12] overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto divide-y divide-white/[0.03]">
            {searched.map((evt) => {
              const lm = LEVEL_META[evt.level];
              return (
                <div
                  key={evt.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors ${lm.bg}`}
                >
                  {/* Time */}
                  <span className="text-[11px] text-white/20 tabular-nums shrink-0 mt-px w-16">
                    {formatClock(evt.timestamp)}
                  </span>

                  {/* Level dot */}
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${lm.dot}`} />

                  {/* Type badge */}
                  <span className={`shrink-0 rounded px-1.5 py-px text-[10px] border border-white/[0.06] ${lm.text} mt-px`}>
                    {TYPE_LABELS[evt.type] || evt.type}
                  </span>

                  {/* Message */}
                  <span className={`text-xs leading-relaxed break-all ${lm.text}`}>
                    {evt.message}
                  </span>

                  {/* Relative time */}
                  <span className="ml-auto text-[10px] text-white/15 shrink-0 tabular-nums">
                    {formatTimeAgo(evt.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
