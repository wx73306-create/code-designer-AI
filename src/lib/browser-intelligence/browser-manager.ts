/**
 * browser-manager — 唯一接触真实浏览器引擎的模块
 * ===================================================================
 * 职责：启动/复用浏览器、设置视口与 UA、把 puppeteer `Page` 适配成
 * {@link PageController} 窄接口，并在结束时回收 page。
 *
 * 分层契约：本模块之上一层（scroll-explorer / click-explorer）**不得**
 * import puppeteer。将来若要换成 Playwright，只改这个文件。
 *
 * 复用而非重写：直接复用 `src/lib/screenshot.ts` 的共享 browser 实例与
 * `src/lib/website-scraper.ts` 的 SSRF 校验——两者都是生产链路已验证的实现，
 * 另起一套既浪费资源又会成为安全绕过点。
 */

import type { Browser, Page } from 'puppeteer-core';
import { getBrowser, isBlockedUrl } from '@/lib/screenshot';
import { assertSafeUrl } from '@/lib/website-scraper';
import type {
  BrowserManagerOptions,
  BrowserSession,
  PageController,
  ScreenshotOptions,
} from './types';

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
const DEFAULT_TIMEOUT_MS = 30_000;

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 把 puppeteer 的 Page 收窄成 {@link PageController}。
 *
 * 之所以要这层适配：真实 Page 在 vitest（node 环境）里无法实例化，
 * 上层 explorer 只依赖窄接口才能注入假实现做单测。
 */
export function adaptPuppeteerPage(page: Page, url: string): PageController {
  return {
    /**
     * 当前 URL 必须是**活读取**，不能是构造时捕获的常量。
     *
     * 曾经写成常量，后果是：点击触发导航后 `page.url` 仍返回初始地址，
     * `click-explorer` 的回源校验 `sameOrigin()` 永远为真 → 回源逻辑从不生效 →
     * 后续候选元素在另一个页面上被点击，selector 全部失效。
     * `url` 参数仅作为兜底（页面已关闭时 `page.url()` 会抛错）。
     */
    get url(): string {
      try {
        return page.url() || url;
      } catch {
        return url;
      }
    },

    async goto(target, options) {
      await page.goto(target, {
        waitUntil: 'networkidle2',
        timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });
    },

    async evaluate<T>(fn: string | (() => T)): Promise<T> {
      // puppeteer 的 evaluate 签名与我们的窄接口在类型上不完全兼容，
      // 这里做一次受控断言：调用方只会传「无参函数或字符串」，
      // 不传带闭包变量的箭头函数（那会序列化失败）。
      return (await page.evaluate(fn as never)) as T;
    },

    async screenshot(options?: ScreenshotOptions): Promise<string> {
      const result = await page.screenshot({
        type: options?.type ?? 'png',
        encoding: 'base64',
        fullPage: options?.fullPage ?? false,
        ...(options?.type === 'jpeg' && options.quality !== undefined
          ? { quality: options.quality }
          : {}),
      });
      // puppeteer v23+ 可能返回 Uint8Array 而非 base64 字符串
      if (typeof result === 'string') return result;
      return Buffer.from(result as Uint8Array).toString('base64');
    },

    async setViewport(width, height) {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
    },

    async close() {
      await page.close();
    },
  };
}

export interface OpenSessionResult {
  session: BrowserSession | null;
  /** 失败原因 —— 调用方应写入 InteractionMeta.degraded。 */
  degraded?: string;
}

/**
 * 打开一次采集会话。
 *
 * **永不抛错**：任何失败都返回 `{ session: null, degraded }`，
 * 因为采集层挂掉不应该阻断整条生成流水线（与 Animation Agent 的降级策略一致）。
 */
export async function openBrowserSession(
  rawUrl: string,
  options: BrowserManagerOptions = {},
): Promise<OpenSessionResult> {
  const viewport = options.viewport ?? DEFAULT_VIEWPORT;

  // ---- SSRF 防护：必须与截图层共用同一套校验 ----
  let safeUrl: string;
  try {
    safeUrl = await assertSafeUrl(rawUrl);
  } catch (err) {
    return {
      session: null,
      degraded: `url-rejected: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (isBlockedUrl(safeUrl)) {
    return { session: null, degraded: 'url-rejected: blocked host' };
  }

  let browser: Browser;
  let page: Page;
  try {
    browser = await getBrowser();
    page = await browser.newPage();
  } catch (err) {
    return {
      session: null,
      degraded: `browser-unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await page.setUserAgent(options.userAgent ?? DEFAULT_USER_AGENT);
    await page.goto(safeUrl, {
      waitUntil: 'networkidle2',
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  } catch (err) {
    await page.close().catch(() => undefined);
    return {
      session: null,
      degraded: `navigation-failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const controller = adaptPuppeteerPage(page, safeUrl);

  return {
    session: {
      page: controller,
      async close() {
        // 只关 page，不关 browser —— browser 是 screenshot.ts 持有的共享单例，
        // 关掉会让后续的截图功能一起失效。
        await page.close().catch(() => undefined);
      },
    },
  };
}
