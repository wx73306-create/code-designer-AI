/**
 * 资源本地化（P2-03）
 * ===================================================================
 * 解决的问题：`AssetData.localPath` 这个字段从类型定义第一天就写着
 * 「after the asset has been downloaded」，但**从来没有任何代码下载过**。
 * 于是生成出来的页面全部热链原站图片 —— 原站换图/加防盗链/下线，
 * 我们的复刻页当天就变成一片破图，而这是**不可控**的失败。
 *
 * P2-03 的验收标准（docs/execution-task-breakdown.md）：
 *   ① `assets/` + manifest（**宽高、类型、hash**）
 *   ② 生成项目引用**本地**资源路径
 *   ③ **防盗链失败时有占位策略**
 * 本文逐条对上。
 *
 * 三个刻意的决定：
 *
 * 1. **默认关闭**（`ASSET_LOCALIZE=on`）。开一次要下几十个文件、几十 MB，
 *    是显著的行为与耗时变化，不能默认生效 —— 与 `INTERACTION_CAPTURE` /
 *    `LAYOUT_PROBE` / `RUN_ARTIFACTS` 同一风格。
 *
 * 2. **失败也要有产物。** 这是 P2-03 ③ 的实质：拿不到原图时**不能留外链**，
 *    而是落一个本地占位 SVG 并把 `localPath` 指向它。占位图是本地文件、
 *    尺寸与原图一致 —— 布局不塌，且页面里再无一个指向原站的 URL。
 *
 * 3. **永不抛错。** 与归档/报告一致：资源是旁路能力，下载失败不该让一次
 *    成功的生成变成失败。所有失败都变成结果里的 `status` + `reason`。
 */

import { createHash } from 'node:crypto';

import { writeRunArtifact, type WriteArtifactResult } from '@/lib/run-artifacts';
import type { AssetData } from '@/types/website-package';

import { assetTypeFromMime, parseImageSize } from './image-size';

// ---------------------------------------------------------------------------
// 开关与上限
// ---------------------------------------------------------------------------

/** 资源本地化总开关。默认 off。 */
export function isAssetLocalizeEnabled(): boolean {
  return process.env.ASSET_LOCALIZE === 'on';
}

export interface AssetLimits {
  maxAssets: number;
  maxBytesPerAsset: number;
  maxTotalBytes: number;
  timeoutMs: number;
  concurrency: number;
}

/**
 * 默认上限。数字不是拍脑袋：单张 5MB 覆盖绝大多数 Hero 大图，
 * 总量 40MB 约等于一个正常营销站的全站图片，超了就说明我们在抓数据而不是抓资产。
 */
export const DEFAULT_LIMITS: AssetLimits = {
  maxAssets: 40,
  maxBytesPerAsset: 5 * 1024 * 1024,
  maxTotalBytes: 40 * 1024 * 1024,
  timeoutMs: 10_000,
  concurrency: 4,
};

/** 只下载这些类型。HTML/CSS/JS 不在 P2-03 范围内（那是「复刻」不是「搬运」）。 */
const ALLOWED_MIME_PREFIXES = ['image/', 'font/'];
const ALLOWED_MIME_EXACT = [
  'application/font-woff',
  'application/font-woff2',
  'application/x-font-woff',
  'application/x-font-ttf',
  'application/vnd.ms-fontobject',
  'text/svg+xml',
];

// ---------------------------------------------------------------------------
// 结果类型
// ---------------------------------------------------------------------------

export type AssetStatus = 'downloaded' | 'placeholder' | 'skipped';

export interface LocalizedAsset {
  url: string;
  type: AssetData['type'];
  status: AssetStatus;
  /** 相对 `website-package/` 的路径，如 `assets/ab12….png`。可直接写进生成的工程。 */
  localPath?: string;
  /** 占位图路径（`status==='placeholder'` 时必有）。 */
  placeholderPath?: string;
  mimeType?: string;
  /** 字节数（占位图为占位 SVG 的大小）。 */
  size?: number;
  /** sha256（内容哈希）——P2-03 验收要求的 hash 字段。 */
  hash?: string;
  /** 原图宽高；解析不出则缺省（不猜）。 */
  width?: number;
  height?: number;
  /** 判据：连续 401/403 命中一次，说明原站很可能开了防盗链。 */
  hotlinkSuspected?: boolean;
  reason?: string;
}

export interface LocalizeResult {
  jobId: string;
  assets: LocalizedAsset[];
  counts: { downloaded: number; placeholder: number; skipped: number };
  totalBytes: number;
  /** manifest 的写入结果（含失败原因，不再是「静默没产物」）。 */
  manifest: WriteArtifactResult;
  /** 全局性问题（如 jobId 非法）；单个资源的问题在各自的 `reason` 里。 */
  errors: string[];
}

export interface LocalizeOptions extends Partial<AssetLimits> {
  jobId: string;
  /** 落盘根目录覆盖（测试用）。 */
  root?: string;
  /** 页面 URL —— 作为防盗链重试时的 `Referer`。 */
  sourceUrl?: string;
  /** 注入 fetch（测试用）。 */
  fetchImpl?: typeof fetch;
}

// ---------------------------------------------------------------------------
// 占位策略（P2-03 ③）
// ---------------------------------------------------------------------------

/**
 * 生成确定性的本地占位 SVG。
 *
 * 「确定性」很重要：同一个 URL 生成的占位图字节完全相同，
 * 因此可以按内容 hash 去重、可以在两次采集之间对比，
 * 而不是每次都产生一个随机噪声图把 diff 淹掉。
 *
 * 尺寸用原图宽高（拿不到就 1200×800，即典型 Hero 比例），**保证布局不塌**。
 */
export function buildPlaceholderSvg(asset: { url: string; width?: number; height?: number; role?: string }): string {
  const w = asset.width && asset.width > 0 ? asset.width : 1200;
  const h = asset.height && asset.height > 0 ? asset.height : 800;

  // 站点名与角色只是给人看的线索，不参与布局；做一次极简转义
  let host = '';
  try {
    host = new URL(asset.url).host;
  } catch {
    host = '';
  }
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string));
  const label = esc(asset.role ? `${asset.role} · ${host}` : host);

  // 中灰底 + 虚线框：在任何配色下都读作「这里缺一张图」，不会被误当成真内容
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="asset unavailable">`,
    '<rect width="100%" height="100%" fill="#E9ECEF"/>',
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#ADB5BD" stroke-width="2" stroke-dasharray="12 8"/>`,
    `<text x="50%" y="50%" fill="#6C757D" font-family="system-ui,sans-serif" font-size="${Math.max(14, Math.round(Math.min(w, h) / 18))}" text-anchor="middle" dominant-baseline="middle">${label || 'asset unavailable'}</text>`,
    '</svg>',
  ].join('');
}

// ---------------------------------------------------------------------------
// 下载
// ---------------------------------------------------------------------------

function extFromMime(mime: string): string {
  const m = mime.split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
    'image/svg+xml': 'svg',
    'font/woff': 'woff',
    'font/woff2': 'woff2',
    'font/ttf': 'ttf',
    'font/otf': 'otf',
    'application/font-woff': 'woff',
  };
  return map[m] ?? 'bin';
}

function isAllowedMime(mime: string): boolean {
  const m = mime.split(';')[0].trim().toLowerCase();
  if (ALLOWED_MIME_EXACT.includes(m)) return true;
  return ALLOWED_MIME_PREFIXES.some((p) => m.startsWith(p));
}

/** 取页面 origin，用于防盗链重试的 Referer。 */
function refererFor(sourceUrl: string | undefined): string | null {
  if (!sourceUrl) return null;
  try {
    return new URL(sourceUrl).origin + '/';
  } catch {
    return null;
  }
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

interface DownloadOutcome {
  ok: boolean;
  buf?: Buffer;
  mimeType?: string;
  status?: number;
  /** 命中了 401/403 —— 原站很可能开了防盗链。 */
  hotlink?: boolean;
  reason?: string;
}

/**
 * 下载单个资源。
 *
 * 防盗链处理（P2-03 ③ 的判据来源）：先不带 Referer 请求一次；
 * 若返回 401/403，则带上 `Referer: <页面 origin>` 再试一次 ——
 * 这是热链拦截最常见的实现方式，补上 Referer 往往就能过。
 * 两次都失败则**如实记下 `hotlink: true`**，交给占位策略。
 */
async function downloadAsset(
  url: string,
  opts: { timeoutMs: number; maxBytes: number; fetchImpl: typeof fetch; referer: string | null },
): Promise<DownloadOutcome> {
  const attempt = async (referer: string | null): Promise<DownloadOutcome> => {
    const ctrl = new AbortController();
    // 用 AbortController + setTimeout 而非 AbortSignal.timeout：后者计时器不可清除，
    // 且在 keep-alive 连接下会继续约束后续请求（同 src/lib/mimo.ts 的取舍）。
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    try {
      const headers: Record<string, string> = { 'User-Agent': UA, Accept: 'image/*,font/*;q=0.8,*/*;q=0.5' };
      if (referer) headers.Referer = referer;

      const res = await opts.fetchImpl(url, { headers, signal: ctrl.signal, redirect: 'follow' });
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          hotlink: res.status === 401 || res.status === 403,
          reason: `HTTP ${res.status}`,
        };
      }

      const mimeType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (mimeType && !isAllowedMime(mimeType)) {
        return { ok: false, mimeType, reason: `不支持的 Content-Type：${mimeType}` };
      }

      // 先看声明长度，能省下一次大流量传输
      const declared = Number(res.headers.get('content-length') || '0');
      if (declared && declared > opts.maxBytes) {
        return { ok: false, mimeType, reason: `超过单资源上限（${declared} > ${opts.maxBytes}）` };
      }

      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.length > opts.maxBytes) {
        return { ok: false, mimeType, reason: `超过单资源上限（${buf.length} > ${opts.maxBytes}）` };
      }
      if (buf.length === 0) {
        return { ok: false, mimeType, reason: '响应体为空' };
      }
      return { ok: true, buf, mimeType };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg.includes('abort') ? `超时（${opts.timeoutMs}ms）` : msg };
    } finally {
      clearTimeout(timer);
    }
  };

  const first = await attempt(null);
  if (first.ok || !first.hotlink || !opts.referer) return first;

  const retry = await attempt(opts.referer);
  if (retry.ok) return retry;
  // 两次都拦 → 明确落到「防盗链」这个原因上，而不是含糊的 HTTP 403
  return { ...retry, hotlink: true, reason: `疑似防盗链（无 Referer ${first.status} → 带 Referer ${retry.status ?? '失败'}）` };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * 把一个数据包的 `assets` 全部本地化。
 *
 * 产物：
 *   `runs/<jobId>/website-package/assets/<sha256 前 16 位>.<ext>`         —— 真实的图
 *   `runs/<jobId>/website-package/assets/placeholders/<sha256 前 16 位>.svg` —— 占位图
 *   `runs/<jobId>/website-package/assets/manifest.json`                  —— 宽高/类型/hash/状态
 *
 * **永不抛错**（jobId 非法这类全局问题会进 `errors` 并返回空结果）。
 */
export async function localizeAssets(
  assets: AssetData[],
  options: LocalizeOptions,
): Promise<LocalizeResult> {
  const limits: AssetLimits = { ...DEFAULT_LIMITS, ...options };
  const fetchImpl = options.fetchImpl ?? fetch;
  const referer = refererFor(options.sourceUrl);
  const errors: string[] = [];

  const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
  const candidates = (Array.isArray(assets) ? assets : []).filter((a) => a && isStr(a.url));

  const dirForHash = (hash: string) => `assets/${hash.slice(0, 16)}`;

  const results: LocalizedAsset[] = [];
  let totalBytes = 0;

  // ---- 逐批并发，批内并行、批间串行（避免一次性打出几十个连接）----
  for (let i = 0; i < candidates.length; i += limits.concurrency) {
    const batch = candidates.slice(i, i + limits.concurrency);
    const settled = await Promise.all(
      batch.map(async (asset): Promise<LocalizedAsset> => {
        const base: LocalizedAsset = { url: asset.url, type: asset.type, status: 'skipped' };

        if (results.length >= limits.maxAssets) {
          return { ...base, reason: `超过资源条数上限（${limits.maxAssets}）` };
        }
        if (totalBytes >= limits.maxTotalBytes) {
          return { ...base, reason: `超过总量上限（${limits.maxTotalBytes}）` };
        }

        const dl = await downloadAsset(asset.url, {
          timeoutMs: limits.timeoutMs,
          maxBytes: limits.maxBytesPerAsset,
          fetchImpl,
          referer,
        });

        if (dl.ok && dl.buf) {
          const hash = sha256(dl.buf);
          const mime = dl.mimeType || asset.mimeType || 'application/octet-stream';
          const localPath = `${dirForHash(hash)}.${extFromMime(mime)}`;
          const write = await writeRunArtifact(options.jobId, ['website-package', ...localPath.split('/')], dl.buf, options.root);
          if (!write.ok) {
            return { ...base, reason: `写盘失败：${write.reason ?? '未知原因'}`, hotlinkSuspected: dl.hotlink };
          }
          totalBytes += dl.buf.length;

          const size = parseImageSize(dl.buf);
          return {
            url: asset.url,
            type: assetTypeFromMime(mime, asset.url),
            status: 'downloaded',
            localPath,
            mimeType: mime,
            size: dl.buf.length,
            hash,
            ...(size ? { width: size.width, height: size.height } : {}),
          };
        }

        // ---- 失败 → 占位策略（P2-03 ③）----
        const hash = createHash('sha256').update(asset.url).digest('hex');
        const placeholderRel = `assets/placeholders/${hash.slice(0, 16)}.svg`;
        const svg = Buffer.from(
          buildPlaceholderSvg({ url: asset.url, role: asset.role }),
          'utf8',
        );
        const write = await writeRunArtifact(options.jobId, ['website-package', ...placeholderRel.split('/')], svg, options.root);
        if (!write.ok) {
          return {
            ...base,
            reason: `下载失败（${dl.reason ?? '未知原因'}）且占位图写盘失败：${write.reason ?? '未知原因'}`,
            hotlinkSuspected: dl.hotlink,
          };
        }
        totalBytes += svg.length;

        // 原图宽高拿不到，占位图就用默认比例 —— 但 manifest 里如实标 width/height 缺省语义
        return {
          url: asset.url,
          type: assetTypeFromMime(dl.mimeType ?? '', asset.url),
          status: 'placeholder',
          localPath: placeholderRel,
          placeholderPath: placeholderRel,
          mimeType: 'image/svg+xml',
          size: svg.length,
          hash,
          ...(dl.hotlink ? { hotlinkSuspected: true } : {}),
          reason: dl.reason ?? '下载失败',
        };
      }),
    );
    results.push(...settled);
  }

  const counts = {
    downloaded: results.filter((r) => r.status === 'downloaded').length,
    placeholder: results.filter((r) => r.status === 'placeholder').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
  };

  const manifestBody = {
    jobId: options.jobId,
    sourceUrl: options.sourceUrl ?? null,
    capturedAt: new Date().toISOString(),
    // 与 P1-14 的 manifest 字段对齐，便于两次采集对比
    schemaVersion: '1.3.0',
    tool: 'src/lib/assets/localize.ts',
    limits,
    counts,
    totalBytes,
    assets: results,
  };

  const manifest = await writeRunArtifact(
    options.jobId,
    ['website-package', 'assets', 'manifest.json'],
    JSON.stringify(manifestBody, null, 2),
    options.root,
  );
  if (!manifest.ok) errors.push(`manifest 写盘失败：${manifest.reason ?? '未知原因'}`);

  return {
    jobId: options.jobId,
    assets: results,
    counts,
    totalBytes,
    manifest,
    errors,
  };
}

/**
 * 把本地化结果回填进数据包 —— **这是 P2-03 ② 的落地点**
 * （「生成项目引用本地资源路径」）。
 *
 * 回填规则刻意简单：**只改 `localPath`，不改 `url`**。
 * 原 URL 必须留着 —— 排查「这张图原来是什么」时它是唯一线索；
 * 而下游（formatter / 生成器）约定优先使用 `localPath`。
 *
 * 返回新数组，不改原对象（避免调用方共享引用被意外改写）。
 */
export function applyLocalPaths(assets: AssetData[], localized: LocalizedAsset[]): AssetData[] {
  const byUrl = new Map(localized.filter((l) => l.localPath).map((l) => [l.url, l]));
  return assets.map((a) => {
    const hit = byUrl.get(a.url);
    if (!hit?.localPath) return a;
    return {
      ...a,
      localPath: hit.localPath,
      ...(hit.mimeType ? { mimeType: hit.mimeType } : {}),
      ...(typeof hit.size === 'number' ? { size: hit.size } : {}),
      ...(hit.hash ? { hash: hit.hash } : {}),
      ...(typeof hit.width === 'number' ? { width: hit.width } : {}),
      ...(typeof hit.height === 'number' ? { height: hit.height } : {}),
    };
  });
}

/**
 * 开关包装：与归档/报告同一个模式 —— 关闭时不下载、不写盘，返回 null。
 * 调用方据此决定是否回填。
 */
export async function localizePackageAssetsIfEnabled(
  assets: AssetData[],
  options: LocalizeOptions & { enabled?: boolean },
): Promise<LocalizeResult | null> {
  const enabled = options.enabled ?? isAssetLocalizeEnabled();
  if (!enabled) return null;
  try {
    return await localizeAssets(assets, options);
  } catch (err) {
    // localizeAssets 内部已尽量收敛异常；这里是最后一道网。
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[assets] 本地化异常 ${options.jobId}: ${message}`);
    return {
      jobId: options.jobId,
      assets: [],
      counts: { downloaded: 0, placeholder: 0, skipped: 0 },
      totalBytes: 0,
      manifest: { ok: false, reason: message },
      errors: [message],
    };
  }
}

/** 一行摘要，供日志取证。 */
export function summarizeLocalize(result: LocalizeResult): string {
  const hotlink = result.assets.filter((a) => a.hotlinkSuspected).length;
  const mb = (result.totalBytes / 1024 / 1024).toFixed(2);
  const size = result.totalBytes < 1024 * 1024
    ? `${(result.totalBytes / 1024).toFixed(1)}KB`
    : `${mb}MB`;
  return [
    `已下载 ${result.counts.downloaded}`,
    `占位 ${result.counts.placeholder}`,
    `跳过 ${result.counts.skipped}`,
    `共 ${size}`,
    hotlink ? `疑似防盗链 ${hotlink}` : '',
  ].filter(Boolean).join(' · ');
}
