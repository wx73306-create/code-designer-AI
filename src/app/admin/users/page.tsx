'use client';

import { ShieldCheck, User as UserIcon, Loader2, Wifi } from 'lucide-react';
import { usePoll, formatTimeAgo, formatClock } from '../use-admin-poll';

interface UserRecord {
  name: string;
  email: string;
  isAdmin: boolean;
  firstSeenAt: number;
  lastActiveAt: number;
  loginCount: number;
  generationCount: number;
}

interface UsersResponse {
  users: UserRecord[];
  onlineCount: number;
}

export default function UsersPage() {
  const { data } = usePoll<UsersResponse>('/api/admin/stats?section=users', 3000);
  const users = data?.users ?? [];
  const onlineCutoff = Date.now() - 5 * 60 * 1000;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">用户管理</h1>
          <p className="mt-1 text-sm text-white/30">已登录用户实时状态 · 每 3 秒刷新</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <Wifi className="w-3.5 h-3.5 text-[#34C759]" />
          <span className="text-xs text-white/50 tabular-nums">{data ? `${data.onlineCount} 在线` : '…'}</span>
        </div>
      </div>

      {!data && (
        <div className="flex items-center gap-3 py-16 justify-center text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">正在加载用户数据…</span>
        </div>
      )}

      {data && users.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] py-16 text-center">
          <UserIcon className="w-8 h-8 text-white/15" />
          <p className="text-sm text-white/40">暂无登录用户</p>
          <p className="text-xs text-white/25">用户在首页完成邮箱登录后会实时出现在这里</p>
        </div>
      )}

      {users.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3.5 font-medium text-white/40">用户</th>
                <th className="px-5 py-3.5 font-medium text-white/40">角色</th>
                <th className="px-5 py-3.5 font-medium text-white/40">登录次数</th>
                <th className="px-5 py-3.5 font-medium text-white/40">生成次数</th>
                <th className="px-5 py-3.5 font-medium text-white/40">首次登录</th>
                <th className="px-5 py-3.5 font-medium text-white/40">最近活跃</th>
                <th className="px-5 py-3.5 font-medium text-white/40">状态</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const online = u.lastActiveAt > onlineCutoff;
                return (
                  <tr key={u.email} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#0071E3]/15 border border-[#0071E3]/20 flex items-center justify-center text-xs font-semibold text-[#0071E3] shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white truncate">{u.name}</p>
                          <p className="text-xs text-white/30 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.isAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                          <ShieldCheck className="w-3 h-3" /> 管理员
                        </span>
                      ) : (
                        <span className="text-xs text-white/40">普通用户</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-white/70 tabular-nums">{u.loginCount}</td>
                    <td className="px-5 py-3.5 text-white/70 tabular-nums">{u.generationCount}</td>
                    <td className="px-5 py-3.5 text-white/50 text-xs tabular-nums whitespace-nowrap">
                      {new Date(u.firstSeenAt).toLocaleDateString('zh-CN')} {formatClock(u.firstSeenAt)}
                    </td>
                    <td className="px-5 py-3.5 text-white/50 text-xs whitespace-nowrap">{formatTimeAgo(u.lastActiveAt)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.05] text-white/30'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-white/20'}`} />
                        {online ? '在线' : '离线'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
