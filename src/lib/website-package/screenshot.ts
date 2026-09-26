/**
 * 截图入包：把客户端传来的截图 base64 变成**契约合法**的 {@link ScreenshotData}。
 * ===================================================================
 * 为什么需要这一层（2026-09-26 补）：
 *
 * 计划书 §五 的数据包目录标准里明确有 `screenshots/`，P1-06 也要求「完整页截图」。
 * 但 `buildWebsitePackage()` 只在**入参带 `screenshot`** 时才填 `pkg.screenshots`，
 * 而 `/api/mimo` 的三处调用都只传了 `scraped` / `interaction` / `layout` ——
 * 结果是：**目录标准里的 `screenshots/` 永远不会被创建**，"标准"只是一句声明。
 *
 * 截图其实是有的：客户端把 `/api/screenshot` 的 `heroBase64`（**视口裁剪图**，
 * `fullPage: false`）随请求体当作 `screenshotBase64` 传上来，route 把它塞进
 * `images[]` 给 Vision。**模型看见了，数据包里却没有。** 这正是本项目反复出现的
 * 那一个根因：中间层只在内存里、没进契约。
 *
 * 两个刻意的设计决定
 * ------------------
 * 1. **宽高不猜。** 契约里 `width` / `height` 是必填 number，所以「不知道就留空」
 *    这条退路不存在 —— 只能**真解析**或**不入包**。这里复用
 *    {@link parseImageSize} 从图片头读真实像素；解析不出来就返回 `null`，
 *    调用方据此**不填**这个字段。绝不写一个「看起来合理」的 1440×900。
 * 2. **语义要说清。** `ScreenshotData.height` 注释是「视口高度」，而这个值来自
 *    图片自身的像素高 —— 两者只有在截图是**视口裁剪图**时才相等。当前生产者
 *    （`heroBase64`，`fullPage: false`）满足这个前提，所以语义是对的；但一旦有人
 *    改成传 `fullPageBase64`，`height` 就会变成**整页高**而不再是视口高。
 *    因此这里把来源写进 `description`，让下游有机会发现语义漂移。
 */

import { parseImageSize } from '@/lib/assets/image-size';
import type { ScreenshotData } from '@/types/website-package';

/**
 * base64 字符数上限（约 18MB 二进制）。
 *
 * 只防「误传一个超大字符串把内存打爆」，不是业务限制：正常 1280×800 的 PNG
 * base64 在 1–3MB 量级。超限按**未知**处理（返回 `null`），不抛错。
 */
export const MAX_SCREENSHOT_BASE64_CHARS = 24 * 1024 * 1024;

/**
 * 把截图 base64（或 data URL）解析成可入包的 {@link ScreenshotData}。
 *
 * 接受的输入形态：
 *   · `iVBORw0KGgo…`                       —— 裸 base64（当前生产者的形态）
 *   · `data:image/png;base64,iVBORw0…`     —— 带前缀的 data URL
 *
 * **不**接受 `data:image/svg+xml,<svg …>` 这类非 base64 的 data URL（返回 `null`）。
 *
 * @param input    截图字符串；非字符串 / 空串 / 无法解析一律返回 `null`
 * @param viewport 视口标签，默认 `'desktop'`
 * @returns        合法截图对象；**任何不确定的情况都返回 `null`（"未知"）**
 */
export function decodeScreenshotDataUrl(
  input: unknown,
  viewport = 'desktop',
): ScreenshotData | null {
  if (typeof input !== 'string') return null;

  const raw = input.trim();
  if (!raw) return null;

  let b64 = raw;
  if (raw.startsWith('data:')) {
    const comma = raw.indexOf(',');
    if (comma < 0) return null;
    const meta = raw.slice(0, comma + 1);
    // 只认 base64 编码的 data URL；`data:image/svg+xml,<svg…>` 这种明文形式没法
    // 用 base64 解，硬解会得到垃圾字节 → 直接放弃（宁可未知）。
    if (!/;base64,/i.test(meta)) return null;
    b64 = raw.slice(comma + 1);
  }

  if (b64.length > MAX_SCREENSHOT_BASE64_CHARS) return null;

  let buf: Buffer;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
  if (buf.length === 0) return null;

  // 关键：尺寸来自图片头，不是外部传参，也不是默认值。
  const size = parseImageSize(buf);
  if (!size) return null;

  return {
    viewport: viewport || 'desktop',
    width: size.width,
    height: size.height,
    dataUrl: raw,
    // 把「这张图是什么」写进产物，便于日后发现语义漂移（见文件头第 2 条）。
    // 不重复写宽高 —— 那是 `width` / `height` 字段的活儿。
    description: 'viewport crop (fullPage=false)',
  };
}
