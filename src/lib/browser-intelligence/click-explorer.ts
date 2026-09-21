/**
 * click-explorer — 点击执行与状态恢复
 * ===================================================================
 * 流程（严格按设计冻结的顺序）：
 *   截图 before → 采集 before 快照 → 点击 → 等待稳定 → 截图 after
 *   → 采集 after 快照 → state-diff → **恢复页面** → 记录
 *
 * 「恢复页面」不是可选项：第一个点击把菜单展开后，若不恢复，
 * 后续候选元素会在「已展开」的错误状态下被点击，采到的全是脏数据。
 */

import type {
  ChangeRecord,
  ClickEvent,
  ClickSafetyPolicy,
  ClickTargetKind,
  DetectedElement,
  PageController,
  RecoveryStrategy,
  ScrollViewport,
  StateScreenshot,
  StateSnapshot,
} from './types';
import { DEFAULT_CLICK_SAFETY } from './types';
import { classifyElement, selectClickTargets, suggestRecovery } from './interaction-policy';
import { diffStates, hasMeaningfulChange } from './state-diff';
import type { RawElement } from './element-detector';

/** 采集状态快照的脚本：抓取候选元素及可能变化的浮层。 */
const SNAPSHOT_SCRIPT = `(() => {
  const SEL = 'button, a[href], [role=tab], [aria-expanded], [aria-haspopup], summary, select, [class*=menu], [class*=dropdown], [class*=modal], [class*=panel], [class*=popup]';
  const nodes = Array.from(document.querySelectorAll(SEL)).slice(0, 80);
  const out = [];
  for (const el of nodes) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const id = el.id ? '#' + el.id : '';
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).slice(0,3).join('.') : '';
    const selector = id || ((el.tagName || '').toLowerCase() + (cls ? '.' + cls : ''));
    if (!selector) continue;
    out.push({
      selector,
      visible: rect.width > 0 && rect.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01,
      opacity: cs.opacity,
      display: cs.display,
      transform: cs.transform,
      rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
    });
  }
  return out;
})()`;

export interface ClickExplorerOptions {
  viewport: ScrollViewport;
  /** 点击后的稳定等待（ms）——等动画播完再采样。默认 700。 */
  settleMs?: number;
  /** 是否内联 base64。默认 true（点击状态是核心产物，值得占 token）。 */
  inlineScreenshots?: boolean;
  policy?: ClickSafetyPolicy;
  /** 当前页面 host，用于判断外链。 */
  pageHost?: string;
  /** 起始状态序号，避免与 scroll 阶段的 state 编号冲突。 */
  stateIndexStart?: number;
  /**
   * 单个元素的点击 + 恢复总超时（ms）。默认 20000。
   *
   * 为什么必须有：点击可能触发导航，而导航会销毁执行上下文，
   * 此时 `evaluate` 可能既不返回也不报错（真机在 linear.app 上挂死 20 分钟）。
   * 没有超时的话，一次挂起会拖垮整轮采集。
   */
  clickTimeoutMs?: number;
}

export interface ClickExplorationResult {
  events: ClickEvent[];
  /** 本次新增的状态（供 recorder 合并进 states[]）。 */
  newStates: Array<{ stateId: string; label: string; screenshot: StateScreenshot }>;
  /** 被安全策略拦截的元素数量（用于验收「策略真的生效了」）。 */
  blockedCount: number;
}

/** 点击单个元素并采集前后状态。 */
async function clickOnce(
  page: PageController,
  element: DetectedElement,
  options: Required<Pick<ClickExplorerOptions, 'viewport' | 'settleMs' | 'inlineScreenshots'>>,
  stateIndex: number,
  startedAt: number,
  homeUrl: string,
): Promise<{
  event: ClickEvent;
  /** 本次新增的状态（before + after 都注册，保证导出里的 stateId 不悬空）。 */
  newStates: Array<{ stateId: string; label: string; screenshot: StateScreenshot }>;
}> {
  const beforeId = `state-${String(stateIndex).padStart(3, '0')}`;
  const afterId = `state-${String(stateIndex + 1).padStart(3, '0')}`;
  const labelBase = element.text || element.selector;

  const beforeShot = await grab(page, beforeId, `点击前 · ${labelBase}`, options);
  const beforeSnap: StateSnapshot = {
    timestamp: Date.now() - startedAt,
    elements: await safeSnapshot(page),
  };

  await page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(element.selector)});
    if (el) el.click();
  })()`);
  await delay(options.settleMs);

  const afterSnap: StateSnapshot = {
    timestamp: Date.now() - startedAt,
    elements: await safeSnapshot(page),
  };
  const afterShot = await grab(page, afterId, `点击后 · ${labelBase}`, options);

  const changes: ChangeRecord[] = diffStates(beforeSnap, afterSnap);
  const changed = hasMeaningfulChange(changes);
  const recovery = suggestRecovery(element);

  const event: ClickEvent = {
    type: 'click',
    id: `click-${String(stateIndex).padStart(3, '0')}`,
    target: {
      selector: element.selector,
      ...(element.text ? { text: element.text } : {}),
      kind: toClickTargetKind(element),
      matchedRule: element.riskReason,
    },
    before: beforeShot,
    after: afterShot,
    changed,
    changes,
    timestamp: Date.now() - startedAt,
    recovery,
  };

  // ★ 恢复页面 —— 不恢复则后续点击全部基于「已展开」的错误状态
  await restore(page, recovery, homeUrl, options.settleMs);

  // before / after 一律注册：导出格式用 stateId 引用，
  // 只注册其中一个会让 interaction.json 出现悬空引用（真机验证发现的坑）。
  return {
    event,
    newStates: [
      { stateId: beforeId, label: `点击前 · ${labelBase}`, screenshot: beforeShot },
      {
        stateId: afterId,
        label: changed ? `点击后 · ${labelBase}` : `点击后（无变化） · ${labelBase}`,
        screenshot: afterShot,
      },
    ],
  };
}

export async function exploreClicks(
  page: PageController,
  candidates: Array<Omit<DetectedElement, 'risk'>>,
  options: ClickExplorerOptions,
): Promise<ClickExplorationResult> {
  const policy = options.policy ?? DEFAULT_CLICK_SAFETY;
  const settleMs = options.settleMs ?? 700;
  const inline = options.inlineScreenshots ?? true;
  const startedAt = Date.now();

  // 分级 → 过滤 → 截断
  const classified = candidates.map((el) =>
    classifyElement(el, policy, options.pageHost ? { pageHost: options.pageHost } : {}),
  );
  const targets = selectClickTargets(classified, policy);
  const blockedCount = classified.filter((el) => el.risk === 'BLOCKED').length;

  const events: ClickEvent[] = [];
  const newStates: ClickExplorationResult['newStates'] = [];
  let stateIndex = options.stateIndexStart ?? 1;
  // 导航类点击可能真的跳走，恢复时用它作为回源目标
  const homeUrl = page.url;

  for (const target of targets) {
    try {
      const { event, newStates: added } = await withTimeout(
        clickOnce(
          page,
          target,
          { viewport: options.viewport, settleMs, inlineScreenshots: inline },
          stateIndex,
          startedAt,
          homeUrl,
        ),
        options.clickTimeoutMs ?? 20_000,
        `click ${target.selector}`,
      );
      events.push(event);
      newStates.push(...added);
      stateIndex += 2;
    } catch (err) {
      // 单个元素失败不应中断整轮采集
      events.push({
        type: 'click',
        id: `click-${String(stateIndex).padStart(3, '0')}`,
        target: {
          selector: target.selector,
          ...(target.text ? { text: target.text } : {}),
          kind: toClickTargetKind(target),
          matchedRule: target.riskReason,
        },
        before: { id: `state-${String(stateIndex).padStart(3, '0')}`, filename: '', width: options.viewport.width, height: options.viewport.height },
        changed: false,
        changes: [],
        timestamp: Date.now() - startedAt,
        blocked: `click-failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      stateIndex += 2;
      // 失败后强制恢复，避免页面停在半开状态。
      // 同样要加超时 —— 页面上下文已经损坏时 reload 本身也可能挂住。
      await withTimeout(
        restore(page, { method: 'reload' }, homeUrl, settleMs),
        10_000,
        'recovery',
      ).catch(() => undefined);
    }
  }

  return { events, newStates, blockedCount };
}

// ---------------------------------------------------------------------------

function toClickTargetKind(el: DetectedElement): ClickTargetKind {
  switch (el.type) {
    case 'nav':
      return 'nav';
    case 'tab':
      return 'tab';
    case 'dropdown':
    case 'menu':
      return 'dropdown';
    case 'modal-trigger':
      return 'modal';
    default:
      return 'button';
  }
}

async function grab(
  page: PageController,
  id: string,
  label: string,
  options: { viewport: ScrollViewport; inlineScreenshots: boolean },
): Promise<StateScreenshot> {
  const base: StateScreenshot = {
    id,
    filename: `${id}.png`,
    width: options.viewport.width,
    height: options.viewport.height,
  };
  if (!options.inlineScreenshots) return base;
  try {
    return { ...base, dataUrl: await page.screenshot({ type: 'png' }) };
  } catch {
    return base;
  }
}

async function safeSnapshot(page: PageController): Promise<StateSnapshot['elements']> {
  try {
    const els = await page.evaluate<StateSnapshot['elements']>(SNAPSHOT_SCRIPT);
    return Array.isArray(els) ? els : [];
  } catch {
    return [];
  }
}

/**
 * 按策略恢复页面。
 *
 * 恢复是否成功要**验证**，不能只是执行动作：`history.back()` 通过
 * `evaluate` 触发时不会等待导航完成，若不校验 URL 就直接继续，
 * 后续候选元素会在另一个页面上被点击（selector 全失效，采到空数据）。
 * 因此每个策略执行后都校验一次当前 URL，偏离 `homeUrl` 就强制 `goto` 回源。
 */
async function restore(
  page: PageController,
  strategy: RecoveryStrategy | undefined,
  homeUrl: string,
  settleMs: number,
): Promise<void> {
  const sameOrigin = (): boolean => {
    try {
      return new URL(page.url).href === new URL(homeUrl).href;
    } catch {
      return false;
    }
  };

  const attempt = async (s: RecoveryStrategy): Promise<void> => {
    switch (s.method) {
      case 're-click':
        await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(s.selector)}); if (el) el.click(); })()`);
        break;
      case 'escape':
        await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
        break;
      case 'history-back':
        await page.evaluate(`(() => { if (history.length > 1) history.back(); })()`);
        break;
      case 'reload':
        await page.evaluate(`location.reload()`);
        break;
    }
    await delay(settleMs);
  };

  try {
    if (strategy) await attempt(strategy);
  } catch {
    /* 单个策略失败不致命，下面统一做回源校验 */
  }

  // 回源校验：跳走了就强制导航回来（reload 策略不改变 URL，不会误触发）
  if (!sameOrigin()) {
    try {
      await page.goto(homeUrl, { timeoutMs: 15000 });
      await delay(settleMs);
    } catch {
      /* 彻底失败时只能继续，后续数据可信度下降 */
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 给单个元素的采集加超时。
 *
 * 注意：超时只是**放弃等待**并让外层走降级分支，无法真正取消底层的
 * puppeteer 调用——后续调用仍可能受影响，所以外层必须紧接着做一次强制恢复。
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} 超时 ${ms}ms`)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/** 供 detector 结果直接传入：把浏览器原始列表转成 DetectedElement。 */
export type { RawElement };
