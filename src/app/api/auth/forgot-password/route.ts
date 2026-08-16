import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import crypto from "crypto"
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
})

/** 只存 Token 哈希，数据库泄露也无法直接利用重置链接 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export async function POST(request: NextRequest) {
  // 安全：密码找回限流（每 IP 每分钟最多 3 次）
  const rlKey = getRateLimitKey(request, 'forgot-password');
  const rl = checkRateLimit(rlKey, 3, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: '请求过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  // 仅用于日志追踪，绝不记录 token 或邮箱明文
  const requestId = crypto.randomUUID()
  try {
    const body = await request.json()
    const { email } = forgotPasswordSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true })
    }

    // Generate reset token (raw token 仅通过邮件发送，不落库、不入日志)
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // 数据库只存 Token 的 SHA-256 哈希
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: hashToken(resetToken),
        expires: resetTokenExpiry,
      },
    })

    // TODO: Send email with reset link (含 raw resetToken)
    // const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`
    // await sendEmail({ to: email, subject: "Reset Password", html: `...` })

    console.log(`[Forgot Password] requestId=${requestId} reset token generated`)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error(`[Forgot Password] requestId=${requestId} error`)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}
