// =====================================================================
// Website Screenshot — Capture visual reference of target website
// Used by Vision Agent (analysis) and Code Agent (HTML generation reference)
// =====================================================================

import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'fs';
import { join } from 'path';

/** Screenshot result with base64 image data */
export interface ScreenshotResult {
  /** Base64-encoded PNG image (without data URI prefix) */
  heroBase64: string;
  /** Base64-encoded full-page screenshot */
  fullPageBase64: string;
  /** Dimensions of the hero screenshot */
  width: number;
  height: number;
}

// =====================================================================
// Browser executable detection
// =====================================================================

const CHROME_PATHS_WIN = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
];

const EDGE_PATHS_WIN = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
];

const CHROME_PATHS_LINUX = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',
];

const EDGE_PATHS_LINUX = [
  '/usr/bin/microsoft-edge',
  '/usr/bin/microsoft-edge-stable',
];

/** Find a Chrome or Edge executable on the system */
function findBrowserExecutable(): string {
  const isWindows = process.platform === 'win32';
  const candidates = isWindows
    ? [...CHROME_PATHS_WIN, ...EDGE_PATHS_WIN]
    : [...CHROME_PATHS_LINUX, ...EDGE_PATHS_LINUX];

  // Also check environment variable override
  const envPath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }

  throw new Error(
    'No Chrome or Edge browser found. Set CHROME_PATH environment variable to the browser executable path.'
  );
}

// =====================================================================
// SSRF protection (reuse logic from website-scraper)
// =====================================================================

const BLOCKED_HOSTS = ['localhost', 'metadata.google.internal'];

function isBlockedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
    if (BLOCKED_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) return true;
    // Block private IPs
    const parts = url.hostname.split('.').map(Number);
    if (parts.length === 4) {
      const [a, b] = parts;
      if (a === 0 || a === 10 || a === 127) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
    }
    return false;
  } catch {
    return true;
  }
}

// =====================================================================
// Screenshot capture with concurrency pool and URL cache
// =====================================================================

let browserInstance: Browser | null = null;

// P0-2: Concurrency pool — max 2 pages at a time on 2-core 4GB ECS
const MAX_CONCURRENT_PAGES = 2;
let activePages = 0;
const pageQueue: Array<() => void> = [];

function acquirePageSlot(): Promise<void> {
  if (activePages < MAX_CONCURRENT_PAGES) {
    activePages++;
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    pageQueue.push(() => {
      activePages++;
      resolve();
    });
  });
}

function releasePageSlot(): void {
  activePages--;
  const next = pageQueue.shift();
  if (next) next();
}

// P0-3: URL cache — avoid re-screenshotting the same URL within 10 minutes
const screenshotCache = new Map<string, { result: ScreenshotResult; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCachedScreenshot(url: string, fullPage: boolean): ScreenshotResult | null {
  const key = `${url}__${fullPage}`;
  const cached = screenshotCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  if (cached) screenshotCache.delete(key); // expired
  return null;
}

function setCachedScreenshot(url: string, fullPage: boolean, result: ScreenshotResult): void {
  const key = `${url}__${fullPage}`;
  screenshotCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  // Limit cache size to 20 entries
  if (screenshotCache.size > 20) {
    const oldest = screenshotCache.keys().next().value;
    if (oldest) screenshotCache.delete(oldest);
  }
}

/** Get or create a shared browser instance */
async function getBrowser(): Promise<Browser> {
  if (browserInstance?.connected) return browserInstance;

  const executablePath = findBrowserExecutable();

  browserInstance = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--window-size=1440,900',
    ],
  });

  return browserInstance;
}

/**
 * Capture screenshots of a target website.
 * - Hero screenshot: viewport (1440x900) capturing the above-the-fold area
 * - Full page screenshot: entire scrollable page
 * - Concurrency: max 2 pages at a time (P0-2)
 * - Cache: same URL returns cached result within 10 min (P0-3)
 */
export async function captureWebsiteScreenshots(
  url: string,
  options?: {
    viewportWidth?: number;
    viewportHeight?: number;
    fullPage?: boolean;
    waitForSelector?: string;
    timeout?: number;
  }
): Promise<ScreenshotResult> {
  if (isBlockedUrl(url)) {
    throw new Error(`Screenshot blocked: URL ${url} is not allowed (SSRF protection).`);
  }

  const fullPage = options?.fullPage !== false;

  // P0-3: Return cached result if available
  const cached = getCachedScreenshot(url, fullPage);
  if (cached) {
    console.log(`[Screenshot] Cache hit for ${url}`);
    return cached;
  }

  // P0-2: Acquire a page slot (max 2 concurrent)
  await acquirePageSlot();

  const width = options?.viewportWidth ?? 1440;
  const height = options?.viewportHeight ?? 900;
  const timeout = options?.timeout ?? 30_000;

  const browser = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to the URL
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout,
    });

    // Wait a bit for animations/lazy-loaded content
    await new Promise(r => setTimeout(r, 2000));

    // Optionally wait for a specific selector
    if (options?.waitForSelector) {
      try {
        await page.waitForSelector(options.waitForSelector, { timeout: 5000 });
      } catch {
        // Continue even if selector not found
      }
    }

    // Capture hero (viewport) screenshot
    const heroBuffer = await page.screenshot({
      type: 'png',
      encoding: 'base64',
      fullPage: false,
    });

    // Capture full-page screenshot
    let fullPageBuffer: string = '';
    if (options?.fullPage !== false) {
      fullPageBuffer = await page.screenshot({
        type: 'png',
        encoding: 'base64',
        fullPage: true,
      }) as string;
    }

    const result: ScreenshotResult = {
      heroBase64: heroBuffer as string,
      fullPageBase64: fullPageBuffer,
      width,
      height,
    };

    // P0-3: Cache the result
    setCachedScreenshot(url, fullPage, result);

    return result;
  } finally {
    // P0-2: Always release the page slot
    releasePageSlot();
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
  }
}

/**
 * Cleanup: close the shared browser instance.
 * Call this when the server shuts down or after a batch of screenshots.
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch {
      /* ignore */
    }
    browserInstance = null;
  }
}
