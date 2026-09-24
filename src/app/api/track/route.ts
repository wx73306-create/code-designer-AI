// =====================================================================
// /api/track — 前端埋点事件上报入口
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import { liveStats } from '@/lib/live-stats';
import { consumeQuotaByEmail } from '@/lib/quota';
import { pickReconstructionMeta, pickScore } from '@/lib/api/quality-payload';

export const dynamic = 'force-dynamic';

interface TrackBody {
  type: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TrackBody;
    const { type } = body;

    switch (type) {
      case 'generation_start': {
        const email = String(body.email || 'anonymous');
        const id = liveStats.generationStart({
          id: body.id ? String(body.id) : undefined,
          user: String(body.user || '匿名用户'),
          email,
          url: String(body.url || ''),
          goal: String(body.goal || ''),
          model: String(body.model || 'mimo-v2.5'),
        });
        // 原子扣减配额（每次生成扣 1，数据库事务保证不超额）
        if (email && email !== 'anonymous') {
          consumeQuotaByEmail(email).catch(() => {});
        }
        return NextResponse.json({ ok: true, id });
      }

      case 'generation_stage':
        liveStats.generationStage(String(body.id || ''), String(body.stage || ''), body.message ? String(body.message) : undefined);
        return NextResponse.json({ ok: true });

      case 'generation_complete': {
        // B.2.3：三个新字段走统一的边界取值器 —— null 必须保留，
        // 不能用 `typeof x === 'number' ? x : undefined` 那种写法（会把 null 塌成 undefined）。
        const qualityScore = pickScore(body.qualityScore);
        const reconstructionScore = pickScore(body.reconstructionScore);
        const reconstructionMeta = pickReconstructionMeta(body.reconstructionMeta);

        liveStats.generationComplete(String(body.id || ''), {
          tokens: typeof body.tokens === 'number' ? body.tokens : undefined,
          files: typeof body.files === 'number' ? body.files : undefined,
          similarity: typeof body.similarity === 'number' ? body.similarity : undefined,
          // 只有真正上报了才写键：老客户端上报时新字段保持 absent（不是 null）。
          ...(qualityScore !== undefined ? { qualityScore } : {}),
          ...(reconstructionScore !== undefined ? { reconstructionScore } : {}),
          ...(reconstructionMeta !== undefined ? { reconstructionMeta } : {}),
        });
        return NextResponse.json({ ok: true });
      }

      case 'generation_error':
        liveStats.generationError(String(body.id || ''), String(body.error || 'Unknown error'));
        return NextResponse.json({ ok: true });

      case 'generation_cancelled':
        liveStats.generationCancelled(String(body.id || ''));
        return NextResponse.json({ ok: true });

      case 'generation_quality': {
        const scores = (body.visualScore && typeof body.visualScore === 'object' ? body.visualScore : {}) as Record<string, unknown>;
        const dims = (scores.scores && typeof scores.scores === 'object' ? scores.scores : {}) as Record<string, unknown>;
        const validation = (body.codeValidation && typeof body.codeValidation === 'object' ? body.codeValidation : {}) as Record<string, unknown>;
        const problems = Array.isArray(scores.problems)
          ? (scores.problems as Array<{ type?: string; description?: string }>).map((p) => ({
              type: String(p.type || 'premium'),
              description: String(p.description || ''),
            }))
          : [];
        liveStats.trackQuality({
          generationId: body.id ? String(body.id) : undefined,
          user: String(body.user || '匿名用户'),
          url: String(body.url || ''),
          styleName: body.styleName ? String(body.styleName) : undefined,
          styleConfidence: typeof body.styleConfidence === 'number' ? body.styleConfidence : undefined,
          overallScore: typeof scores.overall_score === 'number' ? scores.overall_score : undefined,
          layoutScore: typeof dims.layout_score === 'number' ? dims.layout_score : undefined,
          balanceScore: typeof dims.visual_balance === 'number' ? dims.visual_balance : undefined,
          spacingScore: typeof dims.spacing_score === 'number' ? dims.spacing_score : undefined,
          colorScore: typeof dims.color_score === 'number' ? dims.color_score : undefined,
          typographyScore: typeof dims.typography_score === 'number' ? dims.typography_score : undefined,
          premiumScore: typeof dims.premium_score === 'number' ? dims.premium_score : undefined,
          ruleScore: typeof validation.score === 'number' ? validation.score : undefined,
          rulePassed: typeof validation.passed === 'boolean' ? validation.passed : undefined,
          violationCount: typeof validation.violations === 'object' && Array.isArray(validation.violations) ? validation.violations.length : undefined,
          problems,
        });
        return NextResponse.json({ ok: true });
      }

      case 'user_login':
        liveStats.userLogin({
          name: String(body.name || '用户'),
          email: String(body.email || ''),
          isAdmin: Boolean(body.isAdmin),
        });
        return NextResponse.json({ ok: true });

      case 'page_visit':
        liveStats.pageVisit({ path: body.path ? String(body.path) : '/' });
        return NextResponse.json({ ok: true });

      case 'heartbeat':
        liveStats.heartbeat(String(body.email || ''));
        return NextResponse.json({ ok: true });

      case 'client_error':
        liveStats.trackError('frontend', String(body.message || ''), body.context ? String(body.context) : undefined);
        return NextResponse.json({ ok: true });

      default:
        return NextResponse.json({ error: `Unknown event type: ${type}` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
