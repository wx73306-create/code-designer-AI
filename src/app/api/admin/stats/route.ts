// =====================================================================
// /api/admin/stats — 后台 Dashboard 聚合数据
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import { liveStats } from '@/lib/live-stats';
import { isAdminAuthenticatedServer } from '@/lib/admin-session';
import { summarizeMigration } from '@/lib/migration/observe';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // P0-1：服务端鉴权，匿名请求一律 401
  if (!isAdminAuthenticatedServer(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const section = request.nextUrl.searchParams.get('section') || 'overview';

  switch (section) {
    case 'overview':
      return NextResponse.json({
        stats: liveStats.getDashboardStats(),
        recentGenerations: liveStats.generations.slice(0, 10),
      });

    case 'generations':
      liveStats.sweepStaleGenerations();
      return NextResponse.json({ generations: liveStats.generations.slice(0, 100) });

    case 'users':
      return NextResponse.json({
        users: [...liveStats.users.values()].sort((a, b) => b.lastActiveAt - a.lastActiveAt),
        onlineCount: liveStats.getOnlineCount(),
      });

    case 'api-calls':
      return NextResponse.json({
        calls: liveStats.apiCalls.slice(0, 200),
        health: liveStats.getApiHealth(),
      });

    case 'errors':
      return NextResponse.json({ errors: liveStats.errors.slice(0, 100) });

    case 'agents':
      return NextResponse.json({
        agents: liveStats.getAgentStats(),
        health: liveStats.getApiHealth(),
      });

    case 'quality':
      return NextResponse.json({ quality: liveStats.getQualityStats() });

    // Migration Phase 3 · Observe —— 只统计已完成的任务。
    // running / error 的记录本来就不会有分数，计入分母只会稀释覆盖率，
    // 让「迁移是否生效」看起来比实际更差。
    case 'migration':
      return NextResponse.json({
        migration: summarizeMigration(
          liveStats.generations.filter((g) => g.status === 'completed'),
        ),
      });

    case 'quota':
      return NextResponse.json(liveStats.getQuotaOverview());

    default:
      return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 });
  }
}
