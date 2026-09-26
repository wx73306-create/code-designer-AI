// =====================================================================
// verify:assets —— 资源本地化的真机验收（P2-03）
// ---------------------------------------------------------------------
// vitest 里用的是注入的假 fetch（快、可控）。这里补的是**产物级 + 真网络**验收：
//   1. 起一个真的 node:http 服务，故意实现三种行为：
//        /ok.png      → 200 image/png（真实 PNG 字节）
//        /hot.png     → 无 Referer 403 / 带 Referer 200（**模拟防盗链**）
//        /blocked.png → 永远 403（**防盗链且绕不过**）
//        /gone.png    → 200 text/html（软 404 的常见形态）
//   2. 跑真实的 localizeAssets → 真的落盘到临时 runs/ 目录；
//   3. 校验 P2-03 的三条验收标准，并额外断言「提示词里不再出现原站 host」。
//
// 为什么要真起服务：防盗链重试是本条目的核心行为，而它完全体现在
// 「第二次请求带不带 Referer」上 —— 假 fetch 只能验证我们自己的调用代码，
// 真服务才能验证**改动真的产生了预期的那一次带 Referer 的请求**。
// =====================================================================

import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { localizeAssets, summarizeLocalize } from '@/lib/assets/localize';
import { applyLocalPaths } from '@/lib/assets/localize';
import { formatPackageContext } from '@/lib/website-package/formatter';
import type { AssetData, WebsitePackage } from '@/types/website-package';

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    failures++;
    console.log(`  ❌ ${label}${detail ? `\n      ${detail}` : ''}`);
  }
}

/** 真实的最小合法 PNG（1440×900），尺寸可被 parseImageSize 解出。 */
function pngBytes(w: number, h: number): Buffer {
  const b = Buffer.alloc(33);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(0x0d0a1a0a, 4);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}

/** 请求日志：用来证明「防盗链重试确实发生了一次带 Referer 的请求」。 */
const requestLog: Array<{ path: string; referer: string | null }> = [];

const server = createServer((req, res) => {
  const u = new URL(req.url ?? '/', 'http://localhost');
  const referer = (req.headers.referer as string | undefined) ?? null;
  requestLog.push({ path: u.pathname, referer });

  if (u.pathname === '/ok.png') {
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(pngBytes(1440, 900));
    return;
  }
  if (u.pathname === '/hot.png') {
    // 典型防盗链：不带 Referer 就拒绝，带上同站 Referer 就放行
    if (referer) {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(pngBytes(800, 600));
    } else {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
    }
    return;
  }
  if (u.pathname === '/blocked.png') {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('forbidden');
    return;
  }
  if (u.pathname === '/gone.png') {
    // 软 404：状态码 200 但内容其实是 HTML —— 最容易骗过朴素实现的一种
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><body>404 Not Found</body></html>');
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as { port: number }).port;
const origin = `http://127.0.0.1:${port}`;
const pageUrl = `${origin}/page`;

console.log('='.repeat(78));
console.log('P2-03 资源本地化验收（真 HTTP + 真落盘）');
console.log(`测试服务器：${origin}`);
console.log('='.repeat(78));

const root = await mkdtemp(path.join(os.tmpdir(), 'cda-verify-assets-'));
const jobId = 'gen_verify_assets';

const assets: AssetData[] = [
  { type: 'image', url: `${origin}/ok.png`, role: 'hero' },
  { type: 'image', url: `${origin}/hot.png`, role: 'product' },
  { type: 'image', url: `${origin}/blocked.png`, role: 'testimonial' },
  { type: 'image', url: `${origin}/gone.png`, role: 'logo' },
];

let result: Awaited<ReturnType<typeof localizeAssets>> | null = null;
try {
  result = await localizeAssets(assets, { jobId, root, sourceUrl: pageUrl, concurrency: 1 });
} catch (err) {
  failures++;
  console.log(`  ❌ localizeAssets 抛错了（契约要求永不抛错）：${err instanceof Error ? err.message : String(err)}`);
}

console.log('\n[1] ① manifest：宽高 / 类型 / hash');
if (result) {
  check('manifest 写盘成功', result.manifest.ok, result.manifest.reason);
  try {
    const manifest = JSON.parse(
      await readFile(path.join(root, jobId, 'website-package', 'assets', 'manifest.json'), 'utf8'),
    );
    check('manifest 含 jobId / sourceUrl / counts', manifest.jobId === jobId && manifest.sourceUrl === pageUrl && !!manifest.counts);
    const okEntry = manifest.assets.find((a: { url: string }) => a.url.endsWith('/ok.png'));
    check('真实资源的 width/height 被解出（1440×900）', okEntry?.width === 1440 && okEntry?.height === 900,
      JSON.stringify(okEntry));
    check('真实资源的 hash 是 64 位 sha256', /^[0-9a-f]{64}$/.test(okEntry?.hash ?? ''));
    check('真实资源的 type/mimeType 正确', okEntry?.type === 'image' && okEntry?.mimeType === 'image/png');
  } catch (err) {
    check('manifest 可解析', false, err instanceof Error ? err.message : String(err));
  }
} else {
  check('manifest 写盘成功', false, 'localizeAssets 未返回结果');
}

console.log('\n[2] ③ 防盗链与占位策略');
if (result) {
  const byRole = (role: string) => result!.assets.find((a) => a.url.endsWith(`/${role === 'hero' ? 'ok' : role}.png`))!;

  check('无 Referer 403 → 带 Referer 重试 → 成功下载（hot.png）',
    byRole('hot').status === 'downloaded' && byRole('hot').hotlinkSuspected === undefined,
    JSON.stringify(byRole('hot')));

  const hotCalls = requestLog.filter((r) => r.path === '/hot.png');
  check('防盗链重试确实发生了两次请求，且第二次带 Referer',
    hotCalls.length === 2 && hotCalls[0].referer === null && hotCalls[1].referer === `${origin}/`,
    JSON.stringify(hotCalls));

  check('两次都 403 → 落占位图并标注 hotlinkSuspected（blocked.png）',
    byRole('blocked').status === 'placeholder' && byRole('blocked').hotlinkSuspected === true,
    JSON.stringify(byRole('blocked')));
  check('占位图的 localPath 指向 placeholders/ 下的 SVG',
    (byRole('blocked').localPath ?? '').startsWith('assets/placeholders/')
    && (byRole('blocked').localPath ?? '').endsWith('.svg'),
    byRole('blocked').localPath);

  check('软 404（200 + text/html）也被挡下并落占位（gone.png）',
    byRole('gone').status === 'placeholder' && (byRole('gone').reason ?? '').includes('不支持的 Content-Type'),
    JSON.stringify(byRole('gone')));

  check('占位文件真的存在于磁盘上',
    await readFile(path.join(root, jobId, 'website-package', byRole('blocked').localPath!), 'utf8')
      .then((s) => s.includes('<svg'))
      .catch(() => false));
} else {
  check('防盗链与占位策略', false, 'localizeAssets 未返回结果');
}

console.log('\n[3] ② 生成项目引用本地路径');
if (result) {
  const localized = applyLocalPaths(assets, result.assets);
  const pkg = {
    version: '1.3.0',
    url: pageUrl,
    assets: localized,
  } as unknown as WebsitePackage;

  const prompt = formatPackageContext(pkg);
  check('提示词含本地路径', localized.some((a) => !!a.localPath) && prompt.includes('必须引用此本地路径'));
  // 注意：不能断言「整段提示词里没有 host」—— 页面来源 URL 本来就会出现在头部。
  // 要断言的是「**任何一条资源的原始 URL 都不再出现**」，即资源不再热链。
  const leaked = localized.filter((a) => prompt.includes(a.url));
  check('任何一条资源的原始 URL 都不再出现在提示词里（不再热链）',
    leaked.length === 0,
    leaked.map((a) => a.url).join(' | '));
  const assetBlock = prompt.split('### 资源')[1]?.split('\n### ')[0] ?? '';
  check('资源块内一个 http(s) URL 都没有', !/https?:\/\//.test(assetBlock), assetBlock.trim().slice(0, 200));
  check('占位资源被告知「保持尺寸即可，不要试图还原内容」', prompt.includes('不要试图还原内容'));
  check('原 URL 仍保留在数据里（排查线索不丢）', localized.every((a) => a.url.startsWith(origin)));

  console.log(`      摘要：${summarizeLocalize(result)}`);
} else {
  check('生成项目引用本地路径', false, 'localizeAssets 未返回结果');
}

server.close();
await rm(root, { recursive: true, force: true });

console.log('\n' + '='.repeat(78));
if (failures === 0) {
  console.log('✅ P2-03 资源本地化验收全部通过');
} else {
  console.log(`❌ P2-03 资源本地化验收失败 ${failures} 项`);
}
console.log('='.repeat(78));

process.exit(failures === 0 ? 0 : 1);
