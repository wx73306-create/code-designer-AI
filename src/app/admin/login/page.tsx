"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Code2, Mail, Lock, Loader2, ShieldCheck } from "lucide-react"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // 服务端校验凭据并写入 httpOnly 会话 Cookie
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        router.push("/admin/dashboard")
      } else {
        setError(data.message || "登录失败")
        setLoading(false)
      }
    } catch {
      setError("网络错误，请重试")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117] px-4">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,113,227,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(107,92,231,0.06),transparent_60%)]" />
      </div>

      <div className="w-full max-w-[420px]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-[#0071E3]" />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Admin Console</h1>
          <p className="mt-1 text-sm text-white/30">Code Designer AI 管理后台</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 space-y-4"
          style={{ backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}>
          
          {error && (
            <div className="rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 px-4 py-2.5">
              <p className="text-xs text-[#FF3B30]">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">管理员邮箱</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-white/15 outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3]/40 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-white/15 outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3]/40 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-[#0071E3] text-white shadow-[0_2px_12px_rgba(0,113,227,0.3)] hover:bg-[#0077ED] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />验证中...</>
            ) : (
              "登录后台"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-white/15">
          <Code2 className="w-3 h-3 inline mr-1" />
          Code Designer AI · Admin Console v1.0
        </p>
      </div>
    </div>
  )
}
