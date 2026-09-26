/**
 * QA 报告落盘（P3-11）—— **服务端专用**
 * ===================================================================
 * 为什么与 `report.ts` 分开：`report.ts` 被 `src/app/page.tsx`
 * （Client Component）经 barrel 间接引入，必须保持**零 `node:` 依赖**。
 * 落盘要 `node:fs/promises`，留在同一个文件里会让 `next build` 报：
 *
 *   the chunking context (unknown) does not support external modules
 *   (request: node:fs/promises)
 *
 * 所以：**纯函数在 `report.ts`，碰文件系统的在这里。**
 * 本文件不得从 `src/lib/visual-evaluation/index.ts` 再导出到客户端可达的位置。
 */

import { writeRunArtifact, type WriteArtifactResult } from '@/lib/run-artifacts';

import { renderQaReportMarkdown, type QaReport } from './report';

export interface WrittenQaReport {
  json: WriteArtifactResult;
  markdown: WriteArtifactResult;
}

/**
 * 把报告写到 `runs/<jobId>/qa-report.json` + `qa-report.md`。
 *
 * 调用方负责判断开关（`isRunArtifactsEnabled`）；本函数只管写，
 * 且**永不抛错** —— 两个文件的失败原因都体现在返回值里。
 */
export async function writeQaReport(
  report: QaReport,
  options: { jobId?: string; root?: string } = {},
): Promise<WrittenQaReport> {
  const jobId = options.jobId || report.generationId;
  const json = await writeRunArtifact(
    jobId,
    ['qa-report.json'],
    JSON.stringify(report, null, 2),
    options.root,
  );
  const markdown = await writeRunArtifact(
    jobId,
    ['qa-report.md'],
    renderQaReportMarkdown(report),
    options.root,
  );
  return { json, markdown };
}
