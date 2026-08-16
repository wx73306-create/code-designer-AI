// =====================================================================
// /api/quota-status — 配额查询（需登录，仅返回当前用户自己的配额）
// =====================================================================
// 优先读数据库持久化配额；数据库不可用或用户未落库时回退内存统计。
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import { liveStats } from '@/lib/live-stats';
import { getUserSessionEmail, isAdminAuthenticatedServer } from '@/lib/admin-session';
import { getQuotaStatusByEmail } from '@/lib/quota';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Admin bypass: unlimited quota
  if (isAdminAuthenticatedServer(request)) {
    return NextResponse.json({
      email: 'admin',
      used: 0,
      limit: -1,
      remaining: -1,
      allowed: true,
    });
  }

  // P0-5：必须登录，且只能查自己的配额（邮箱以服务端会话为准，忽略查询参数）
  const email = getUserSessionEmail(request);
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 优先数据库配额
  try {
    const dbQuota = await getQuotaStatusByEmail(email);
    if (dbQuota) {
      const used = dbQuota.limit === -1 ? 0 : Math.max(0, dbQuota.limit - dbQuota.remaining);
      return NextResponse.json({
        email,
        used,
        limit: dbQuota.limit,
        remaining: dbQuota.limit === -1 ? -1 : dbQuota.remaining,
        allowed: dbQuota.allowed,
      });
    }
  } catch {
    // 数据库不可用，回退内存统计
  }

  return NextResponse.json(liveStats.getUserQuota(email));
}
