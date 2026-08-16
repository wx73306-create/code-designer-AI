// =====================================================================
// /api/admin/logout — 清除管理员会话 Cookie
// =====================================================================

import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
