import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { z } from "zod"
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

/** 与 forgot-password 一致：数据库只存 Token 哈希 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export async function POST(request: NextRequest) {
  // 安全：密码重置限流（每 IP 每分钟最多 5 次）
  const rlKey = getRateLimitKey(request, 'reset-password');
  const rl = checkRateLimit(rlKey, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: '请求过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  try {
    const body = await request.json()
    const { token, password } = resetPasswordSchema.parse(body)

    // 用提交 token 的哈希查找（库中存的是哈希）
    const tokenHash = hashToken(token)
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token: tokenHash,
        expires: { gt: new Date() },
      },
    })

    if (!verificationToken) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired reset token" },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Update user password
    await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { password: hashedPassword },
    })

    // Delete used token (by hash)
    await prisma.verificationToken.delete({
      where: { token: tokenHash },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("[Reset Password] Error:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}
