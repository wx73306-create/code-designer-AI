// =====================================================================
// /api/user/me — 返回当前登录用户（从服务端会话 Cookie 读取）
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getUserSessionEmail } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const email = getUserSessionEmail(request);
  if (!email) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true, email, name: email.split('@')[0] || 'user' });
}
