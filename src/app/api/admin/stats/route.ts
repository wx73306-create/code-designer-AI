// =====================================================================
// /api/admin/stats — 后台 Dashboard 聚合数据
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import { liveStats } from '@/lib/live-stats';
import { isAdminAuthenticatedServer } from '@/lib/admin-session';
import { summarizeMigration } from '@/lib/migration/observe';
import { loadCompletedScoreSources } from '@/lib/migration/generation-ledger';

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
    //
    // 2026-09-24（B.2.4 后）：样本改从**持久化账本**读，不再读内存 liveStats。
    // 原因：liveStats 每次容器重启/重新部署即清零 → 观察期永远攒不够样本，
    // Phase 4 的准入闸门（MIN_READINESS_SAMPLES）永远不会开口。
    case 'migration': {
      const records = await loadCompletedScoreSources();
      return NextResponse.json({
        migration: summarizeMigration(records),
        source: 'ledger',
      });
    }

    case 'quota':
      return NextResponse.json(liveStats.getQuotaOverview());

    default:
      return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 });
  }
}
