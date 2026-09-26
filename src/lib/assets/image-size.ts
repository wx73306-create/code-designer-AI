/**
 * 图片尺寸解析（P2-03 · manifest 要求「宽高、类型、hash」）
 * ===================================================================
 * 为什么不装 `image-size` / `sharp`：
 *   本机 npm 官方源极慢且 install 常挂死（见项目环境备忘），为一个 200 行的
 *   头部解析去引入依赖，收益远小于风险。而我们**只需要宽高**——
 *   这五个格式的尺寸都写在文件头固定偏移处，不需要解码像素。
 *
 * 支持：PNG / JPEG / GIF / BMP / WebP / SVG（SVG 走文本属性，不是二进制头）。
 *
 * 契约：**解析不出来就返回 null，绝不猜。** manifest 里宁可缺宽高，
 * 也不要一个编造的数字 —— 与 B.2.4.3「假数据比没数据更危险」同一条原则。
 */

export interface ParsedImageSize {
  width: number;
  height: number;
  /** 识别到的格式；当 mimeType 缺失时可用来兜底推断。 */
  format: 'png' | 'jpeg' | 'gif' | 'bmp' | 'webp' | 'svg';
}

function u16be(b: Buffer, o: number): number {
  return b.readUInt16BE(o);
}
function u32be(b: Buffer, o: number): number {
  return b.readUInt32BE(o);
}
function u16le(b: Buffer, o: number): number {
  return b.readUInt16LE(o);
}
function u32le(b: Buffer, o: number): number {
  return b.readUInt32LE(o);
}
function i32le(b: Buffer, o: number): number {
  return b.readInt32LE(o);
}

function ok(width: number, height: number, format: ParsedImageSize['format']): ParsedImageSize | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { width: Math.round(width), height: Math.round(height), format };
}

// ---------------------------------------------------------------------------
// PNG —— 签名后紧跟 IHDR，宽高在固定偏移 16 / 20
// ---------------------------------------------------------------------------
function parsePng(b: Buffer): ParsedImageSize | null {
  if (b.length < 24) return null;
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  if (b.toString('ascii', 12, 16) !== 'IHDR') return null;
  return ok(u32be(b, 16), u32be(b, 20), 'png');
}

// ---------------------------------------------------------------------------
// JPEG —— 需要遍历段；只有 SOF0..SOF15（去掉 DHT/DAC/RST）带尺寸
// ---------------------------------------------------------------------------
function parseJpeg(b: Buffer): ParsedImageSize | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;

  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++; // 段间填充字节，继续找下一个 marker
      continue;
    }
    let marker = b[i + 1];
    // 0xFF 填充
    while (marker === 0xff && i + 2 < b.length) {
      i++;
      marker = b[i + 1];
    }
    // 无长度字段的独立 marker
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      i += 2;
      continue;
    }
    if (marker === 0xda) break; // 进入扫描数据，后面没有尺寸了
    const segLen = u16be(b, i + 2);
    if (segLen < 2) break;
    const isSof =
      marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 // DHT
      && marker !== 0xc8 // JPG
      && marker !== 0xcc; // DAC
    if (isSof) {
      if (i + 9 > b.length) return null;
      return ok(u16be(b, i + 7), u16be(b, i + 5), 'jpeg');
    }
    i += 2 + segLen;
  }
  return null;
}

// ---------------------------------------------------------------------------
// GIF / BMP
// ---------------------------------------------------------------------------
function parseGif(b: Buffer): ParsedImageSize | null {
  if (b.length < 10) return null;
  const sig = b.toString('ascii', 0, 6);
  if (sig !== 'GIF87a' && sig !== 'GIF89a') return null;
  return ok(u16le(b, 6), u16le(b, 8), 'gif');
}

function parseBmp(b: Buffer): ParsedImageSize | null {
  if (b.length < 26 || b.toString('ascii', 0, 2) !== 'BM') return null;
  // 高度可能为负（自上而下位图），取绝对值
  return ok(i32le(b, 18), Math.abs(i32le(b, 22)), 'bmp');
}

// ---------------------------------------------------------------------------
// WebP —— RIFF 容器内有三种子格式，尺寸位置各不相同
// ---------------------------------------------------------------------------
function parseWebp(b: Buffer): ParsedImageSize | null {
  if (b.length < 30) return null;
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;

  const fourcc = b.toString('ascii', 12, 16);

  if (fourcc === 'VP8 ') {
    // 有损：起始码 0x9d 0x01 0x2a 之后两个 u16le（各 14 位有效）
    const start = b.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 12);
    if (start < 0 || start + 7 > b.length) return null;
    return ok(u16le(b, start + 3) & 0x3fff, u16le(b, start + 5) & 0x3fff, 'webp');
  }
  if (fourcc === 'VP8L') {
    // 无损：签名 0x2f 之后 28 位 = 14 位宽 + 14 位高（各减 1）
    if (b[20] !== 0x2f) return null;
    const bits = u32le(b, 21);
    return ok((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1, 'webp');
  }
  if (fourcc === 'VP8X') {
    // 扩展：canvas 宽高各 24 位 LE，存的是「减 1」
    const w = b[24] | (b[25] << 8) | (b[26] << 16);
    const h = b[27] | (b[28] << 8) | (b[29] << 16);
    return ok(w + 1, h + 1, 'webp');
  }
  return null;
}

// ---------------------------------------------------------------------------
// SVG —— 文本格式，读 width/height 属性，退化到 viewBox
// ---------------------------------------------------------------------------
function parseSvgLength(v: string | undefined): number | null {
  if (!v) return null;
  const m = v.trim().match(/^([0-9]*\.?[0-9]+)\s*(px|pt)?$/i);
  if (!m) return null; // 含 % / em 的无法确定像素值 → 不猜
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseSvg(b: Buffer): ParsedImageSize | null {
  const text = b.toString('utf8', 0, Math.min(b.length, 8192));
  if (!/<svg[\s>]/i.test(text)) return null;

  const svgTag = text.match(/<svg\b[^>]*>/i)?.[0] ?? '';

  // 属性可能带命名空间前缀（xlink 不用于 width），也允许单双引号
  const attr = (name: string): string | undefined =>
    svgTag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))?.slice(2).find(Boolean);

  const w = parseSvgLength(attr('width'));
  const h = parseSvgLength(attr('height'));
  if (w && h) return ok(w, h, 'svg');

  // 退化到 viewBox="minX minY w h"
  const vb = attr('viewBox') ?? attr('viewbox');
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3])) {
      const vw = w ?? parts[2];
      const vh = h ?? parts[3];
      if (vw > 0 && vh > 0) return ok(vw, vh, 'svg');
    }
  }
  return null;
}

/**
 * 从文件头解析图片宽高。
 *
 * @param buf 文件前若干字节即可（建议 ≥64 字节；SVG 建议给全量前 8KB）
 * @returns 解析不出时为 null —— **不猜、不兜底**。
 */
export function parseImageSize(buf: Buffer): ParsedImageSize | null {
  if (!buf || buf.length < 8) return null;
  return (
    parsePng(buf)
    ?? parseJpeg(buf)
    ?? parseGif(buf)
    ?? parseBmp(buf)
    ?? parseWebp(buf)
    ?? parseSvg(buf)
  );
}

/** 由 Content-Type 推断 `AssetData.type`。未知一律归 image（资源多为图片）。 */
export function assetTypeFromMime(mime: string, url: string): 'image' | 'svg' | 'font' | 'icon' {
  const m = mime.toLowerCase();
  if (m.includes('svg')) return 'svg';
  if (m.startsWith('font/') || m.includes('woff') || m.includes('ttf') || m.includes('otf')) return 'font';
  if (m.startsWith('image/')) return 'image';
  // Content-Type 不可信时看扩展名
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'svg') return 'svg';
  if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext)) return 'font';
  if (['ico', 'icns'].includes(ext)) return 'icon';
  return 'image';
}
