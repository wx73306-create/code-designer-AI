'use client';

import { Shield, ShieldCheck, Code2, Users, Headphones, Lock, Eye, Settings, Bot, BarChart3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ---- Role definitions ----

interface Permission {
  module: string;
  icon: LucideIcon;
  access: Record<string, 'full' | 'read' | 'none'>;
}

interface Role {
  id: string;
  name: string;
  nameEn: string;
  icon: LucideIcon;
  color: string;
  desc: string;
  userCount: number;
}

const ROLES: Role[] = [
  { id: 'super_admin', name: '超级管理员', nameEn: 'Super Admin', icon: ShieldCheck, color: '#FF3B30', desc: '拥有系统全部权限，可管理所有模块和用户', userCount: 1 },
  { id: 'developer', name: '开发者', nameEn: 'Developer', icon: Code2, color: '#0071E3', desc: '查看 Agent 监控、日志、系统状态，调试 AI 管线', userCount: 3 },
  { id: 'operation', name: '运营', nameEn: 'Operation', icon: BarChart3, color: '#34C759', desc: '查看用户数据、项目管理、生成质量分析', userCount: 2 },
  { id: 'support', name: '客服支持', nameEn: 'Customer Support', icon: Headphones, color: '#FF9500', desc: '查看用户信息，处理用户反馈和问题', userCount: 4 },
];

const PERMISSIONS: Permission[] = [
  { module: 'Dashboard 总览', icon: Eye, access: { super_admin: 'full', developer: 'read', operation: 'read', support: 'read' } },
  { module: '用户管理', icon: Users, access: { super_admin: 'full', developer: 'none', operation: 'read', support: 'read' } },
  { module: 'AI 任务中心', icon: Bot, access: { super_admin: 'full', developer: 'full', operation: 'read', support: 'none' } },
  { module: 'Agent 监控', icon: Bot, access: { super_admin: 'full', developer: 'full', operation: 'none', support: 'none' } },
  { module: '模型管理', icon: Code2, access: { super_admin: 'full', developer: 'read', operation: 'none', support: 'none' } },
  { module: '生成质量', icon: BarChart3, access: { super_admin: 'full', developer: 'read', operation: 'read', support: 'none' } },
  { module: '项目管理', icon: BarChart3, access: { super_admin: 'full', developer: 'none', operation: 'full', support: 'none' } },
  { module: '成本分析', icon: BarChart3, access: { super_admin: 'full', developer: 'read', operation: 'read', support: 'none' } },
  { module: '系统监控', icon: Settings, access: { super_admin: 'full', developer: 'full', operation: 'none', support: 'none' } },
  { module: '日志中心', icon: Eye, access: { super_admin: 'full', developer: 'full', operation: 'read', support: 'none' } },
  { module: '权限管理', icon: Lock, access: { super_admin: 'full', developer: 'none', operation: 'none', support: 'none' } },
  { module: '系统设置', icon: Settings, access: { super_admin: 'full', developer: 'none', operation: 'none', support: 'none' } },
];

const ACCESS_META: Record<string, { label: string; cls: string }> = {
  full: { label: '完全控制', cls: 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20' },
  read: { label: '只读', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  none: { label: '无权限', cls: 'bg-white/[0.03] text-white/20 border-white/[0.06]' },
};

export default function RolesPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">权限管理</h1>
          <p className="mt-1 text-sm text-white/30">角色定义 · 模块访问控制 · 最小权限原则</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <Shield className="w-3.5 h-3.5 text-[#0071E3]" />
          <span className="text-xs text-white/50">{ROLES.length} 个角色 · {ROLES.reduce((s, r) => s + r.userCount, 0)} 名成员</span>
        </div>
      </div>

      {/* Role cards */}
      <section>
        <h2 className="text-sm font-medium text-white/60 mb-4">角色定义</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <div key={role.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/[0.08]"
                      style={{ backgroundColor: `${role.color}12` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: role.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{role.name}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">{role.nameEn}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[10px] text-white/40 tabular-nums">
                    {role.userCount} 人
                  </span>
                </div>
                <p className="text-xs text-white/40 leading-relaxed">{role.desc}</p>

                {/* Quick permission summary */}
                <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-1.5">
                  {PERMISSIONS.filter((p) => p.access[role.id] !== 'none').slice(0, 5).map((p) => (
                    <span key={p.module} className="px-2 py-0.5 rounded bg-white/[0.04] text-[10px] text-white/35">
                      {p.module}
                    </span>
                  ))}
                  {PERMISSIONS.filter((p) => p.access[role.id] !== 'none').length > 5 && (
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] text-[10px] text-white/25">
                      +{PERMISSIONS.filter((p) => p.access[role.id] !== 'none').length - 5}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Permission matrix */}
      <section>
        <h2 className="text-sm font-medium text-white/60 mb-4">权限矩阵</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-4 font-medium text-white/40 text-xs">模块</th>
                {ROLES.map((r) => (
                  <th key={r.id} className="px-4 py-4 font-medium text-xs text-center" style={{ color: r.color }}>
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((perm) => {
                const Icon = perm.icon;
                return (
                  <tr key={perm.module} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.015] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-3.5 h-3.5 text-white/25" />
                        <span className="text-xs text-white/60">{perm.module}</span>
                      </div>
                    </td>
                    {ROLES.map((r) => {
                      const access = perm.access[r.id];
                      const meta = ACCESS_META[access];
                      return (
                        <td key={r.id} className="px-4 py-3.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${meta.cls}`}>
                            {meta.label}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Security notes */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="text-xs font-medium text-white/50 mb-3 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5" />
          安全策略
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-white/35 leading-relaxed">
          <div>
            <span className="text-white/50 font-medium">最小权限原则</span>
            <p className="mt-1">每个角色仅授予完成工作所需的最小权限集，避免越权访问。</p>
          </div>
          <div>
            <span className="text-white/50 font-medium">操作审计</span>
            <p className="mt-1">所有管理操作记录至日志中心，支持事后追溯和合规审查。</p>
          </div>
          <div>
            <span className="text-white/50 font-medium">会话管理</span>
            <p className="mt-1">Admin 会话使用 sessionStorage 认证，关闭浏览器自动登出。</p>
          </div>
        </div>
      </section>
    </div>
  );
}
