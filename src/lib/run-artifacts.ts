/**
 * 运行产物底座（S-03）
 * ===================================================================
 * 「一次生成留下了什么」这件事，此前只有内存。数据包归档（P1-10）与 QA 报告（P3-11）
 * 都要往 `runs/<jobId>/` 里写东西，如果各自实现开关与根目录，两个开关迟早会打架
 * （只开了其中一个，另一半静默不产出，还看不出为什么）。
 *
 * 因此把三件事收敛到这里：
 *   · 一个开关（`RUN_ARTIFACTS`，兼容旧的 `PACKAGE_ARCHIVE`）
 *   · 一个根目录（`RUN_ARTIFACTS_DIR`，兼容 `PACKAGE_ARCHIVE_DIR`，默认 `<cwd>/runs`）
 *   · 一个 jobId 消毒函数 + 一个只会写进该目录的写文件原语
 *
 * **永不抛错**：产物是旁路能力，磁盘满 / 权限不足都不该把一次成功的生成变成失败。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * 运行产物总开关。默认 off —— 与 `INTERACTION_CAPTURE` / `LAYOUT_PROBE` 一致的风格。
 *
 * 兼容 `PACKAGE_ARCHIVE`：那个名字先于本模块存在，且用户可能已经配好了。
 */
export function isRunArtifactsEnabled(): boolean {
  return process.env.RUN_ARTIFACTS === 'on' || process.env.PACKAGE_ARCHIVE === 'on';
}

/** 运行产物根目录，默认 `<cwd>/runs`。 */
export function runArtifactsRoot(): string {
  return process.env.RUN_ARTIFACTS_DIR
    || process.env.PACKAGE_ARCHIVE_DIR
    || path.join(process.cwd(), 'runs');
}

/**
 * jobId 消毒。
 *
 * jobId 来自调用方（将来可能来自 URL / 数据库），`../../` 会写到仓库外面去。
 * 只保留 `[A-Za-z0-9._-]`，并显式拒绝任何含 `..` 的结果。
 */
export function sanitizeJobId(jobId: string): string | null {
  const cleaned = jobId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96);
  if (!cleaned || cleaned === '.' || cleaned === '..' || cleaned.includes('..')) return null;
  return cleaned;
}

export interface WriteArtifactResult {
  ok: boolean;
  /** 相对 `runs/` 的路径，可直接给人看。 */
  relativePath?: string;
  absolutePath?: string;
  reason?: string;
}

/**
 * 写一个运行产物文件。
 *
 * @param jobId      任务 ID（会消毒；非法则拒绝，不做兜底改名 —— 那会掩盖调用方的 bug）
 * @param relSegments 相对 `runs/<jobId>/` 的路径段，逐段拼接（不经字符串拼路径）
 * @param root       覆盖根目录（测试用）
 */
export async function writeRunArtifact(
  jobId: string,
  relSegments: string[],
  content: string | Buffer,
  root?: string,
): Promise<WriteArtifactResult> {
  const safeJobId = sanitizeJobId(jobId);
  if (!safeJobId) return { ok: false, reason: `jobId 非法（含路径穿越或空值）：${jobId}` };

  const segments = relSegments.map((s) => s.replace(/[^A-Za-z0-9._-]/g, '_'));
  if (segments.length === 0) return { ok: false, reason: '未指定产物文件名' };

  const base = path.join(root || runArtifactsRoot(), safeJobId);
  const abs = path.join(base, ...segments);

  try {
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
    return { ok: true, relativePath: path.join(safeJobId, ...segments), absolutePath: abs };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
