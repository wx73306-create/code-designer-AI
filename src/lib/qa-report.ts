/**
 * QA 报告编排器（P3-11 落地点）
 * ===================================================================
 * 为什么单独一层：`report.ts` 是**纯函数**（组装 + 渲染），`run-artifacts.ts`
 * 是**写盘原语**，两者都不该知道「开关」「日志」「什么时候该跳过」这些策略。
 * 策略集中在这里，路由里只留一行调用。
 *
 * 三条硬约束：
 * 1. **永不抛错。** 报告是旁路产物，写不出来绝不能影响 qa 步骤的返回。
 * 2. **开关默认关闭。** 与 `runs/` 归档同一个开关（RUN_ARTIFACTS=on），
 *    不改变任何现有部署的磁盘行为。
 * 3. **无论写不写盘，都往 stdout 打一行 `QA-REPORT {...}`。**
 *    这样「当时为什么给这个分」在容器日志里就是**可取证**的 ——
 *    与迁移样本闸门同源（都靠一行结构化日志复算），不需要读盘。
 */

import {
  buildQaReport,
  type QaReport,
} from './visual-evaluation/report';
// 服务端专用：落盘要 node:fs/promises，绝不能经 `@/lib/visual-evaluation` 的
// barrel 引入（那会把 fs 拉进客户端 chunk，next build 直接失败）。
import { writeQaReport, type WrittenQaReport } from './visual-evaluation/report-write';
import { isRunArtifactsEnabled } from './run-artifacts';

export interface EmitQaReportInput {
  generationId: string;
  sourceUrl: string;
  /** qa 步骤的解析结果（模型原始对象）。 */
  raw: unknown;
  round?: number;
  reconstruction?: { score: number | null; note?: string } | null;
  /** 覆盖写盘开关（测试用）；不传则读 `isRunArtifactsEnabled()`。 */
  enabled?: boolean;
  /** 覆盖落盘根目录（测试用）。 */
  root?: string;
}

export interface EmitQaReportResult {
  report: QaReport;
  /** 未开启归档时为 null（**不是失败**）。 */
  written: WrittenQaReport | null;
  /** 人类可读的处置说明，便于测试与排障。 */
  disposition: 'written' | 'skipped-disabled' | 'write-failed';
  writeErrors?: string[];
}

/**
 * 组装 QA 报告；按开关决定是否落盘；同时打一行结构化日志。
 *
 * @returns 组装结果与处置状态。**本函数不会抛错**（写盘的异常会被收敛）。
 */
export async function emitQaReport(input: EmitQaReportInput): Promise<EmitQaReportResult> {
  const report = buildQaReport({
    generationId: input.generationId,
    sourceUrl: input.sourceUrl,
    raw: input.raw,
    round: input.round,
    reconstruction: input.reconstruction ?? null,
  });

  // 单行结构化日志：迁移样本闸门与「为什么给这个分」都靠它复算。
  try {
    console.log(
      `[QA-REPORT] ${JSON.stringify({
        generationId: report.generationId,
        sourceUrl: report.sourceUrl,
        overallScore: report.overallScore,
        overallSource: report.overallSource,
        trustworthy: report.trustworthy,
        defaultedDimensions: report.defaultedDimensions,
        problems: report.problems.length,
        severityCounts: report.severityCounts,
        unmatchedCategories: report.unmatchedCategories,
        reconstruction: report.reconstruction?.score ?? null,
      })}`,
    );
  } catch {
    // console 本身失败也不该影响主流程
  }

  const enabled = input.enabled ?? isRunArtifactsEnabled();
  if (!enabled) {
    return { report, written: null, disposition: 'skipped-disabled' };
  }

  try {
    const written = await writeQaReport(report, { jobId: input.generationId, root: input.root });
    const writeErrors: string[] = [];
    if (!written.json.ok) writeErrors.push(`json: ${written.json.reason ?? '未知原因'}`);
    if (!written.markdown.ok) writeErrors.push(`md: ${written.markdown.reason ?? '未知原因'}`);
    if (writeErrors.length) {
      console.warn(`[QA-REPORT] 落盘部分失败 ${report.generationId}: ${writeErrors.join('; ')}`);
      return { report, written, disposition: 'write-failed', writeErrors };
    }
    return { report, written, disposition: 'written' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[QA-REPORT] 落盘异常 ${report.generationId}: ${message}`);
    return { report, written: null, disposition: 'write-failed', writeErrors: [message] };
  }
}
