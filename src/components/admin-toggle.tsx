"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, X, LogOut, LayoutDashboard } from "lucide-react"

/**
 * Floating admin toggle button for the main site.
 * Only visible when the admin session cookie is valid.
 */
export function AdminToggle() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const checkAdmin = useCallback(() => {
    fetch(`/api/admin/me?_t=${Date.now()}`, {
      cache: "no-store",
      credentials: "include",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((r) => {
        if (!r.ok) { setIsAdmin(false); return }
        return r.json()
      })
      .then((d) => {
        setIsAdmin(d?.authenticated === true)
      })
      .catch(() => setIsAdmin(false))
      .finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    checkAdmin()
    const interval = setInterval(checkAdmin, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [checkAdmin])

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" }).catch(() => {})
    setIsAdmin(false)
    setExpanded(false)
  }

  if (checking || !isAdmin || dismissed) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center
          text-white/40 hover:text-white/80 transition-colors cursor-pointer"
        title="隐藏按钮"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Expanded menu */}
      {expanded && (
        <div className="flex flex-col gap-1 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl shadow-black/10 p-2 border border-black/5 min-w-[160px]">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium
              text-[#0071E3] hover:bg-[#0071E3]/5 transition-colors cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" />
            打开后台
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium
              text-[#FF3B30] hover:bg-[#FF3B30]/5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            退出管理
          </button>
        </div>
      )}

      {/* Main toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="group flex items-center gap-2.5 px-5 py-3 rounded-2xl
          bg-gradient-to-r from-[#0071E3] to-[#005BB5]
          text-white text-sm font-semibold
          shadow-lg shadow-blue-500/25
          hover:shadow-xl hover:shadow-blue-500/30
          hover:scale-[1.03]
          active:scale-[0.98]
          transition-all duration-200 cursor-pointer"
      >
        <ShieldCheck className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        <span>管理后台</span>
        <div className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
      </button>
    </div>
  )
}
