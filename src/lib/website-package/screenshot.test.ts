/**
 * 截图入包（P1-06 / P1-10）与「参考截图」提示词段的行为锁定。
 *
 * 这一组测试防的是同一件事：**宽高必须是量出来的，不是填出来的。**
 * 契约里 `ScreenshotData.width/height` 是必填 number，所以一旦有人图省事
 * 写个 `width: 1440, height: 900` 兜底，下游就再也分不清「真采到了」和「猜的」。
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_SCREENSHOT_BASE64_CHARS,
  decodeScreenshotDataUrl,
} from './screenshot';
import { buildWebsitePackage } from './adapter';
import { formatPackageContext } from './formatter';

/** 造一张「头部合法」的 PNG：解析器只需要签名 + 偏移 12 的 'IHDR' + 宽高。 */
function pngBase64(width: number, height: number): string {
  const buf = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8); // IHDR 长度
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf.toString('base64');
}

describe('decodeScreenshotDataUrl · 宽高来自图片头', () => {
  it('裸 base64：解析出真实宽高与格式来源，默认视口 desktop', () => {
    const shot = decodeScreenshotDataUrl(pngBase64(1280, 800));

    expect(shot).not.toBeNull();
    expect(shot!.width).toBe(1280);
    expect(shot!.height).toBe(800);
    expect(shot!.viewport).toBe('desktop');
    expect(shot!.description).toContain('fullPage=false');
  });

  it('不同尺寸得到不同结果 —— 防止把常量当测量（此测试会抓住任何硬编码兜底）', () => {
    const a = decodeScreenshotDataUrl(pngBase64(640, 480));
    const b = decodeScreenshotDataUrl(pngBase64(1920, 1080));

    expect([a!.width, a!.height]).toEqual([640, 480]);
    expect([b!.width, b!.height]).toEqual([1920, 1080]);
  });

  it('带 data URL 前缀也能解析，并原样保留 dataUrl（归档要用它写文件）', () => {
    const b64 = pngBase64(1440, 900);
    const shot = decodeScreenshotDataUrl(`data:image/png;base64,${b64}`);

    expect(shot!.width).toBe(1440);
    expect(shot!.height).toBe(900);
    expect(shot!.dataUrl).toBe(`data:image/png;base64,${b64}`);
  });

  it('可指定视口标签', () => {
    expect(decodeScreenshotDataUrl(pngBase64(390, 844), 'mobile')!.viewport).toBe('mobile');
  });

  it('视口传空串时回落到 desktop，不写空字符串进契约', () => {
    // 契约里 viewport 有 minLength: 1 —— 空串会直接违约。
    expect(decodeScreenshotDataUrl(pngBase64(800, 600), '')!.viewport).toBe('desktop');
  });
});

describe('decodeScreenshotDataUrl · 一切不确定都返回 null（"未知"）', () => {
  it('非字符串输入', () => {
    expect(decodeScreenshotDataUrl(undefined)).toBeNull();
    expect(decodeScreenshotDataUrl(null)).toBeNull();
    expect(decodeScreenshotDataUrl(123)).toBeNull();
    expect(decodeScreenshotDataUrl({ dataUrl: 'x' })).toBeNull();
  });

  it('空串与纯空白', () => {
    expect(decodeScreenshotDataUrl('')).toBeNull();
    expect(decodeScreenshotDataUrl('   \n ')).toBeNull();
  });

  it('非 base64 的 data URL（明文 SVG）—— 硬解会得到垃圾字节，必须放弃', () => {
    expect(decodeScreenshotDataUrl('data:image/svg+xml,<svg width="10" height="10"/>')).toBeNull();
  });

  it('缺逗号的 data URL', () => {
    expect(decodeScreenshotDataUrl('data:image/png;base64')).toBeNull();
  });

  it('base64 合法但不是已知图片格式 → 尺寸未知 → 不入包', () => {
    expect(decodeScreenshotDataUrl(Buffer.from('这不是图片').toString('base64'))).toBeNull();
  });

  it('超长输入按未知处理，不抛错（防误传把内存打爆）', () => {
    const huge = 'A'.repeat(MAX_SCREENSHOT_BASE64_CHARS + 1);
    expect(decodeScreenshotDataUrl(huge)).toBeNull();
  });
});

describe('接入 buildWebsitePackage', () => {
  it('不传 screenshot → screenshots 为空（"没采过"的唯一正确表示）', () => {
    const pkg = buildWebsitePackage({ scraped: null });
    expect(pkg.screenshots).toEqual([]);
  });

  it('传了解析成功的 screenshot → 进包且契约要求的三字段齐全', () => {
    const shot = decodeScreenshotDataUrl(pngBase64(1280, 800))!;
    const pkg = buildWebsitePackage({ scraped: null, screenshot: shot });

    expect(pkg.screenshots).toHaveLength(1);
    expect(pkg.screenshots[0]).toMatchObject({ viewport: 'desktop', width: 1280, height: 800 });
  });
});

describe('formatter · 参考截图段', () => {
  it('没有截图时不产生空标题', () => {
    const text = formatPackageContext(buildWebsitePackage({ scraped: null }));
    expect(text).not.toContain('参考截图');
  });

  it('有截图时声明尺寸，且**绝不把 base64 写进提示词**', () => {
    const shot = decodeScreenshotDataUrl(pngBase64(1280, 800))!;
    const pkg = buildWebsitePackage({ scraped: null, screenshot: shot });
    const text = formatPackageContext(pkg);

    expect(text).toContain('### 参考截图');
    expect(text).toContain('1280×800 px');
    // 关键：提示词里不能出现 base64 本体，否则一张 1–3MB 的图会直接打爆上下文。
    expect(text).not.toContain(shot.dataUrl!);
    expect(text.length).toBeLessThan(2000);
  });
});
