// =====================================================================
// /api/admin/login — 服务端管理员登录（设置签名 httpOnly Cookie）
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminCredentials,
  createAdminSessionToken,
  ADMIN_COOKIE,
  adminCookieOptions,
} from '@/lib/admin-session';
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 安全：管理员登录限流（每 IP 每分钟最多 3 次）
  const rlKey = getRateLimitKey(request, 'admin-login');
  const rl = checkRateLimit(rlKey, 3, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: '尝试次数过多，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string };

    if (!email || !password || !verifyAdminCredentials(email, password)) {
      return NextResponse.json({ success: false, message: '邮箱或密码错误' }, { status: 401 });
    }

    const token = createAdminSessionToken();
    const res = NextResponse.json({ success: true });
    res.cookies.set(ADMIN_COOKIE, token, adminCookieOptions);
    return res;
  } catch {
    return NextResponse.json({ success: false, message: '无效的请求体' }, { status: 400 });
  }
}
