// Admin authentication utility — hardcoded credentials for development
const ADMIN_EMAIL = "050125@Code Designer AI.com"
const ADMIN_PASSWORD = "050125why"

export function isAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem("admin_auth") === "true"
}

export function adminLogin(email: string, password: string): { success: boolean; message?: string } {
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    sessionStorage.setItem("admin_auth", "true")
    return { success: true }
  }
  return { success: false, message: "邮箱或密码错误" }
}

export function adminLogout(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("admin_auth")
  }
}
