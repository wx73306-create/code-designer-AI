"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  Code2, LayoutDashboard, Users, FolderOpen, Cpu, Activity,
  BarChart3, DollarSign, Settings, LogOut, ShieldCheck, Bot, AlertTriangle,
  ArrowLeft, PanelRightOpen, PanelRightClose, RotateCcw, ExternalLink,
  Monitor, Tablet, Smartphone, Radar, Gauge, Terminal, Shield, Layers,
} from "lucide-react"

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
  { icon: Users, label: "用户管理", href: "/admin/users" },
  { icon: FolderOpen, label: "项目管理", href: "/admin/projects" },
  { icon: Bot, label: "AI 任务中心", href: "/admin/generations" },
  { icon: Radar, label: "Agent 监控", href: "/admin/agents" },
  { icon: Layers, label: "模型管理", href: "/admin/models" },
  { icon: Gauge, label: "生成质量", href: "/admin/quality" },
  { icon: Cpu, label: "API 调用", href: "/admin/api-calls" },
  { icon: Activity, label: "系统监控", href: "/admin/monitor" },
  { icon: BarChart3, label: "数据分析", href: "/admin/analytics" },
  { icon: DollarSign, label: "成本分析", href: "/admin/costs" },
  { icon: Terminal, label: "日志中心", href: "/admin/logs" },
  { icon: AlertTriangle, label: "错误日志", href: "/admin/errors" },
  { icon: Shield, label: "权限管理", href: "/admin/roles" },
  { icon: Settings, label: "系统设置", href: "/admin/settings" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === "/admin/login"
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showPreview, setShowPreview] = useState(true)
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop")
  const [iframeKey, setIframeKey] = useState(0)

  useEffect(() => {
    // 登录页不做鉴权，直接放行
    if (isLoginPage) {
      setChecking(false)
      return
    }
    // 服务端校验会话 Cookie（httpOnly，无法被前端 JS 读取/伪造）
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) {
          setAuthed(true)
        } else {
          router.push("/admin/login")
        }
      })
      .catch(() => router.push("/admin/login"))
      .finally(() => setChecking(false))
  }, [router, isLoginPage])

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {})
    router.push("/admin/login")
  }

  const refreshPreview = () => setIframeKey(k => k + 1)

  // Device widths for preview
  const deviceWidths = {
    desktop: "100%",
    tablet: "768px",
    mobile: "375px",
  }

  // 登录页独立渲染（不套后台外壳）
  if (isLoginPage) {
    return <>{children}</>
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    )
  }

  if (!authed) return null

  return (
    <div className="h-screen bg-[#0d1117] flex overflow-hidden">
      {/* ─── Sidebar ─── */}
      <aside className="w-[220px] border-r border-white/[0.06] bg-[#0d1117] flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-13 px-5 flex items-center gap-2.5 border-b border-white/[0.06]">
          <div className="w-7 h-7 rounded-lg bg-[#0071E3] flex items-center justify-center">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-xs font-semibold text-white">Code Designer</span>
            <span className="text-[9px] text-[#0071E3] ml-1 font-medium">Admin</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
            const isActive = pathname === href || (pathname.startsWith(href) && href !== "/admin/dashboard")
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-150
                  ${isActive
                    ? "bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/15"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.03] border border-transparent"
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#0071E3]" : ""}`} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-white/[0.06] space-y-1">
          {/* Back to main site */}
          <Link
            href="/"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium
              bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/15
              hover:bg-[#34C759]/15 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            返回前台
          </Link>
          {/* Preview toggle */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer
              ${showPreview
                ? "bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/15"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent"
              }`}
          >
            {showPreview ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            {showPreview ? "隐藏前台" : "显示前台"}
          </button>
          <Link
            href="/"
            target="_blank"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            新窗口打开
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-white/30 hover:text-[#FF3B30] hover:bg-[#FF3B30]/5 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </aside>

      {/* ─── Admin Content ─── */}
      <main className={`min-w-0 overflow-y-auto transition-all duration-300 ${showPreview ? "flex-1" : "flex-1"}`}>
        <div className="p-6 max-w-[1400px]">
          {children}
        </div>
      </main>

      {/* ─── Live Preview Panel ─── */}
      {showPreview && (
        <div className="w-[50%] max-w-[800px] min-w-[400px] border-l border-white/[0.06] flex flex-col shrink-0 bg-[#0a0e14]">
          {/* Preview toolbar */}
          <div className="h-10 px-3 flex items-center justify-between border-b border-white/[0.06] bg-[#0d1117] shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
              <span className="text-[10px] text-white/40 font-medium">前台实时预览</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Device switcher */}
              {[
                { id: "desktop" as const, icon: Monitor },
                { id: "tablet" as const, icon: Tablet },
                { id: "mobile" as const, icon: Smartphone },
              ].map(({ id, icon: DIcon }) => (
                <button
                  key={id}
                  onClick={() => setPreviewDevice(id)}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer
                    ${previewDevice === id
                      ? "bg-white/[0.08] text-white/70"
                      : "text-white/20 hover:text-white/50"
                    }`}
                >
                  <DIcon className="w-3.5 h-3.5" />
                </button>
              ))}
              <div className="w-px h-4 bg-white/[0.06] mx-1" />
              {/* Refresh */}
              <button
                onClick={refreshPreview}
                className="p-1.5 rounded-md text-white/20 hover:text-white/50 transition-colors cursor-pointer"
                title="刷新预览"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              {/* Open in new tab */}
              <Link
                href="/"
                target="_blank"
                className="p-1.5 rounded-md text-white/20 hover:text-white/50 transition-colors"
                title="新标签页打开"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Preview iframe container */}
          <div className="flex-1 flex items-start justify-center overflow-hidden bg-[#1a1d23] p-0">
            <div
              className="h-full transition-all duration-300"
              style={{ width: deviceWidths[previewDevice] }}
            >
              <iframe
                key={iframeKey}
                src="/"
                title="Website Preview"
                className="w-full h-full border-0 bg-white"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
