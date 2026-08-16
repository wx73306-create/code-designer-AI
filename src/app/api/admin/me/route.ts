// =====================================================================
// /api/admin/me — 校验当前管理员会话（供前端布局判断登录态）
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticatedServer } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authenticated = isAdminAuthenticatedServer(request);
  return NextResponse.json(
    { authenticated },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}
