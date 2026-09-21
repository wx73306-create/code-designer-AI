/**
 * Website Intelligence Package — Interaction Adapter
 * ===================================================================
 * 把「交互采集产物」转成 {@link InteractionPackage}，再由
 * `buildWebsitePackage()` 写进 `WebsitePackage.interaction`。
 *
 * 为什么必须有这一层：**Agent 不得直接读 interaction.json**。
 *
 * `interaction.json` 是交付格式（`InteractionExport`），将来采集产物可能来自
 * 数据库、云端任务队列或历史生成记录，直接读文件会把「存储格式」和「交付格式」
 * 焊死。WebsitePackage 必须是唯一入口，这样换存储后端时 Agent 一行都不用改。
 *
 * 支持两种输入形态：
 *   1. `InteractionPackage`（**无损**）——内存直传或按此格式存储的记录
 *   2. `InteractionExport`（**有损**，落盘的 interaction.json）——见下方说明
 */

import type {
  ChangeRecord,
  ChangeType,
  ClickEvent,
  InteractionExport,
  InteractionEvent,
  InteractionPackage,
  PageState,
  ScrollEvent,
  ScrollViewport,
  StateScreenshot,
} from '@/lib/browser-intelligence/types';
import { createEmptyInteraction } from '@/lib/browser-intelligence/types';
import { buildAnimations } from '@/lib/browser-intelligence/interaction-recorder';

/** 有损恢复的标记 —— 下游应据此降低对该字段完整度的信任。 */
export const RESTORED_FROM_EXPORT = 'restored-from-export';

/**
 * 从任意来源的交互产物构造 {@link InteractionPackage}。
 *
 * @returns 归一化后的包；输入不是合法交互产物时返回 `null`（调用方应当
 *          保持 `WebsitePackage.interaction` 为 `undefined`，而不是塞空对象）。
 */
export function buildInteractionPackage(raw: unknown): InteractionPackage | null {
  if (!raw || typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;

  // 形态 1：完整的 InteractionPackage（有 scrolls 数组）
  if (Array.isArray(obj.scrolls)) return normalizePackage(obj);

  // 形态 2：InteractionExport（有 events 数组 —— interaction.json 的格式）
  if (Array.isArray(obj.events)) return fromExport(obj);

  return null;
}

// ---------------------------------------------------------------------------
// 形态 1：InteractionPackage —— 只做补全，不丢信息
// ---------------------------------------------------------------------------

function normalizePackage(obj: Record<string, unknown>): InteractionPackage {
  const viewport = asViewport(obj.meta);
  const pkg = createEmptyInteraction(viewport);

  pkg.scrolls = Array.isArray(obj.scrolls) ? (obj.scrolls as ScrollEvent[]) : [];
  pkg.clicks = Array.isArray(obj.clicks) ? (obj.clicks as ClickEvent[]) : [];
  pkg.states = Array.isArray(obj.states) ? (obj.states as PageState[]) : [];
  pkg.animations = Array.isArray(obj.animations)
    ? (obj.animations as InteractionPackage['animations'])
    : buildAnimations(pkg.clicks);

  const meta = (obj.meta ?? {}) as Record<string, unknown>;
  if (typeof meta.capturedAt === 'string') pkg.meta.capturedAt = meta.capturedAt;
  if (typeof meta.documentHeight === 'number') pkg.meta.documentHeight = meta.documentHeight;
  if (typeof meta.degraded === 'string') pkg.meta.degraded = meta.degraded;
  pkg.meta.screenshotCount = pkg.states.length;

  return pkg;
}

// ---------------------------------------------------------------------------
// 形态 2：InteractionExport —— 有损，必须诚实标注
// ---------------------------------------------------------------------------

/**
 * `InteractionExport` → `InteractionPackage`。
 *
 * **有损之处**（无法从交付格式恢复，只能接受）：
 *   1. 截图的 base64 —— `toInteractionExport()` 主动剥掉了，恢复出来只有
 *      id / filename / 尺寸。截图本身仍以 .png 落在盘上，按 id 对得上。
 *   2. `ChangeRecord.detail` —— 交付格式只留了 `summarizeChanges()` 的摘要
 *      （如 `menu-visible`），原始 `opacity: '0→1'` 这类细节丢失。
 *      本函数做**摘要 → ChangeType 的逆映射**，语义不丢，细节不保。
 *   3. `timestamp` —— 事件流已按时间排好序，这里用序号还原相对顺序，
 *      不保真实毫秒数。
 *
 * 因此恢复出的包带 `meta.degraded = 'restored-from-export'`。
 */
function fromExport(obj: Record<string, unknown>): InteractionPackage {
  const exp = obj as unknown as InteractionExport;
  const viewport = asViewport(exp.meta);
  const pkg = createEmptyInteraction(viewport);

  pkg.states = Array.isArray(exp.states) ? exp.states : [];
  const stateById = new Map(pkg.states.map((s) => [s.stateId, s.screenshot]));

  let scrollIndex = 0;
  for (const evt of exp.events ?? []) {
    if (evt.type === 'scroll') {
      pkg.scrolls.push(scrollFromEvent(evt, stateById, viewport, scrollIndex++));
    } else {
      pkg.clicks.push(clickFromEvent(evt, stateById, viewport));
    }
  }

  pkg.animations = buildAnimations(pkg.clicks);

  if (typeof exp.meta?.documentHeight === 'number') {
    pkg.meta.documentHeight = exp.meta.documentHeight;
  }
  if (typeof exp.meta?.capturedAt === 'string') pkg.meta.capturedAt = exp.meta.capturedAt;
  pkg.meta.screenshotCount = pkg.states.length;
  pkg.meta.degraded = RESTORED_FROM_EXPORT;

  return pkg;
}

function scrollFromEvent(
  evt: Extract<InteractionEvent, { type: 'scroll' }>,
  stateById: Map<string, StateScreenshot>,
  viewport: ScrollViewport,
  index: number,
): ScrollEvent {
  return {
    type: 'scroll',
    index,
    position: evt.position,
    documentHeight: 0,
    viewport,
    // label 是「滚动至 Npx」或区块提示，这里只把它当人类可读提示，
    // 不反推成 sectionHint（两者格式不保证可逆）
    screenshot: stateById.get(evt.state) ?? placeholderShot(evt.state, viewport),
    timestamp: index,
  };
}

function clickFromEvent(
  evt: Extract<InteractionEvent, { type: 'click' }>,
  stateById: Map<string, StateScreenshot>,
  viewport: ScrollViewport,
): ClickEvent {
  const changes: ChangeRecord[] = (evt.changes ?? [])
    .map((summary) => changeFromSummary(summary, evt.target.selector))
    .filter((c): c is ChangeRecord => c !== null);

  const before = stateById.get(evt.before) ?? placeholderShot(evt.before, viewport);

  return {
    type: 'click',
    id: evt.id,
    target: {
      selector: evt.target.selector,
      ...(evt.target.text ? { text: evt.target.text } : {}),
      kind: evt.target.kind,
    },
    before,
    ...(evt.after ? { after: stateById.get(evt.after) ?? placeholderShot(evt.after, viewport) } : {}),
    changed: changes.length > 0,
    changes,
    timestamp: 0,
    ...(evt.blocked ? { blocked: evt.blocked } : {}),
  };
}

/**
 * `summarizeChanges()` 的逆映射。
 *
 * 摘要本身就是从 ChangeRecord 提炼的，所以类型可以还原；
 * 但 `change` 的具体数值（如 `0→1`）只能退化成摘要字符串本身。
 */
function changeFromSummary(summary: string, fallbackTarget: string): ChangeRecord | null {
  const type = SUMMARY_TO_TYPE[summary];
  if (!type) return null;
  return { type, target: fallbackTarget, change: summary };
}

const SUMMARY_TO_TYPE: Record<string, ChangeType> = {
  'menu-visible': 'visibility',
  'menu-hidden': 'visibility',
  'opacity-fade': 'opacity',
  slide: 'transform',
  'element-added': 'dom-added',
  'element-removed': 'dom-removed',
  'text-changed': 'text',
};

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function asViewport(meta: unknown): ScrollViewport {
  const vp = (meta as { viewport?: unknown } | undefined)?.viewport;
  if (vp && typeof vp === 'object') {
    const w = (vp as Record<string, unknown>).width;
    const h = (vp as Record<string, unknown>).height;
    if (typeof w === 'number' && typeof h === 'number') return { width: w, height: h };
  }
  return { width: 1440, height: 900 };
}

/** 状态字典里查不到时的兜底引用 —— 保持 stateId 引用不悬空。 */
function placeholderShot(id: string, viewport: ScrollViewport): StateScreenshot {
  return { id, filename: `${id}.png`, width: viewport.width, height: viewport.height };
}
