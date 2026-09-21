/**
 * /api/reconstruction — Original / Clone 双截图 + 还原度度量
 * ===================================================================
 * Phase 2 / Sprint B Step 3。设计冻结文档：
 * docs/phase2-sprintB-reconstruction-diff-design.md §5.1 / §5.3
 *
 * ## 开关与失败策略
 *
 * - `RECONSTRUCTION_DIFF=on` 才干活；未开启时立即返回 `{ enabled: false }`，
 *   不碰浏览器（客户端每次生成都调这个接口，未开启时必须是零开销）。
 * - **fail-open**：任何异常都返回 200 + 错误字段，绝不抛 500 打断生成链路。
 *   还原度度量是锦上添花，它挂了不该连累主流程。
 *
 * ## 响应结构（Step 3）
 *
 *   { enabled, original, originalSource, clone, render, timings }
 *
 * `score` / `report` 在 Step 4（结构化 diff）接入后才有 —— Step 3 刻意**不放
 * 占位字段**：null 在本契约里表示「无法度量」，不能再用它表示「还没实现」。
 */

import { NextRequest, NextResponse } from 'next/server';

import { isReconstructionDiffEnabled, runReconstruction } from '@/lib/reconstruction';
import type { CapturePairResult } from '@/lib/reconstruction';
import type { ReconstructionScore, RenderResult } from '@/types/reconstruction';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ReconstructionRequestBody {
  html?: unknown;
  url?: unknown;
  originalScreenshot?: unknown;
}

/** 失败兜底响应的形状（fail-open，绝不 500 打断生成链路）。 */
interface FailureResponse {
  enabled: true;
  original: string;
  originalSource: CapturePairResult['originalSource'];
  clone: string;
  render: RenderResult;
  score: ReconstructionScore;
  timings: { cloneMs: number; originalMs: number; totalMs: number };
  error: string;
}

export async function POST(request: NextRequest) {
  let body: ReconstructionRequestBody;
  try {
    body = (await request.json()) as ReconstructionRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const html = typeof body.html === 'string' ? body.html : '';
  const url = typeof body.url === 'string' ? body.url : '';
  const originalScreenshot =
    typeof body.originalScreenshot === 'string' ? body.originalScreenshot : undefined;

  if (!html.trim()) {
    return NextResponse.json({ error: 'html is required' }, { status: 400 });
  }

  // 开关未开启：立即返回，不碰浏览器
  if (!isReconstructionDiffEnabled()) {
    return NextResponse.json({ enabled: false });
  }

  try {
    // 单次渲染完成全部工作：clone 截图+指纹、原站截图+真值、评分
    const run = await runReconstruction({ html, url, originalScreenshot });
    console.log(
      `[Reconstruction] original=${run.originalSource}(${Math.round(run.original.length / 1024)}KB) ` +
        `clone=${run.render.status}(${Math.round(run.clone.length / 1024)}KB) ` +
        `score=${run.score.score ?? 'null'} total=${run.timings.totalMs}ms`,
    );
    return NextResponse.json({ enabled: true, ...run });
  } catch (err) {
    // fail-open：还原度度量失败不阻断生成链路
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[Reconstruction] 采集失败（fail-open）：', message);
    const response: FailureResponse = {
      enabled: true,
      original: '',
      originalSource: 'unavailable',
      clone: '',
      render: { screenshot: '', status: 'failed', reason: 'render-error' },
      score: {
        score: null,
        dimensions: null,
        renderStatus: 'failed',
        reason: 'render-error',
        evaluatedAt: new Date().toISOString(),
      },
      timings: { cloneMs: 0, originalMs: 0, totalMs: 0 },
      error: message,
    };
    return NextResponse.json(response);
  }
}
