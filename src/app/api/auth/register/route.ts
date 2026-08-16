import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").optional(),
})

export async function POST(request: NextRequest) {
  // 安全：注册接口限流（每 IP 每分钟最多 3 次）
  const rlKey = getRateLimitKey(request, 'register');
  const rl = checkRateLimit(rlKey, 3, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: '注册尝试过多，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  try {
    const body = await request.json()
    const { email, password, name } = registerSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "Email already registered" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        password: hashedPassword,
        role: "USER",
      },
    })

    // Quota is auto-created via Auth.js createUser event
    // But create it here as fallback
    await prisma.quota.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        used: 0,
        limit: 2,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      update: {},
    })

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("[Register] Error:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}
