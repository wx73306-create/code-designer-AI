import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const pathname = nextUrl.pathname

  // Auth pages
  const isAuthPage = pathname === "/login" || pathname === "/register"

  // Public pages (no auth required)
  // Admin auth is handled client-side by the admin layout using sessionStorage
  const isPublicPage =
    pathname === "/" ||
    pathname.startsWith("/showcase") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")

  // Protected pages (auth required)
  const isProtectedPage =
    pathname.startsWith("/projects") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/dashboard")

  // If on auth page and logged in, redirect to projects
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/projects", nextUrl))
  }

  // If on protected page and not logged in, redirect to login
  if (isProtectedPage && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
}
