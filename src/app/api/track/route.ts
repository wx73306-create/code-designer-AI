// =====================================================================
// /api/track — 前端埋点事件上报入口
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import { liveStats } from '@/lib/live-stats';
import { pickReconstructionMeta, pickScore } from '@/lib/api/quality-payload';
import {
  recordGenerationComplete,
  recordGenerationEnd,
  recordGenerationStart,
} from '@/lib/migration/generation-ledger';
import { getRequestAuth } from '@/lib/admin-session';
import { requiresAuthenticatedSession } from '@/lib/track-policy';

export const dynamic = 'force-dynamic';

interface TrackBody {
  type: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TrackBody;
    const { type } = body;

    // 生成生命周期事件必须来自已登录会话（理由见 src/lib/track-policy.ts）：
    // 这类事件会写入持久化观察账本与后台看板，无鉴权时任何人都能伪造
    // generation_complete 注入假样本，污染 Phase 4 的准入判断。
    // 客户端用 sendBeacon / fetch 上报，两者对同源请求都会带上会话 Cookie，
    // 所以这条闸门不会丢掉合法的账本数据；伪造请求直接 401。
    const needsSession = requiresAuthenticatedSession(type);
    const auth = getRequestAuth(request);
    if (needsSession && !auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // 这类事件的归属以**会话身份**为准，不允许用 body.email 把样本记到他人名下。
    const sessionEmail = needsSession && auth.email ? auth.email : undefined;

    switch (type) {
      case 'generation_start': {
        const email = sessionEmail ?? String(body.email || 'anonymous');
        const startPayload = {
          id: body.id ? String(body.id) : undefined,
          user: String(body.user || '匿名用户'),
          email,
          url: String(body.url || ''),
          goal: String(body.goal || ''),
          model: String(body.model || 'mimo-v2.5'),
        };
        const id = liveStats.generationStart(startPayload);
        // 写入持久化账本（Phase 3 观察期要跨重启累积样本，内存态做不到）。
        // 该函数内部自兜异常，不会影响埋点响应，故不 await。
        void recordGenerationStart({ ...startPayload, id });
        // ⚠️ 这里**不再**扣配额（2026-09-24 修复）。
        //
        // 配额唯一入口是带鉴权的 `POST /api/quota`（由 use-workflow 在生成开始时调用）。
        // 本路由原先也调 consumeQuotaByEmail(email)，造成两个后果：
        //   1. 一次生成被扣 2 次 —— limit=2 时用户实际只能生成 1 次，与页面
        //      「免费体验每天 2 次」的承诺不符；
        //   2. 本路由**没有任何鉴权**，email 直接取自请求体，
        //      任何人都能构造 { type:'generation_start', email:'受害者' } 刷空他人配额。
        // 埋点路由只做埋点：不产生副作用，尤其不碰计费状态。
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

        const completeId = String(body.id || '');
        liveStats.generationComplete(completeId, {
          tokens: typeof body.tokens === 'number' ? body.tokens : undefined,
          files: typeof body.files === 'number' ? body.files : undefined,
          similarity: typeof body.similarity === 'number' ? body.similarity : undefined,
          // 只有真正上报了才写键：老客户端上报时新字段保持 absent（不是 null）。
          ...(qualityScore !== undefined ? { qualityScore } : {}),
          ...(reconstructionScore !== undefined ? { reconstructionScore } : {}),
          ...(reconstructionMeta !== undefined ? { reconstructionMeta } : {}),
        });

        // 持久化账本：B.2.4.1 起分数改为服务端权威写入（recordGenerationQuality /
        // recordGenerationReconstruction 在 /api/mimo、/api/reconstruction 里落账本），
        // 这里只做终态收口 + 运维字段 + reconstructionMeta（账本列只写、不被闸门/界面读取）。
        // 客户端随 completion 上报的 qualityScore / reconstructionScore / similarity 一律忽略，
        // 即便旧客户端伪造 999 也不会进账本。
        const liveRecord = liveStats.generations.find((g) => g.id === completeId);
        void recordGenerationComplete({
          id: completeId,
          files: liveRecord?.files,
          tokens: liveRecord?.tokens,
          durationMs: liveRecord?.durationMs,
          ...(reconstructionMeta !== undefined ? { reconstructionMeta } : {}),
        });
        return NextResponse.json({ ok: true });
      }

      case 'generation_error':
        liveStats.generationError(String(body.id || ''), String(body.error || 'Unknown error'));
        void recordGenerationEnd(String(body.id || ''), 'error', String(body.error || 'Unknown error'));
        return NextResponse.json({ ok: true });

      case 'generation_cancelled':
        liveStats.generationCancelled(String(body.id || ''));
        void recordGenerationEnd(String(body.id || ''), 'cancelled');
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
