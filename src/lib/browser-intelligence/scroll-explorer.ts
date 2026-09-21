/**
 * scroll-explorer — 分段滚动采样
 * ===================================================================
 * 解决「模型只看到一张拼接长图」的问题：把页面按视口切成若干段，
 * 每段单独截图并记录命中区块，让 Vision / Planning 知道
 * 「Hero 在哪结束、Pricing 从哪开始」。
 *
 * 本模块只依赖 {@link PageController}，不认识 puppeteer ——
 * 因此 {@link computeScrollSteps} 等核心逻辑可在 vitest 里用假 Page 单测。
 */

import type {
  PageController,
  ScrollEvent,
  ScrollExplorerOptions,
  ScrollViewport,
  StateScreenshot,
} from './types';

/** 一次滚动采样的计划（纯计算结果，不含截图）。 */
export interface ScrollStep {
  index: number;
  position: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 计算滚动采样点。
 *
 * 两个刻意的设计：
 * 1. **相邻段有重叠**（默认 10%）——避免恰好切在某个区块中间，
 *    导致该区块在前后两张图里都不完整；
 * 2. **最后一段强制落在底部**——否则页脚永远采不到。
 *
 * @param documentHeight 文档总高度
 * @param viewportHeight 视口高度
 */
export function computeScrollSteps(
  documentHeight: number,
  viewportHeight: number,
  options: Pick<ScrollExplorerOptions, 'overlapRatio' | 'maxSteps'> = {},
): ScrollStep[] {
  const overlapRatio = clamp(options.overlapRatio ?? 0.1, 0, 0.5);
  const maxSteps = Math.max(1, Math.floor(options.maxSteps ?? 8));

  // 页面不足一屏：只采首屏
  const maxScroll = Math.max(0, Math.ceil(documentHeight - viewportHeight));
  if (maxScroll === 0) return [{ index: 0, position: 0 }];

  const stride = Math.max(1, Math.floor(viewportHeight * (1 - overlapRatio)));

  const positions: number[] = [0];
  for (let p = stride; p < maxScroll; p += stride) {
    positions.push(p);
    if (positions.length >= maxSteps) break;
  }

  // 未到底则补一张底部截图（maxSteps 已满就放弃，避免超出上限）
  const last = positions[positions.length - 1];
  if (positions.length < maxSteps && last !== maxScroll) {
    positions.push(maxScroll);
  }

  return positions.slice(0, maxSteps).map((position, index) => ({ index, position }));
}

/**
 * 在浏览器上下文执行的脚本：取当前视口命中的区块描述。
 *
 * 两个坑（真机在 apple.com 上暴露，单测无法发现）：
 * 1. **采样点不能在视口顶部** —— 那里几乎总是 sticky header，会让所有
 *    采样都命中导航栏。改到视口 25% 高度处。
 * 2. **必须穿透 sticky/fixed 覆盖层** —— `elementFromPoint` 只返回最上层元素，
 *    被吸顶导航遮住时拿到的永远是 nav 链接。改用 `elementsFromPoint`
 *    取整条堆叠链，跳过自身或祖先为 fixed/sticky 的元素。
 */
const SECTION_HINT_SCRIPT = `(() => {
  const x = Math.floor(window.innerWidth / 2);
  const y = Math.floor(window.innerHeight * 0.25);
  const els = document.elementsFromPoint(x, y) || [];
  const isOverlay = (el) => {
    let cur = el;
    while (cur && cur !== document.documentElement) {
      const p = getComputedStyle(cur).position;
      if (p === 'fixed' || p === 'sticky') return true;
      cur = cur.parentElement;
    }
    return false;
  };
  for (const el of els) {
    if (isOverlay(el)) continue;
    const sec = el.closest('section, header, footer, main > div');
    const target = sec || el;
    const cls = typeof target.className === 'string' ? target.className.trim() : '';
    const tag = (target.tagName || '').toLowerCase();
    const id = target.id ? '#' + target.id : '';
    const clsPart = cls ? '.' + cls.split(/\\s+/).slice(0, 3).join('.') : '';
    const out = (tag + id + clsPart).slice(0, 120);
    if (out) return out;
  }
  return null;
})()`;

const DOC_HEIGHT_SCRIPT = 'document.documentElement.scrollHeight || 0';

/** 滚动采样的完整结果。 */
export interface ScrollExplorationResult {
  events: ScrollEvent[];
  /** 采集结束时的文档高度。 */
  documentHeight: number;
  /** 降级原因（如无限滚动）；正常完成时为空。 */
  degraded?: string;
}

/**
 * 对已打开的页面执行分段滚动采样。
 *
 * 失败语义：本函数**仍会抛出**底层异常，由调用方（interaction-recorder）
 * 统一捕获并写入 `meta.degraded`。这里不吞异常是为了让调用方拿到原始堆栈。
 */
export async function exploreScroll(
  page: PageController,
  options: ScrollExplorerOptions,
): Promise<ScrollExplorationResult> {
  const viewport: ScrollViewport = options.viewport;
  const settleMs = options.settleMs ?? 600;
  const growthRatio = options.infiniteScrollGrowthRatio ?? 1.5;
  const overlapRatio = options.overlapRatio ?? 0.1;
  const maxSteps = options.maxSteps ?? 8;
  const inline = options.inlineScreenshots ?? false;

  const startedAt = Date.now();

  const initialHeight = Number(await page.evaluate(DOC_HEIGHT_SCRIPT)) || 0;
  const steps = computeScrollSteps(initialHeight, viewport.height, { overlapRatio, maxSteps });

  const events: ScrollEvent[] = [];
  let degraded: string | undefined;
  let currentHeight = initialHeight;

  for (const step of steps) {
    // 用字符串脚本而非闭包 —— 浏览器上下文拿不到外部变量
    await page.evaluate(`window.scrollTo(0, ${step.position})`);
    await delay(settleMs);

    const heightNow = Number(await page.evaluate(DOC_HEIGHT_SCRIPT)) || currentHeight;

    // 无限滚动保护：高度持续增长说明页面会一直加载，继续采没有意义
    if (initialHeight > 0 && heightNow > initialHeight * growthRatio) {
      degraded = 'infinite-scroll';
      break;
    }
    currentHeight = heightNow;

    const hint = (await page.evaluate<string | null>(SECTION_HINT_SCRIPT)) ?? undefined;

    const shot = await captureShot(page, viewport, step.index, hint, inline);
    if (!shot) continue;

    events.push({
      type: 'scroll',
      index: step.index,
      position: step.position,
      documentHeight: heightNow,
      viewport,
      ...(hint ? { sectionHint: hint } : {}),
      screenshot: shot,
      timestamp: Date.now() - startedAt,
    });
  }

  return { events, documentHeight: currentHeight, ...(degraded ? { degraded } : {}) };
}

async function captureShot(
  page: PageController,
  viewport: ScrollViewport,
  index: number,
  hint: string | undefined,
  inline: boolean,
): Promise<StateScreenshot | null> {
  const filename = `scroll-${String(index).padStart(2, '0')}.png`;
  const id = `scroll-${String(index).padStart(2, '0')}`;

  if (!inline) {
    // 只存引用：调用方按 token 预算决定回填哪些 dataUrl
    return { id, filename, width: viewport.width, height: viewport.height };
  }

  try {
    const dataUrl = await page.screenshot({ type: 'png' });
    return { id, filename, width: viewport.width, height: viewport.height, dataUrl };
  } catch {
    // 单张截图失败不应让整段采样作废 —— 退化成纯引用
    return { id, filename, width: viewport.width, height: viewport.height };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
