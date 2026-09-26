/**
 * WebsitePackage 落盘归档（P1-10 磁盘目录标准 / S-03 产物存储约定 / P1-14 可追溯）
 * ===================================================================
 * 解决的问题：整个中间层**只活在内存里**。
 *
 * 在此之前，`buildWebsitePackage()` 的产物写完就被下一次 TTL 缓存刷新覆盖，
 * 于是：
 *   · 无法归档 —— 一次生成结束后，没人能回答「当时模型到底看到了什么」；
 *   · 无法离线复现 —— 同一个 URL 两次采集的差异无从对比（P1-14 的验收标准）；
 *   · B.2 迁移只能靠 `docker exec psql` 去账本里凑样本 —— 账本记的是分数，
 *     不是输入，所以「分数为什么是这样」永远查不到；
 *   · 「模型复刻得不像」只能凭感觉调提示词，因为原始设计依据已不存在。
 *
 * 目录标准（严格对齐执行计划书 §五）：
 *
 *   runs/<jobId>/website-package/
 *   ├── manifest.json          ← schemaVersion / toolVersions / sourceUrl / capturedAt / 校验结论
 *   ├── package.json           ← 完整包（截图 base64 已剥离，见下）
 *   ├── screenshots/           ← desktop.png / tablet.png …（真正的图片文件）
 *   ├── dom/                   ← sections.json + structure.html
 *   ├── styles/                ← styles.json
 *   ├── assets/                ← assets.json（+ 将来本地化的资源文件）
 *   ├── layout/                ← flow.json
 *   └── interaction/           ← interaction.json（**仅当真的采集到内容时才建**）
 *
 * 两条不可违反的约定：
 *
 * 1. **截图 base64 不进 package.json**。一张 1440×3000 的全页 PNG 的 base64
 *    轻松超过 10MB，塞进 JSON 会让这个文件既不可读也不可 diff。因此图片落到
 *    `screenshots/<viewport>.<ext>`，package.json 里只留 `file` 引用。
 * 2. **脚本永不抛错**（与 `openBrowserSession` 同一契约）。归档是旁路能力，
 *    磁盘满 / 权限不足都不该把一次成功的生成变成失败。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { inspectWebsitePackage } from '@/lib/schemas';
import {
  isRunArtifactsEnabled,
  runArtifactsRoot,
  sanitizeJobId,
} from '@/lib/run-artifacts';
import { parseImageSize, type ParsedImageSize } from '@/lib/assets/image-size';
import { WEBSITE_PACKAGE_VERSION, type ScreenshotData, type WebsitePackage } from '@/types/website-package';

/**
 * 归档开关。委托给 {@link isRunArtifactsEnabled} —— 归档与 QA 报告共用同一个
 * 开关，避免「只开了报告没开归档」这类各写一半的配置漂移。
 */
export function isPackageArchiveEnabled(): boolean {
  return isRunArtifactsEnabled();
}

/** 归档根目录。委托给 {@link runArtifactsRoot}。 */
export function archiveRoot(): string {
  return runArtifactsRoot();
}

// jobId 消毒与「只写进 runs/」的保证都在 run-artifacts 里，这里只做转发，
// 保持既有调用方与测试的导入路径不变。
export { sanitizeJobId };

interface MimeParts {
  ext: string;
  mime: string;
}

/** 从 data URL 解析出扩展名与 MIME；不是 data URL 或 MIME 未知时返回 null。 */
export function parseDataUrl(dataUrl: string): MimeParts | null {
  const m = /^data:([\w/+.-]+);base64,/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const ext = mime === 'image/jpeg' ? 'jpg'
    : mime === 'image/svg+xml' ? 'svg'
    : mime === 'image/webp' ? 'webp'
    : 'png';
  return { ext, mime };
}

/** 图片头识别出的格式 → 文件扩展名。 */
const FORMAT_EXT: Record<ParsedImageSize['format'], string> = {
  png: 'png',
  jpeg: 'jpg',
  gif: 'gif',
  bmp: 'bmp',
  webp: 'webp',
  svg: 'svg',
};

export interface ImagePayload {
  ext: string;
  bytes: Buffer;
}

/**
 * 把截图负载解成「扩展名 + 字节」。
 *
 * **必须同时支持两种形态** —— 这不是过度设计，是真机打脸后的结论：
 *
 *   · `data:image/png;base64,iVBOR…`  数据 URL 形态（前端上传 / 测试里一直用的）
 *   · `iVBOR…`                        **裸 base64**（真实生产者形态）
 *
 * `src/lib/screenshot.ts` 的 `heroBase64` 注释写得很清楚：*without data URI prefix*。
 * 而这里原先只认带前缀的 data URL，于是 `/api/mimo` 传上来的裸 base64 会被
 * **静默跳过**：闸门日志说 `screenshots` 块非空（模型确实收到了图），
 * 磁盘上却连 `screenshots/` 目录都不存在。**2026-09-26 真机验证抓到的。**
 *
 * 扩展名优先取 data URL 的 MIME；没有 MIME 时用**图片头**识别。
 * 两者都拿不到就返回 `null`（宁可没有文件，也不写一个后缀骗人的文件）。
 */
export function decodeImagePayload(input: unknown): ImagePayload | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;

  const isDataUrl = raw.startsWith('data:');
  let b64 = raw;
  if (isDataUrl) {
    const comma = raw.indexOf(',');
    if (comma < 0) return null;
    // 只认 base64 编码的 data URL；`data:image/svg+xml,<svg…>` 这种明文形式解不出来。
    if (!/;base64,/i.test(raw.slice(0, comma + 1))) return null;
    b64 = raw.slice(comma + 1);
  }
  if (!b64) return null;

  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
  if (bytes.length === 0) return null;

  const fromMime = isDataUrl ? parseDataUrl(raw) : null;
  const size = parseImageSize(bytes);
  const ext = fromMime?.ext ?? (size ? FORMAT_EXT[size.format] : null);
  if (!ext) return null;

  return { ext, bytes };
}

export interface ArchiveOptions {
  /** 任务 ID，用于目录名。 */
  jobId: string;
  /** 采集工具版本信息（P1-14 `toolVersions`）。 */
  toolVersions?: Record<string, string>;
  /** 覆盖归档根目录（测试用）。 */
  root?: string;
}

export interface ArchiveResult {
  ok: boolean;
  /** 归档目录（相对 root），失败时为 undefined。 */
  relativeDir?: string;
  /** 绝对路径，便于日志直接给出可点开的位置。 */
  absoluteDir?: string;
  /** 实际写出的文件（相对归档目录）。 */
  files: string[];
  /** 失败原因 —— 调用方写日志，不要抛给用户。 */
  reason?: string;
}

/** 落盘时替换掉 base64 的截图条目。 */
interface ArchivedScreenshot extends Omit<ScreenshotData, 'dataUrl'> {
  /** 图片文件相对 `screenshots/` 的文件名；无图时为 undefined。 */
  file?: string;
}

/**
 * 把数据包归档到磁盘。
 *
 * **永不抛错**：任何失败都返回 `{ ok: false, reason }`。
 */
export async function archiveWebsitePackage(
  pkg: WebsitePackage,
  options: ArchiveOptions,
): Promise<ArchiveResult> {
  const files: string[] = [];

  const jobId = sanitizeJobId(options.jobId);
  if (!jobId) return { ok: false, files, reason: `jobId 非法（含路径穿越或空值）：${options.jobId}` };

  const root = options.root || archiveRoot();
  const dir = path.join(root, jobId, 'website-package');

  try {
    await mkdir(dir, { recursive: true });

    const write = async (rel: string, content: string | Buffer): Promise<void> => {
      const abs = path.join(dir, rel);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, content);
      files.push(rel);
    };

    // ---- screenshots/：base64 → 真实图片文件 ----
    // 注意：负载可能是裸 base64（真实生产者）或 data URL（测试/前端）——
    // 见 decodeImagePayload 的头注释，这里曾经因此静默丢过整批截图。
    const archivedScreenshots: ArchivedScreenshot[] = [];
    for (const [i, shot] of (pkg.screenshots ?? []).entries()) {
      const { dataUrl, ...rest } = shot;
      const payload = dataUrl ? decodeImagePayload(dataUrl) : null;
      if (!payload) {
        // **不再静默**：以前这里直接 continue，结果「有没有写进文件」在
        // manifest 里看不出来，直到有人去数目录才发现 screenshots/ 根本没建。
        if (dataUrl) {
          console.warn(
            `[PackageArchive] ⚠️ 截图无法解码，只登记元数据不写文件：viewport=${shot.viewport} ` +
              `payloadLen=${dataUrl.length}`,
          );
        }
        archivedScreenshots.push(rest);
        continue;
      }
      const base = `${String(i).padStart(2, '0')}-${sanitizeJobId(shot.viewport) || 'viewport'}`;
      const rel = `screenshots/${base}.${payload.ext}`;
      await write(rel, payload.bytes);
      // package.json 里留引用，不留 base64（见文件头的约定 1）
      archivedScreenshots.push({ ...rest, file: `${base}.${payload.ext}` });
    }

    // ---- package.json：完整包，但截图换成文件引用 ----
    const archivedPackage = { ...pkg, screenshots: archivedScreenshots };
    await write('package.json', JSON.stringify(archivedPackage, null, 2));

    // ---- 按计划书 §五 的目录拆分，便于人工检查与增量对比 ----
    await write('dom/sections.json', JSON.stringify({
      pageType: pkg.dom?.pageType ?? 'unknown',
      layout: pkg.dom?.layout ?? 'block',
      responsive: pkg.dom?.responsive ?? false,
      sections: pkg.dom?.sections ?? [],
    }, null, 2));
    await write('dom/structure.html', pkg.dom?.structure ?? '');

    await write('styles/styles.json', JSON.stringify(pkg.styles ?? {}, null, 2));

    await write('assets/assets.json', JSON.stringify(pkg.assets ?? [], null, 2));

    await write('layout/flow.json', JSON.stringify({
      flow: pkg.layout?.flow ?? [],
      breakpoints: pkg.layout?.breakpoints ?? [],
      gridColumns: pkg.layout?.gridColumns ?? 0,
      stickyHeader: pkg.layout?.stickyHeader ?? false,
      centered: pkg.layout?.centered ?? false,
    }, null, 2));

    // interaction 只在**真的有内容**时才建目录 —— 空目录会让人误判「采集过但没交互」
    const interaction = pkg.interaction;
    const hasInteraction = Boolean(
      interaction && (interaction.scrolls?.length || interaction.clicks?.length || interaction.states?.length),
    );
    if (hasInteraction) {
      await write('interaction/interaction.json', JSON.stringify(interaction, null, 2));
    }

    // ---- manifest.json：可追溯字段（P1-14）----
    const health = inspectWebsitePackage(pkg);
    const manifest = {
      sourceUrl: pkg.url,
      capturedAt: pkg.capturedAt,
      schemaVersion: pkg.version,
      archivedSchemaVersion: WEBSITE_PACKAGE_VERSION,
      toolVersions: options.toolVersions ?? { 'website-package': WEBSITE_PACKAGE_VERSION },
      jobId,
      /** 契约校验结论 —— 归档下来的包将来回读时，这份结论就是「它当时是否可信」的依据。 */
      contract: {
        valid: health.ok,
        errors: health.errors,
        substantive: health.substantive,
        emptyParts: health.emptyParts,
      },
      counts: {
        screenshots: archivedScreenshots.length,
        assets: pkg.assets?.length ?? 0,
        sections: pkg.dom?.sections?.length ?? 0,
        colors: pkg.styles?.colors?.length ?? 0,
        flowBlocks: pkg.layout?.flow?.length ?? 0,
        animations: pkg.animations?.length ?? 0,
        interaction: hasInteraction,
      },
    };
    await write('manifest.json', JSON.stringify(manifest, null, 2));

    return {
      ok: true,
      relativeDir: path.join(jobId, 'website-package'),
      absoluteDir: dir,
      files,
    };
  } catch (err) {
    return {
      ok: false,
      files,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 旁路归档：开关关闭时**什么都不做**，失败时只记日志。
 *
 * 调用点用这个函数，就保证了「归档永远不会把成功的生成变成失败」。
 */
export async function archivePackageIfEnabled(
  pkg: WebsitePackage,
  options: ArchiveOptions,
): Promise<ArchiveResult | null> {
  if (!isPackageArchiveEnabled()) return null;
  const result = await archiveWebsitePackage(pkg, options);
  if (result.ok) {
    console.log(
      `[PackageArchive] ✅ ${result.relativeDir}（${result.files.length} 个文件）`,
    );
  } else {
    console.warn(`[PackageArchive] ⚠️ 归档失败（不影响生成）：${result.reason}`);
  }
  return result;
}
