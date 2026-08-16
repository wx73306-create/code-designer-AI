// =====================================================================
// /api/user/login — 普通用户登录/注册（落库 + 服务端会话）
// =====================================================================
// 用户存在则校验密码登录；不存在则自动注册（密码 bcrypt 哈希落库）。
// 签发 httpOnly 会话 Cookie，并初始化配额记录。
// 安全修复（P1）：移除"数据库不可用时回落演示模式（接受任意凭据）"的不安全
// 行为——数据库不可用时改为返回 503，避免在故障期间放行任意登录。
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createUserSessionToken, USER_COOKIE, userCookieOptions } from '@/lib/admin-session';
import { liveStats } from '@/lib/live-stats';
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function POST(request: NextRequest) {
  // P2 安全修复：登录接口限流（每 IP 每分钟最多 20 次）
  const rlKey = getRateLimitKey(request, 'login');
  const rl = checkRateLimit(rlKey, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: '尝试次数过多，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);
    const name = email.split('@')[0] || 'user';

    let isAdmin = false;

    try {
      // --- 数据库路径：校验/注册落库 ---
      const existing = await prisma.user.findUnique({ where: { email } });

      if (existing) {
        // 已注册：校验密码
        if (!existing.password || !(await bcrypt.compare(password, existing.password))) {
          return NextResponse.json({ success: false, message: '邮箱或密码错误' }, { status: 401 });
        }
        isAdmin = existing.role === 'ADMIN';
      } else {
        // 未注册：自动注册（密码哈希落库）
        // 注意：登录即自动注册是有意为之的产品行为（降低注册门槛），并非安全漏洞。
        const hashed = await bcrypt.hash(password, 12);
        await prisma.user.create({
          data: { email, name, password: hashed, role: 'USER', emailVerified: new Date() },
        });
        // 初始化配额记录（免费用户每日 2 次）
        const newUser = await prisma.user.findUnique({ where: { email } });
        if (newUser) {
          await prisma.quota.upsert({
            where: { userId: newUser.id },
            update: {},
            create: {
              userId: newUser.id,
              used: 0,
              limit: 2,
              resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          });
        }
      }
    } catch {
      // 安全修复（P1）：数据库不可用时不再回落演示模式（接受任意凭据），
      // 直接返回 503，避免在数据库故障期间放行未经验证的登录。
      return NextResponse.json(
        { success: false, message: '服务暂时不可用，请稍后再试' },
        { status: 503 },
      );
    }

    // 记录登录（实时统计）
    liveStats.userLogin({ name, email, isAdmin });

    // 签发服务端会话 Cookie
    const token = createUserSessionToken(email);
    const res = NextResponse.json({ success: true, name, email });
    res.cookies.set(USER_COOKIE, token, userCookieOptions);
    return res;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: '无效的请求体' }, { status: 400 });
  }
}
