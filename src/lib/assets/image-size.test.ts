/**
 * 图片尺寸解析测试（P2-03 · manifest 的「宽高」字段）
 * ===================================================================
 * 核心契约：**解析不出来就返回 null，绝不猜。**
 * 因此这里既测「能解析的」，也**专门测「不该解析出来的」**——
 * 后者比前者重要：一个编造的宽高会静默写进 manifest，
 * 让「我们有宽高信息」这句话变成假的。
 */

import { describe, expect, it } from 'vitest';

import { assetTypeFromMime, parseImageSize } from './image-size';

// ---------------------------------------------------------------------------
// 构造最小合法文件头
// ---------------------------------------------------------------------------

function png(w: number, h: number): Buffer {
  const b = Buffer.alloc(33);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(0x0d0a1a0a, 4);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  b[24] = 8; // bit depth
  b[25] = 6; // color type
  return b;
}

function jpeg(w: number, h: number): Buffer {
  const app0 = Buffer.concat([
    Buffer.from([0xff, 0xe0, 0x00, 0x10]),
    Buffer.alloc(14, 0x20),
  ]);
  const sof0 = Buffer.concat([
    Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08]),
    Buffer.from([(h >> 8) & 0xff, h & 0xff, (w >> 8) & 0xff, w & 0xff]),
    Buffer.from([0x03]),
    Buffer.alloc(9, 0x01),
  ]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0, Buffer.from([0xff, 0xd9])]);
}

function gif(w: number, h: number): Buffer {
  const b = Buffer.alloc(13);
  b.write('GIF89a', 0, 'ascii');
  b.writeUInt16LE(w, 6);
  b.writeUInt16LE(h, 8);
  return b;
}

function bmp(w: number, h: number, negativeHeight = false): Buffer {
  const b = Buffer.alloc(54);
  b.write('BM', 0, 'ascii');
  b.writeInt32LE(w, 18);
  b.writeInt32LE(negativeHeight ? -h : h, 22);
  return b;
}

function webpVp8x(w: number, h: number): Buffer {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(22, 4);
  b.write('WEBP', 8, 'ascii');
  b.write('VP8X', 12, 'ascii');
  b.writeUInt32LE(10, 16);
  // flags 20..23
  const cw = w - 1;
  const ch = h - 1;
  b[24] = cw & 0xff; b[25] = (cw >> 8) & 0xff; b[26] = (cw >> 16) & 0xff;
  b[27] = ch & 0xff; b[28] = (ch >> 8) & 0xff; b[29] = (ch >> 16) & 0xff;
  return b;
}

function webpVp8l(w: number, h: number): Buffer {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  b.write('VP8L', 12, 'ascii');
  b[20] = 0x2f;
  const bits = ((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14);
  b.writeUInt32LE(bits >>> 0, 21);
  return b;
}

function webpVp8(w: number, h: number): Buffer {
  const b = Buffer.alloc(40);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  b.write('VP8 ', 12, 'ascii');
  const start = 23;
  b[start] = 0x9d; b[start + 1] = 0x01; b[start + 2] = 0x2a;
  b.writeUInt16LE(w, start + 3);
  b.writeUInt16LE(h, start + 5);
  return b;
}

// ---------------------------------------------------------------------------

describe('parseImageSize · 二进制头', () => {
  it('PNG —— 读 IHDR 的 16/20 偏移', () => {
    expect(parseImageSize(png(1440, 900))).toEqual({ width: 1440, height: 900, format: 'png' });
  });

  it('JPEG —— 跳过 APP0 后读 SOF0', () => {
    expect(parseImageSize(jpeg(800, 600))).toEqual({ width: 800, height: 600, format: 'jpeg' });
  });

  it('JPEG —— 段间 0xFF 填充不影响定位', () => {
    const withPadding = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xff, 0xff]), jpeg(320, 240).subarray(2)]);
    expect(parseImageSize(withPadding)).toEqual({ width: 320, height: 240, format: 'jpeg' });
  });

  it('GIF —— 小端 u16', () => {
    expect(parseImageSize(gif(24, 24))).toEqual({ width: 24, height: 24, format: 'gif' });
  });

  it('BMP —— 高度为负（自上而下位图）时取绝对值', () => {
    expect(parseImageSize(bmp(100, 50, true))).toEqual({ width: 100, height: 50, format: 'bmp' });
  });

  it('WebP VP8X —— 存储值是「宽高减 1」', () => {
    expect(parseImageSize(webpVp8x(1920, 1080))).toEqual({ width: 1920, height: 1080, format: 'webp' });
  });

  it('WebP VP8L —— 14 位打包', () => {
    expect(parseImageSize(webpVp8l(512, 256))).toEqual({ width: 512, height: 256, format: 'webp' });
  });

  it('WebP VP8（有损）—— 从起始码定位', () => {
    expect(parseImageSize(webpVp8(640, 360))).toEqual({ width: 640, height: 360, format: 'webp' });
  });
});

describe('parseImageSize · SVG', () => {
  it('双引号 width/height', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect/></svg>');
    expect(parseImageSize(svg)).toEqual({ width: 120, height: 40, format: 'svg' });
  });

  it('带 px 单位', () => {
    const svg = Buffer.from(`<svg width='64px' height='64px'></svg>`);
    expect(parseImageSize(svg)).toEqual({ width: 64, height: 64, format: 'svg' });
  });

  it('只有 viewBox 时从 viewBox 推', () => {
    const svg = Buffer.from('<svg viewBox="0 0 32 20"></svg>');
    expect(parseImageSize(svg)).toEqual({ width: 32, height: 20, format: 'svg' });
  });

  it('viewport 会缺失，所以比 viewBox 小是正常的（不猜）', () => {
    const svg = Buffer.from('<svg viewBox="0 0 32 20"></svg>');
    expect(parseImageSize(svg)?.height).toBe(20);
  });

  it('width 是百分比时**不猜**（宁可 null）', () => {
    const svg = Buffer.from('<svg width="100%" height="100%" viewBox="0 0 10 10"></svg>');
    // 百分比无法确定像素值；退化到 viewBox 是正确的处置
    expect(parseImageSize(svg)).toEqual({ width: 10, height: 10, format: 'svg' });
  });
});

describe('parseImageSize · 必须返回 null 的情况（不猜）', () => {
  it.each([
    ['空 Buffer', Buffer.alloc(0)],
    ['太短', Buffer.from([0x89, 0x50])],
    ['纯文本', Buffer.from('this is not an image at all')],
    ['被截断的 PNG 签名', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(20)])],
    ['PNG 签名对但 IHDR 缺失', (() => { const b = png(10, 10); b.write('XXXX', 12, 'ascii'); return b; })()],
    ['随机字节', Buffer.from(Array.from({ length: 64 }, (_, i) => (i * 37) % 256))],
  ])('%s', (_label, buf) => {
    expect(parseImageSize(buf)).toBeNull();
  });

  it('宽高为 0 视为无效（不会产出 0×0 的 manifest 记录）', () => {
    expect(parseImageSize(png(0, 100))).toBeNull();
    expect(parseImageSize(gif(0, 0))).toBeNull();
  });

  it('SVG 的 viewBox 非法时不返回垃圾数字', () => {
    const svg = Buffer.from('<svg viewBox="0 0 abc def"></svg>');
    expect(parseImageSize(svg)).toBeNull();
  });
});

describe('assetTypeFromMime', () => {
  it.each([
    ['image/png', 'https://x/a.png', 'image'],
    ['image/svg+xml', 'https://x/a', 'svg'],
    ['font/woff2', 'https://x/f', 'font'],
    ['application/octet-stream', 'https://x/a.svg', 'svg'],
    ['application/octet-stream', 'https://x/a.woff2?v=3', 'font'],
    ['application/octet-stream', 'https://x/favicon.ico', 'icon'],
    ['', 'https://x/mystery', 'image'],
  ])('%s + %s → %s', (mime, url, expected) => {
    expect(assetTypeFromMime(mime, url)).toBe(expected);
  });
});
