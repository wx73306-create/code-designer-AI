import { LoginForm } from "@/components/auth/login-form"
import { Code2 } from "lucide-react"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f7] px-4">
      {/* Background gradient */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(135deg, #f5f5f7 0%, #ece8f4 30%, #e8e0f0 50%, #e0ddf0 70%, #f0eef5 100%)",
        }}
      />

      {/* Logo */}
      <div className="flex items-center gap-2 mb-12">
        <div className="w-10 h-10 rounded-xl bg-[#0071E3] flex items-center justify-center">
          <Code2 className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-semibold text-[#1d1d1f]">
          Code Designer AI
        </span>
      </div>

      {/* Login form */}
      <LoginForm />
    </div>
  )
}
