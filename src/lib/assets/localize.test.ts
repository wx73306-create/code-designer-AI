/**
 * 资源本地化测试（P2-03）
 * ===================================================================
 * 对着 P2-03 的三条验收标准逐条锁：
 *   ① `assets/` + manifest（宽高、类型、hash）
 *   ② 生成项目引用**本地**资源路径（→ 与 formatter 的集成断言）
 *   ③ **防盗链失败时有占位策略**（→ 403/超大/超时/类型不符 四条路径）
 *
 * 外加一条本项目的通用底线：**永不抛错**。
 */

import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatPackageContext } from '@/lib/website-package/formatter';
import type { AssetData, WebsitePackage } from '@/types/website-package';

import {
  applyLocalPaths,
  buildPlaceholderSvg,
  isAssetLocalizeEnabled,
  localizeAssets,
  localizePackageAssetsIfEnabled,
  summarizeLocalize,
  type LocalizeOptions,
} from './localize';

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

let root = '';

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'asset-localize-'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.ASSET_LOCALIZE;
  if (root) await rm(root, { recursive: true, force: true });
});

function png(w: number, h: number): Buffer {
  const b = Buffer.alloc(33);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(0x0d0a1a0a, 4);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}

interface Call {
  url: string;
  referer: string | null;
}

/** 造一个可编排的假 fetch，并记录每次调用（用来断言 Referer 重试确实发生过）。 */
function fakeFetch(
  handler: (url: string, referer: string | null) => Response | Promise<Response>,
): { impl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const referer = headers.Referer ?? null;
    calls.push({ url, referer });
    return handler(url, referer);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function binary(buf: Buffer, mime: string): Response {
  return new Response(new Uint8Array(buf), { status: 200, headers: { 'content-type': mime } });
}

function asset(url: string, type: AssetData['type'] = 'image', role?: string): AssetData {
  return role ? { url, type, role } : { url, type };
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function opts(over: Partial<LocalizeOptions> = {}): LocalizeOptions {
  return {
    jobId: 'gen_test_1',
    root,
    sourceUrl: 'https://example.com/page',
    concurrency: 1,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// ① manifest：宽高 / 类型 / hash
// ---------------------------------------------------------------------------

describe('localizeAssets · ① manifest 契约', () => {
  it('下载成功时写宽高、类型、hash，并把文件真的落盘', async () => {
    const { impl } = fakeFetch(() => binary(png(1440, 900), 'image/png'));
    const res = await localizeAssets([asset('https://cdn.example.com/hero.png', 'image', 'hero')], opts({ fetchImpl: impl }));

    expect(res.counts).toEqual({ downloaded: 1, placeholder: 0, skipped: 0 });

    const a = res.assets[0];
    expect(a.status).toBe('downloaded');
    expect(a.mimeType).toBe('image/png');
    expect(a.width).toBe(1440);
    expect(a.height).toBe(900);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.size).toBe(33);
    expect(a.localPath).toMatch(/^assets\/[0-9a-f]{16}\.png$/);

    // 文件真实存在（不只是元数据）
    expect(await exists(path.join(root, 'gen_test_1', 'website-package', a.localPath!))).toBe(true);
  });

  it('manifest.json 带 jobId / 上限 / counts / totalBytes / 逐项宽高', async () => {
    const { impl } = fakeFetch(() => binary(png(640, 480), 'image/png'));
    const res = await localizeAssets([asset('https://cdn.example.com/a.png')], opts({ fetchImpl: impl }));

    expect(res.manifest.ok).toBe(true);
    const manifest = JSON.parse(
      await readFile(path.join(root, 'gen_test_1', 'website-package', 'assets', 'manifest.json'), 'utf8'),
    );
    expect(manifest.jobId).toBe('gen_test_1');
    expect(manifest.sourceUrl).toBe('https://example.com/page');
    expect(manifest.counts.downloaded).toBe(1);
    expect(manifest.totalBytes).toBe(33);
    expect(manifest.limits.maxAssets).toBe(40);
    expect(manifest.assets[0]).toMatchObject({ width: 640, height: 480, mimeType: 'image/png' });
  });

  it('内容相同的两个 URL 去重到同一个文件（hash 寻址）', async () => {
    const { impl } = fakeFetch(() => binary(png(10, 10), 'image/png'));
    const res = await localizeAssets(
      [asset('https://cdn.example.com/a.png'), asset('https://cdn2.example.com/b.png')],
      opts({ fetchImpl: impl }),
    );

    expect(res.assets[0].localPath).toBe(res.assets[1].localPath);
    expect(res.assets[0].hash).toBe(res.assets[1].hash);
  });

  it('类型由 Content-Type 与扩展名共同推断', async () => {
    const { impl } = fakeFetch((url) =>
      url.endsWith('.svg')
        ? binary(Buffer.from('<svg width="10" height="10"></svg>'), 'image/svg+xml')
        : binary(Buffer.alloc(0), 'application/octet-stream'),
    );
    const res = await localizeAssets([asset('https://cdn.example.com/logo.svg')], opts({ fetchImpl: impl }));
    expect(res.assets[0].type).toBe('svg');
    expect(res.assets[0].localPath).toMatch(/\.svg$/);
    expect(res.assets[0].width).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// ③ 防盗链与占位策略
// ---------------------------------------------------------------------------

describe('localizeAssets · ③ 占位策略', () => {
  it('两次都 403 → 落占位图，且如实标记 hotlinkSuspected', async () => {
    const { impl, calls } = fakeFetch(() => new Response('forbidden', { status: 403 }));
    const res = await localizeAssets([asset('https://cdn.example.com/hot.png')], opts({ fetchImpl: impl }));

    const a = res.assets[0];
    expect(a.status).toBe('placeholder');
    expect(a.hotlinkSuspected).toBe(true);
    expect(a.localPath).toMatch(/^assets\/placeholders\/[0-9a-f]{16}\.svg$/);
    expect(a.reason).toContain('疑似防盗链');
    // 第一次不带 Referer、第二次带 —— 这正是「防盗链重试」的判据
    expect(calls).toHaveLength(2);
    expect(calls[0].referer).toBeNull();
    expect(calls[1].referer).toBe('https://example.com/');
    expect(await exists(path.join(root, 'gen_test_1', 'website-package', a.localPath!))).toBe(true);
  });

  it('带 Referer 重试成功 → 记为已下载，且不标 hotlink', async () => {
    const { impl } = fakeFetch((_url, referer) =>
      referer ? binary(png(200, 100), 'image/png') : new Response('nope', { status: 403 }),
    );
    const res = await localizeAssets([asset('https://cdn.example.com/hot2.png')], opts({ fetchImpl: impl }));

    expect(res.assets[0].status).toBe('downloaded');
    expect(res.assets[0].hotlinkSuspected).toBeUndefined();
    expect(res.assets[0].width).toBe(200);
  });

  it('没有 sourceUrl 时不重试（无从伪造 Referer），只请求一次', async () => {
    const { impl, calls } = fakeFetch(() => new Response('forbidden', { status: 403 }));
    await localizeAssets([asset('https://cdn.example.com/x.png')], opts({ fetchImpl: impl, sourceUrl: undefined }));
    expect(calls).toHaveLength(1);
  });

  it('超过单资源上限 → 占位（不会把 50MB 拖进来）', async () => {
    const { impl } = fakeFetch(() => binary(png(10, 10), 'image/png'));
    const res = await localizeAssets([asset('https://cdn.example.com/big.png')], opts({ fetchImpl: impl, maxBytesPerAsset: 8 }));

    expect(res.assets[0].status).toBe('placeholder');
    expect(res.assets[0].reason).toContain('超过单资源上限');
  });

  it('content-length 声明就超大时提前拒绝（不下载正文）', async () => {
    const { impl } = fakeFetch(() =>
      new Response(new Uint8Array(png(10, 10)), {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': String(9 * 1024 * 1024) },
      }),
    );
    const res = await localizeAssets([asset('https://cdn.example.com/huge.png')], opts({ fetchImpl: impl, maxBytesPerAsset: 1024 }));
    expect(res.assets[0].reason).toContain('超过单资源上限');
  });

  it('Content-Type 不在白名单（如 text/html 的软 404）→ 占位', async () => {
    const { impl } = fakeFetch(() => binary(Buffer.from('<html>not found</html>'), 'text/html'));
    const res = await localizeAssets([asset('https://cdn.example.com/gone.png')], opts({ fetchImpl: impl }));

    expect(res.assets[0].status).toBe('placeholder');
    expect(res.assets[0].reason).toContain('不支持的 Content-Type');
  });

  it('超时 / 网络异常 → 占位而不是抛错', async () => {
    const { impl } = fakeFetch(() => Promise.reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })));
    const res = await localizeAssets([asset('https://cdn.example.com/slow.png')], opts({ fetchImpl: impl, timeoutMs: 5 }));

    expect(res.assets[0].status).toBe('placeholder');
    expect(res.assets[0].reason).toContain('超时');
  });

  it('空响应体 → 占位（避免落一个 0 字节的图片）', async () => {
    const { impl } = fakeFetch(() => binary(Buffer.alloc(0), 'image/png'));
    const res = await localizeAssets([asset('https://cdn.example.com/empty.png')], opts({ fetchImpl: impl }));
    expect(res.assets[0].reason).toBe('响应体为空');
  });

  it('占位图是确定性 SVG：同 URL 两次生成字节相同', () => {
    const a = buildPlaceholderSvg({ url: 'https://x.com/a.png', role: 'hero' });
    const b = buildPlaceholderSvg({ url: 'https://x.com/a.png', role: 'hero' });
    expect(a).toBe(b);
    expect(a).toContain('<svg');
    expect(a).toContain('1200'); // 拿不到原图尺寸时的默认宽度
  });

  it('占位图用上已知的原图尺寸（布局不塌）', () => {
    const svg = buildPlaceholderSvg({ url: 'https://x.com/a.png', width: 320, height: 180 });
    expect(svg).toContain('width="320"');
    expect(svg).toContain('height="180"');
  });
});

// ---------------------------------------------------------------------------
// 上限与鲁棒性
// ---------------------------------------------------------------------------

describe('localizeAssets · 上限', () => {
  it('超过条数上限的记为 skipped 并说明原因', async () => {
    const { impl } = fakeFetch(() => binary(png(10, 10), 'image/png'));
    const assets = Array.from({ length: 4 }, (_, i) => asset(`https://cdn.example.com/${i}.png`));
    const res = await localizeAssets(assets, opts({ fetchImpl: impl, maxAssets: 2 }));

    expect(res.counts.downloaded).toBe(2);
    expect(res.counts.skipped).toBe(2);
    expect(res.assets.filter((a) => a.status === 'skipped').every((a) => a.reason?.includes('条数上限'))).toBe(true);
  });

  it('达到总量上限后其余跳过（上限只在开始前判定，最多超出「一个资源」的量）', async () => {
    const { impl } = fakeFetch(() => binary(png(10, 10), 'image/png')); // 每个 33 字节
    const assets = Array.from({ length: 3 }, (_, i) => asset(`https://cdn.example.com/${i}.png`));
    const res = await localizeAssets(assets, opts({ fetchImpl: impl, maxTotalBytes: 40 }));

    // 刻意**不预扣**：判定发生在下载前，所以总量最多超出「单个资源」的大小
    // （33 → 66 后才触发跳过）。这比按 maxBytesPerAsset 预扣更实用：
    // 预扣会让「40MB 上限 + 5MB 单图上限」变成实际只能下 35MB，白丢空间。
    expect(res.counts.downloaded).toBe(2);
    expect(res.counts.skipped).toBe(1);
    expect(res.totalBytes).toBe(66);
    expect(res.assets.some((a) => a.reason?.includes('总量上限'))).toBe(true);
  });

  it('jobId 非法（路径穿越）→ 全部拒绝，但不抛错、manifest 给出失败原因', async () => {
    const { impl } = fakeFetch(() => binary(png(10, 10), 'image/png'));
    const res = await localizeAssets([asset('https://cdn.example.com/a.png')], opts({ fetchImpl: impl, jobId: '../../etc' }));

    expect(res.counts.downloaded).toBe(0);
    expect(res.assets[0].status).toBe('skipped');
    expect(res.assets[0].reason).toContain('写盘失败');
    expect(res.manifest.ok).toBe(false);
    expect(res.errors[0]).toContain('manifest 写盘失败');
  });

  it('assets 为 undefined / 含非法项时不炸', async () => {
    const { impl } = fakeFetch(() => binary(png(10, 10), 'image/png'));
    const res = await localizeAssets(
      // @ts-expect-error 故意传入脏数据
      [null, { type: 'image', url: '' }, asset('https://cdn.example.com/ok.png')],
      opts({ fetchImpl: impl }),
    );
    expect(res.assets).toHaveLength(1);
    expect(res.counts.downloaded).toBe(1);
  });

  it('空数组时仍写出一份空 manifest（下游不需要判断文件是否存在）', async () => {
    const res = await localizeAssets([], opts());
    expect(res.counts.downloaded).toBe(0);
    expect(res.manifest.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ② 生成项目引用本地路径
// ---------------------------------------------------------------------------

describe('applyLocalPaths · ② 回填', () => {
  it('只改 localPath，保留原 url（排查时唯一线索）', async () => {
    const { impl } = fakeFetch(() => binary(png(100, 50), 'image/png'));
    const input = [asset('https://cdn.example.com/a.png', 'image', 'logo')];
    const res = await localizeAssets(input, opts({ fetchImpl: impl }));

    const out = applyLocalPaths(input, res.assets);
    expect(out[0].url).toBe('https://cdn.example.com/a.png');
    expect(out[0].role).toBe('logo');
    expect(out[0].localPath).toMatch(/^assets\//);
    expect(out[0].width).toBe(100);
    expect(out[0].hash).toMatch(/^[0-9a-f]{64}$/);
    // 原数组未被改写
    expect(input[0].localPath).toBeUndefined();
  });

  it('没下载成功的资源不产生 localPath（宁缺毋滥）', () => {
    const input = [asset('https://cdn.example.com/a.png')];
    const out = applyLocalPaths(input, []);
    expect(out[0].localPath).toBeUndefined();
    expect(out[0]).toEqual(input[0]);
  });
});

describe('formatter 集成 · 本地路径必须胜出', () => {
  function pkgWith(assets: AssetData[]): WebsitePackage {
    return { version: '1.3.0', url: 'https://example.com', assets } as WebsitePackage;
  }

  it('有 localPath 时提示词里**只出现本地路径**，不出现原站 URL', async () => {
    const { impl } = fakeFetch(() => binary(png(1200, 600), 'image/png'));
    const input = [asset('https://cdn.example.com/hero.jpg', 'image', 'hero')];
    const res = await localizeAssets(input, opts({ fetchImpl: impl }));
    const localized = applyLocalPaths(input, res.assets);

    const prompt = formatPackageContext(pkgWith(localized));
    expect(prompt).toContain('必须引用此本地路径');
    expect(prompt).toContain(localized[0].localPath!);
    expect(prompt).not.toContain('cdn.example.com');
    expect(prompt).toContain('禁止**在产物里出现任何指向原站的资源 URL');
  });

  it('占位资源会被告知「保持尺寸即可，不要试图还原内容」', async () => {
    const { impl } = fakeFetch(() => new Response('forbidden', { status: 403 }));
    const input = [asset('https://cdn.example.com/blocked.png', 'image', 'product')];
    const res = await localizeAssets(input, opts({ fetchImpl: impl }));
    const localized = applyLocalPaths(input, res.assets);

    const prompt = formatPackageContext(pkgWith(localized));
    expect(prompt).toContain('本地占位图');
    expect(prompt).toContain('不要试图还原内容');
  });

  it('未本地化时如实标注「外链，不可依赖」', () => {
    const prompt = formatPackageContext(pkgWith([asset('https://cdn.example.com/raw.png')]));
    expect(prompt).toContain('外链，不可依赖');
    expect(prompt).toContain('未本地化');
  });
});

// ---------------------------------------------------------------------------
// 开关与日志
// ---------------------------------------------------------------------------

describe('开关与摘要', () => {
  it('默认关闭：localizePackageAssetsIfEnabled 直接返回 null（不下载）', async () => {
    const { impl, calls } = fakeFetch(() => binary(png(10, 10), 'image/png'));
    const res = await localizePackageAssetsIfEnabled([asset('https://cdn.example.com/a.png')], opts({ fetchImpl: impl }));
    expect(res).toBeNull();
    expect(calls).toHaveLength(0);
    expect(isAssetLocalizeEnabled()).toBe(false);
  });

  it('开启后才真的下载', async () => {
    process.env.ASSET_LOCALIZE = 'on';
    const { impl, calls } = fakeFetch(() => binary(png(10, 10), 'image/png'));
    const res = await localizePackageAssetsIfEnabled([asset('https://cdn.example.com/a.png')], opts({ fetchImpl: impl }));
    expect(isAssetLocalizeEnabled()).toBe(true);
    expect(calls).toHaveLength(1);
    expect(res?.counts.downloaded).toBe(1);
  });

  it('summarizeLocalize 一行说清下载/占位/跳过/体积/防盗链', async () => {
    const { impl } = fakeFetch((url) =>
      url.includes('ok') ? binary(png(10, 10), 'image/png') : new Response('forbidden', { status: 403 }),
    );
    const res = await localizeAssets(
      [asset('https://cdn.example.com/ok.png'), asset('https://cdn.example.com/bad.png')],
      opts({ fetchImpl: impl }),
    );
    const s = summarizeLocalize(res);
    expect(s).toContain('已下载 1');
    expect(s).toContain('占位 1');
    expect(s).toContain('疑似防盗链 1');
  });
});
