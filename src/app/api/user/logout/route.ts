// =====================================================================
// /api/user/logout — 清除普通用户会话 Cookie
// =====================================================================

import { NextResponse } from 'next/server';
import { USER_COOKIE } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(USER_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
