import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Code2, LogOut, FolderOpen } from "lucide-react"
import { signOut } from "next-auth/react"

export default async function ProjectsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 border-b border-black/[0.04]" style={{ background: "rgba(245,245,247,0.85)", backdropFilter: "blur(20px) saturate(1.8)" }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0071E3] flex items-center justify-center">
              <Code2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-[#1d1d1f]">Code Designer AI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-black/50">{session.user.email}</span>
            <Link
              href="/"
              className="text-sm text-black/40 hover:text-black/60 transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#0071E3]/5 flex items-center justify-center mx-auto mb-6">
            <FolderOpen className="w-10 h-10 text-[#0071E3]/40" />
          </div>
          <h1 className="text-3xl font-bold text-[#1d1d1f] tracking-tight mb-3">
            My Projects
          </h1>
          <p className="text-sm text-black/40 max-w-md mx-auto mb-8">
            Your generated projects will appear here. Start by entering a URL on the home page.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-[#0071E3] text-white shadow-[0_2px_12px_rgba(0,113,227,0.3)] hover:bg-[#0077ED] transition-all"
          >
            <Code2 className="w-4 h-4" />
            Start New Project
          </Link>
        </div>
      </div>
    </div>
  )
}
