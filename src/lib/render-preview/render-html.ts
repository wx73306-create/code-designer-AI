/**
 * Render Preview — 把生成的 HTML 渲染成真实截图
 * ===================================================================
 * Phase 2 / Sprint B Step 2，Step 5 重构出 renderHtmlPage()。
 * 设计冻结文档：docs/phase2-sprintB-reconstruction-diff-design.md §4.1
 *
 * ## 为什么需要这个能力
 *
 * Sprint A 之前系统只有 `captureWebsiteScreenshots(url)` —— 它只吃 URL，
 * 无法给「AI 生成的 HTML」截图。于是 QA Agent 一直只能读 HTML 源码文本
 * （`visual-evaluation/prompt.ts` 里 `previewHtml.slice(0, 12000)`），
 * 而它的系统提示词却写着「你的任务不是评价代码，你的任务是评价网页视觉质量」。
 *
 * ## 头号风险：Tailwind CDN 是运行时 JIT
 *
 * `buildPreviewHtml()` 产出的 HTML 依赖 `<script src="https://cdn.tailwindcss.com">`。
 * Tailwind CDN 版本是**运行时编译**：浏览器加载脚本后扫描 DOM 才生成样式。
 * 这意味着 CDN 不可达 → 所有 Tailwind class 失效 → 截图是一张无样式裸 HTML。
 *
 * 拿这张裸 HTML 去和原站比，会得到很低的还原度 —— 但那是**渲染失败的分**，
 * 不是**还原度的分**。用它去驱动 Optimize，等于让人去修一个根本不存在的问题。
 * 所以 `degraded` 时调用方必须丢弃结果（reconstructionScore = null），本模块不代为决定。
 *
 * ## 三条实现约定
 *
 * 1. **只 setContent，绝不 page.goto。** 输入是 HTML 字符串，不是 URL。
 * 2. **拦截私有网段请求。** 生成 HTML 里可能有外链，服务端浏览器不能成为 SSRF 跳板。
 *    复用 `isBlockedUrl()`（与 website-scraper / screenshot 同一套判据）。
 * 3. **样式生效必须被验证，而不是被假设。** `window.tailwind` 存在还不够，
 *    还要用一个探针元素确认 JIT 真的产出了 CSS。
 *
 * ## 为什么有 renderHtmlPage 和 renderHtmlScreenshot 两个入口
 *
 * 还原度 diff 需要在**同一张渲染页**上连续做三件事：截图 → 采几何 → 采 token。
 * 截完图就关页面的 renderHtmlScreenshot 做不到这一点。
 * renderHtmlPage 保持页面打开，由调用方（reconstruction/evaluate）负责 close。
 */

import type { HTTPRequest, Page } from 'puppeteer-core';

import { getBrowser, isBlockedUrl } from '@/lib/screenshot';
import type { RenderResult } from '@/types/reconstruction';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 与原站 hero 截图保持同一视口，否则两者不可比。 */
export const DEFAULT_VIEWPORT = { width: 1440, height: 900 } as const;

/** setContent 超时。 */
const SET_CONTENT_TIMEOUT_MS = 15_000;
/** 等 Tailwind CDN 脚本加载 + JIT 就绪的上限。 */
const TAILWIND_WAIT_MS = 8_000;
/** JIT 就绪后再等一会儿，让字体与懒加载稳定。 */
const SETTLE_MS = 500;

/** 判定「空文档」的阈值：正文文本长度 与 元素总数 同时低于才算空。 */
const MIN_TEXT_LENGTH = 50;
const MIN_ELEMENT_COUNT = 20;

/**
 * HTML 是否引用了 Tailwind CDN（决定要不要等 JIT）。
 *
 * 刻意**只匹配主机前缀、不匹配完整域名**：镜像域名（cdn.tailwindcss.xxx）
 * 同样是 CDN 依赖，按完整域名匹配会让它们在 CDN 不可达时被误判成
 * 「自包含 HTML」而直接放行 —— 那等于把降级检测绕过。
 */
const TAILWIND_CDN_PATTERN = /cdn\.tailwindcss\./i;

export interface RenderHtmlOptions {
  width?: number;
  height?: number;
  /** setContent 超时，默认 15s。 */
  timeoutMs?: number;
  /** 默认 false —— 与原站 hero 截图对齐，只截首屏。 */
  fullPage?: boolean;
}

/** 一次渲染的完整产物：截图 + （成功时）仍打开的页面。 */
export interface RenderedHtml {
  render: RenderResult;
  /**
   * 仅在 `status === 'success'` 时非 null —— 供调用方在同一页面上继续采集
   * （几何 / token / asset）。**degraded / failed 时为 null。**
   * 无论哪种情况，用完必须调用 `close()`（幂等）。
   */
  page: Page | null;
  /** 关闭页面。幂等，可重复调用。 */
  close: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/**
 * 渲染 HTML 并保持页面打开。
 *
 * **调用方必须先看 `render.status` 再用 `render.screenshot` / `page`**：
 * `degraded` / `failed` 时截图不代表这个页面的真实外观。
 *
 * 永不抛错 —— 渲染失败是一种**结果**，不是异常。
 */
export async function renderHtmlPage(
  html: string,
  options: RenderHtmlOptions = {},
): Promise<RenderedHtml> {
  if (!html || !html.trim()) {
    return { render: { screenshot: '', status: 'failed', reason: 'empty-document' }, page: null, close: async () => {} };
  }

  const width = options.width ?? DEFAULT_VIEWPORT.width;
  const height = options.height ?? DEFAULT_VIEWPORT.height;
  const timeoutMs = options.timeoutMs ?? SET_CONTENT_TIMEOUT_MS;
  const fullPage = options.fullPage ?? false;

  const browser = await getBrowser();
  let page: Page | null = null;
  let detachGuard: (() => void) | null = null;

  const finish = (render: RenderResult): RenderedHtml => ({
    render,
    page: render.status === 'success' ? page : null,
    close: async () => {
      if (detachGuard) {
        detachGuard();
        detachGuard = null;
      }
      if (page) {
        try {
          await page.close();
        } catch {
          /* ignore */
        }
        page = null;
      }
    },
  });

  try {
    page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    detachGuard = await attachRequestGuard(page);

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    // ---- 渲染完成度判定 ----
    // 只有真的引用了 Tailwind CDN 时才等 JIT。
    // 自包含 HTML（内联 <style>）没有 CDN 依赖，不该被判成 degraded。
    if (TAILWIND_CDN_PATTERN.test(html)) {
      const tailwindReady = await waitForTailwind(page);
      if (!tailwindReady) {
        const screenshot = await captureScreenshot(page, fullPage);
        const result = finish({ screenshot, status: 'degraded', reason: 'tailwind-cdn-unavailable' });
        await result.close(); // degraded 的页面没有采集价值，立即回收
        return { ...result, page: null };
      }
    }

    await sleep(SETTLE_MS);

    const metrics = await readDocumentMetrics(page);
    if (metrics.textLength < MIN_TEXT_LENGTH && metrics.elementCount < MIN_ELEMENT_COUNT) {
      const result = finish({ screenshot: '', status: 'failed', reason: 'empty-document' });
      await result.close();
      return { ...result, page: null };
    }

    const screenshot = await captureScreenshot(page, fullPage);
    return finish({ screenshot, status: 'success' });
  } catch (err) {
    console.warn(
      `[render-preview] 渲染失败：${err instanceof Error ? err.message : String(err)}`,
    );
    const result = finish({ screenshot: '', status: 'failed', reason: 'render-error' });
    await result.close();
    return { ...result, page: null };
  }
}

/**
 * 把一段 HTML 渲染成截图（便捷入口）。
 *
 * **调用方必须先看 `status` 再用 `screenshot`**：
 * `degraded` / `failed` 时截图不代表这个页面的真实外观。
 *
 * 永不抛错。若还需要在同一页面上采集（diff 需要），请改用 `renderHtmlPage`。
 */
export async function renderHtmlScreenshot(
  html: string,
  options: RenderHtmlOptions = {},
): Promise<RenderResult> {
  const rendered = await renderHtmlPage(html, options);
  await rendered.close();
  return rendered.render;
}

// ---------------------------------------------------------------------------
// 内部实现
// ---------------------------------------------------------------------------

/**
 * 请求拦截：禁止生成 HTML 里的外链打到内网。
 *
 * `setContent` 不走导航，但 HTML 里的 `<img>` / `<script>` / CSS `url()`
 * 依然会发请求 —— 云元数据地址（169.254.169.254）就是这么被碰到的。
 */
async function attachRequestGuard(page: Page): Promise<() => void> {
  const handler = (req: HTTPRequest): void => {
    let url = '';
    try {
      url = req.url();
    } catch {
      void req.continue().catch(() => {
        /* ignore */
      });
      return;
    }

    // data: / blob: / about:blank 不参与 SSRF 判据（isBlockedUrl 对非 http(s) 一律 true）
    if (!url || url === 'about:blank' || url.startsWith('data:') || url.startsWith('blob:')) {
      void req.continue().catch(() => {
        /* ignore */
      });
      return;
    }

    if (isBlockedUrl(url)) {
      void req.abort('blockedbyclient').catch(() => {
        /* ignore */
      });
      return;
    }

    void req.continue().catch(() => {
      /* ignore */
    });
  };

  await page.setRequestInterception(true);
  page.on('request', handler);
  return () => {
    page.off('request', handler);
  };
}

/**
 * 等 Tailwind CDN 就绪，并**验证样式真的生效**。
 *
 * 两步缺一不可：
 *   1. `window.tailwind` 存在 —— 只说明脚本加载了
 *   2. 探针元素 `.hidden` 的 computed display 为 none —— 说明 JIT 真的产出了 CSS
 *
 * 只做第 1 步会在「脚本加载了但 JIT 还没跑完」时截到中间态。
 */
async function waitForTailwind(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => typeof (window as unknown as { tailwind?: unknown }).tailwind !== 'undefined',
      { timeout: TAILWIND_WAIT_MS },
    );
  } catch {
    return false;
  }

  try {
    return await page.evaluate(() => {
      const body = document.body;
      if (!body) return false;
      const probe = document.createElement('div');
      probe.setAttribute('id', '__tw_probe');
      probe.setAttribute('class', 'hidden');
      body.appendChild(probe);
      const display = window.getComputedStyle(probe).display;
      probe.remove();
      return display === 'none';
    });
  } catch {
    return false;
  }
}

interface DocumentMetrics {
  textLength: number;
  elementCount: number;
}

async function readDocumentMetrics(page: Page): Promise<DocumentMetrics> {
  try {
    return await page.evaluate(() => ({
      textLength: (document.body ? document.body.innerText : '').trim().length,
      elementCount: document.querySelectorAll('*').length,
    }));
  } catch {
    return { textLength: 0, elementCount: 0 };
  }
}

/** 截图失败时返回空字符串，不抛错。 */
async function captureScreenshot(page: Page, fullPage: boolean): Promise<string> {
  try {
    const shot = await page.screenshot({ type: 'png', encoding: 'base64', fullPage });
    return typeof shot === 'string' ? shot : '';
  } catch {
    return '';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
