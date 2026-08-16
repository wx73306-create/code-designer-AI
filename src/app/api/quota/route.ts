import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkQuota, consumeQuotaByEmail, refundQuotaByEmail } from "@/lib/quota"
import { getUserSessionEmail, isAdminAuthenticatedServer } from "@/lib/admin-session"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const quota = await checkQuota(session.user.id)

    return NextResponse.json({
      allowed: quota.allowed,
      remaining: quota.remaining,
      limit: quota.limit,
      resetAt: quota.resetAt.toISOString(),
    })
  } catch (error) {
    console.error("[Quota] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch quota" },
      { status: 500 }
    )
  }
}

/** POST /api/quota — 扣减 1 次配额（每次复刻调用一次） */
export async function POST(request: NextRequest) {
  // Admin bypass: unlimited quota, no consumption
  if (isAdminAuthenticatedServer(request)) {
    return NextResponse.json({ allowed: true, remaining: 9999, limit: -1 })
  }

  const email = getUserSessionEmail(request)
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await consumeQuotaByEmail(email)
    if (!result) {
      return NextResponse.json({ allowed: true, remaining: 999, limit: -1 })
    }
    return NextResponse.json({
      allowed: result.allowed,
      remaining: result.remaining,
      limit: result.limit,
    })
  } catch (error) {
    console.error("[Quota] Consume error:", error)
    return NextResponse.json({ error: "Failed to consume quota" }, { status: 500 })
  }
}

/** DELETE /api/quota — 退还 1 次配额（生成失败时调用） */
export async function DELETE(request: NextRequest) {
  // Admin bypass: nothing to refund
  if (isAdminAuthenticatedServer(request)) {
    return NextResponse.json({ refunded: true })
  }

  const email = getUserSessionEmail(request)
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await refundQuotaByEmail(email)
    return NextResponse.json({ refunded: true })
  } catch (error) {
    console.error("[Quota] Refund error:", error)
    return NextResponse.json({ error: "Failed to refund quota" }, { status: 500 })
  }
}
