/**
 * 数据包落盘归档测试（P1-10 / S-03 / P1-14）
 * ===================================================================
 * 重点锁死三件事：
 *   1. **目录标准与执行计划书 §五 一致** —— 否则「按标准归档」只是说法；
 *   2. **base64 不进 package.json** —— 一张全页截图 base64 就 10MB+，
 *      塞进 JSON 会让归档既不可读也不可 diff；
 *   3. **永不抛错** —— 归档是旁路能力，磁盘问题不该把成功的生成变成失败。
 */

import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createEmptyPackage, type WebsitePackage } from '@/types/website-package';
import {
  archivePackageIfEnabled,
  archiveWebsitePackage,
  isPackageArchiveEnabled,
  parseDataUrl,
  sanitizeJobId,
} from './archive';
import substantiveFixture from '@/lib/schemas/__fixtures__/substantive-package.json';

let root = '';

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'wp-archive-'));
});

afterEach(async () => {
  delete process.env.PACKAGE_ARCHIVE;
  if (root) await rm(root, { recursive: true, force: true });
});

function pkg(over: Partial<WebsitePackage> = {}): WebsitePackage {
  const base = JSON.parse(JSON.stringify(substantiveFixture)) as WebsitePackage;
  return { ...base, ...over };
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe('archiveWebsitePackage · 目录标准（执行计划书 §五）', () => {
  it('产出 manifest.json / package.json 与六个分目录', async () => {
    const r = await archiveWebsitePackage(pkg(), { jobId: 'job-001', root });

    expect(r.ok).toBe(true);
    expect(r.relativeDir).toBe(path.join('job-001', 'website-package'));

    const dir = path.join(root, 'job-001', 'website-package');
    for (const rel of [
      'manifest.json',
      'package.json',
      'dom/sections.json',
      'dom/structure.html',
      'styles/styles.json',
      'assets/assets.json',
      'layout/flow.json',
      'interaction/interaction.json',
    ]) {
      expect(await exists(path.join(dir, rel)), `缺少 ${rel}`).toBe(true);
    }
  });

  it('manifest 含 P1-14 要求的可追溯字段', async () => {
    await archiveWebsitePackage(pkg(), { jobId: 'job-meta', root, toolVersions: { scraper: '1.0.0' } });
    const manifest = JSON.parse(
      await readFile(path.join(root, 'job-meta', 'website-package', 'manifest.json'), 'utf8'),
    );

    expect(manifest.sourceUrl).toBe('https://stripe.com');
    expect(manifest.capturedAt).toBe('2026-09-26T08:00:00.000Z');
    expect(manifest.schemaVersion).toBe('1.3.0');
    expect(manifest.toolVersions).toEqual({ scraper: '1.0.0' });
    expect(manifest.jobId).toBe('job-meta');
    // 归档时把当时的契约体检结论一起存下来 —— 将来回读才知道它是否可信
    expect(manifest.contract.valid).toBe(true);
    expect(manifest.contract.substantive).toBe(true);
    expect(manifest.counts.sections).toBe(3);
    expect(manifest.counts.interaction).toBe(true);
  });

  it('两次归档同一 URL 可通过 manifest 对比（P1-14 验收标准）', async () => {
    await archiveWebsitePackage(pkg(), { jobId: 'runA', root });
    await archiveWebsitePackage(pkg({ capturedAt: '2026-09-27T00:00:00.000Z' }), { jobId: 'runB', root });

    const a = JSON.parse(await readFile(path.join(root, 'runA', 'website-package', 'manifest.json'), 'utf8'));
    const b = JSON.parse(await readFile(path.join(root, 'runB', 'website-package', 'manifest.json'), 'utf8'));
    expect(a.sourceUrl).toBe(b.sourceUrl);
    expect(a.capturedAt).not.toBe(b.capturedAt);
  });
});

describe('archiveWebsitePackage · base64 剥离 + 两种负载形态', () => {
  it('截图落成真实图片文件，package.json 里不含 base64', async () => {
    // 1x1 PNG
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const withShot = pkg();
    withShot.screenshots = [{ viewport: 'desktop', width: 1440, height: 900, dataUrl }];

    const r = await archiveWebsitePackage(withShot, { jobId: 'job-shot', root });
    expect(r.ok).toBe(true);

    const dir = path.join(root, 'job-shot', 'website-package');
    expect(await exists(path.join(dir, 'screenshots/00-desktop.png'))).toBe(true);

    const raw = await readFile(path.join(dir, 'package.json'), 'utf8');
    expect(raw).not.toContain('base64');
    expect(raw).not.toContain('iVBORw0KGgo');

    const archived = JSON.parse(raw);
    expect(archived.screenshots[0].file).toBe('00-desktop.png');
    expect(archived.screenshots[0].width).toBe(1440);
    expect(archived.screenshots[0].dataUrl).toBeUndefined();
  });

  it('没有 dataUrl 的截图照样保留元数据，只是没有 file', async () => {
    const p = pkg();
    p.screenshots = [{ viewport: 'mobile', width: 390, height: 844 }];
    await archiveWebsitePackage(p, { jobId: 'job-noshot', root });

    const archived = JSON.parse(
      await readFile(path.join(root, 'job-noshot', 'website-package', 'package.json'), 'utf8'),
    );
    expect(archived.screenshots[0]).toMatchObject({ viewport: 'mobile', width: 390 });
    expect(archived.screenshots[0].file).toBeUndefined();
  });

  /**
   * 【真机回归】2026-09-26：把新镜像切上生产、跑真实生成后**去数目录**才发现
   * `screenshots/` 根本没被创建。原因是本文件原先只认 `data:…;base64,`，
   * 而真实生产者给的是**裸 base64** —— `src/lib/screenshot.ts` 的 `heroBase64`
   * 注释写得很清楚：*without data URI prefix*。
   *
   * 上面那个用例之所以一直绿，是因为**测试喂的形态和生产喂的形态不一样**。
   * 这三条用例就是为此加的：形态必须覆盖真实生产者。
   */
  it('【真机回归】裸 base64（真实生产者形态）也必须落成图片文件', async () => {
    const bare =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const p = pkg();
    p.screenshots = [{ viewport: 'desktop', width: 1, height: 1, dataUrl: bare }];

    const r = await archiveWebsitePackage(p, { jobId: 'job-bare', root });
    expect(r.ok).toBe(true);

    const dir = path.join(root, 'job-bare', 'website-package');
    expect(await exists(path.join(dir, 'screenshots/00-desktop.png'))).toBe(true);

    const archived = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
    expect(archived.screenshots[0].file).toBe('00-desktop.png');
    expect(archived.screenshots[0].dataUrl).toBeUndefined();
  });

  it('裸 base64 的扩展名来自**图片头**，不是硬编码 png', async () => {
    const gif = Buffer.alloc(10);
    gif.write('GIF89a', 0, 'ascii');
    gif.writeUInt16LE(320, 6);
    gif.writeUInt16LE(200, 8);
    const p = pkg();
    p.screenshots = [{ viewport: 'desktop', width: 320, height: 200, dataUrl: gif.toString('base64') }];

    await archiveWebsitePackage(p, { jobId: 'job-gif', root });

    expect(await exists(path.join(root, 'job-gif', 'website-package', 'screenshots/00-desktop.gif')))
      .toBe(true);
  });

  it('既不是 data URL 也不是已知图片格式 → 不写文件，但不静默（元数据保留）', async () => {
    const p = pkg();
    p.screenshots = [{
      viewport: 'desktop',
      width: 10,
      height: 10,
      dataUrl: Buffer.from('not an image at all').toString('base64'),
    }];

    await archiveWebsitePackage(p, { jobId: 'job-junk', root });

    const dir = path.join(root, 'job-junk', 'website-package');
    expect(await exists(path.join(dir, 'screenshots'))).toBe(false);
    const archived = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
    // 登记了元数据但明确没有 file —— 「有截图但写不出来」是可见的，不再被吞掉
    expect(archived.screenshots[0].file).toBeUndefined();
    expect(archived.screenshots[0].viewport).toBe('desktop');
  });
});

describe('archiveWebsitePackage · interaction 目录的语义', () => {
  it('采集到交互内容时建 interaction/ 目录', async () => {
    await archiveWebsitePackage(pkg(), { jobId: 'job-i1', root });
    expect(await exists(path.join(root, 'job-i1', 'website-package', 'interaction', 'interaction.json'))).toBe(true);
  });

  it('interaction 为空时**不建目录**（空目录会让人误判「采过但没交互」）', async () => {
    const empty = pkg();
    // 注意：按架构约定，这种情况本该是 `undefined`（见 WebsitePackage.interaction 注释）。
    // 这里刻意构造「填了空对象」的坏形态，验证归档层不会把它当成「采到过交互」。
    empty.interaction = {
      scrolls: [],
      clicks: [],
      states: [],
      animations: [],
      meta: {
        capturedAt: '2026-09-26T08:00:05.000Z',
        viewport: { width: 1440, height: 900 },
        documentHeight: 0,
        screenshotCount: 0,
      },
    };
    await archiveWebsitePackage(empty, { jobId: 'job-i2', root });
    expect(await exists(path.join(root, 'job-i2', 'website-package', 'interaction'))).toBe(false);
  });

  it('interaction 缺失（未采集）时不建目录', async () => {
    const none = pkg();
    delete none.interaction;
    await archiveWebsitePackage(none, { jobId: 'job-i3', root });
    expect(await exists(path.join(root, 'job-i3', 'website-package', 'interaction'))).toBe(false);
  });
});

describe('archiveWebsitePackage · 安全与健壮性', () => {
  it('拒绝路径穿越的 jobId', async () => {
    for (const bad of ['../../etc', '..', 'a/../../b', '']) {
      const r = await archiveWebsitePackage(pkg(), { jobId: bad, root });
      // 注意：'a/../../b' 会被消毒成 'a_.._.._b'，其中含 '..' → 必须拒绝
      expect(r.ok).toBe(false);
      expect(r.reason).toContain('jobId 非法');
    }
  });

  it('空包也能归档（归档不是校验闸门，坏包也要留证）', async () => {
    const r = await archiveWebsitePackage(createEmptyPackage('https://example.com'), { jobId: 'job-empty', root });
    expect(r.ok).toBe(true);
    const manifest = JSON.parse(
      await readFile(path.join(root, 'job-empty', 'website-package', 'manifest.json'), 'utf8'),
    );
    expect(manifest.contract.valid).toBe(true);
    expect(manifest.contract.substantive).toBe(false);
    expect(manifest.counts.sections).toBe(0);
  });

  it('磁盘写入失败时返回 ok:false 而**不抛错**（旁路能力不能影响主流程）', async () => {
    // 用一个「父路径是文件」的 root，mkdir 必然失败
    const fileRoot = path.join(root, 'not-a-dir');
    await writeFile(fileRoot, 'x');
    const r = await archiveWebsitePackage(pkg(), { jobId: 'job-fail', root: fileRoot });

    expect(r.ok).toBe(false);
    expect(typeof r.reason).toBe('string');
    expect(r.files).toEqual([]);
  });
});

describe('旁路开关', () => {
  it('默认关闭（未设 PACKAGE_ARCHIVE 时不落盘）', async () => {
    delete process.env.PACKAGE_ARCHIVE;
    expect(isPackageArchiveEnabled()).toBe(false);
    const r = await archivePackageIfEnabled(pkg(), { jobId: 'job-off', root });
    expect(r).toBeNull();
    expect(await exists(path.join(root, 'job-off'))).toBe(false);
  });

  it('PACKAGE_ARCHIVE=on 时才落盘', async () => {
    process.env.PACKAGE_ARCHIVE = 'on';
    expect(isPackageArchiveEnabled()).toBe(true);
    const r = await archivePackageIfEnabled(pkg(), { jobId: 'job-on', root });
    expect(r?.ok).toBe(true);
  });
});

describe('parseDataUrl', () => {
  it('识别常见图片类型', () => {
    expect(parseDataUrl('data:image/png;base64,AAA')).toEqual({ ext: 'png', mime: 'image/png' });
    expect(parseDataUrl('data:image/jpeg;base64,AAA')).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
    expect(parseDataUrl('data:image/webp;base64,AAA')).toEqual({ ext: 'webp', mime: 'image/webp' });
    expect(parseDataUrl('data:image/svg+xml;base64,AAA')).toEqual({ ext: 'svg', mime: 'image/svg+xml' });
  });

  it('非 data URL 返回 null（不猜格式）', () => {
    expect(parseDataUrl('https://x.com/a.png')).toBeNull();
    expect(parseDataUrl('')).toBeNull();
  });
});

describe('sanitizeJobId', () => {
  it('保留合法字符并截断', () => {
    expect(sanitizeJobId('gen_mui4360h_oosuaa')).toBe('gen_mui4360h_oosuaa');
    expect(sanitizeJobId('a b/c')).toBe('a_b_c');
    expect((sanitizeJobId('x'.repeat(200)) ?? '').length).toBe(96);
  });

  it('拒绝空值与穿越', () => {
    expect(sanitizeJobId('')).toBeNull();
    expect(sanitizeJobId('..')).toBeNull();
    expect(sanitizeJobId('a/../../b')).toBeNull();
  });
});
