// =====================================================================
// /api/admin/reset — 清空实时统计数据（演示前重置用）
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import { liveStats } from '@/lib/live-stats';
import { isAdminAuthenticatedServer } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // P0-1：服务端鉴权，匿名请求一律 401
  if (!isAdminAuthenticatedServer(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  liveStats.reset();
  return NextResponse.json({ ok: true, message: '统计数据已重置' });
}
