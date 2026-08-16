// =====================================================================
// /api/system-status — 公开系统状态（首页轮询总开关用）
// =====================================================================

import { NextResponse } from 'next/server';
import { liveStats } from '@/lib/live-stats';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(liveStats.getSystemSettings());
}
