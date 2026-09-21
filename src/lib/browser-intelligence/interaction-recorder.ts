/**
 * interaction-recorder — 汇总与导出
 * ===================================================================
 * 两个职责：
 *   1. 把 scroll / click 两类采样合并进 {@link InteractionPackage}
 *      （写入 WebsitePackage 的内部契约）
 *   2. 转换成 {@link InteractionExport}（落盘 interaction.json 的交付格式）
 *
 * 两套结构不是重复设计：内部契约含完整截图对象供 Agent 直接消费；
 * 交付格式用 stateId 引用替代内联截图，避免文件体积爆炸。
 */

import type {
  ChangeRecord,
  ClickEvent,
  InteractionAnimation,
  InteractionExport,
  InteractionEvent,
  InteractionPackage,
  PageState,
  ScrollEvent,
  ScrollViewport,
} from './types';
import { createEmptyInteraction } from './types';
import { buildStatesFromScrolls } from './state-capture';
import { extractAnimatedProperties, summarizeChanges } from './state-diff';

/**
 * 把点击结果合并进已有的 InteractionPackage（通常已含 Sprint 1 的滚动采样）。
 */
export function mergeClicks(
  pkg: InteractionPackage,
  clicks: ClickEvent[],
  extraStates: Array<{ stateId: string; label: string; screenshot: PageState['screenshot'] }>,
): InteractionPackage {
  pkg.clicks = clicks;

  for (const st of extraStates) {
    // 用 state-capture 的 appendState 保证 stateId 唯一（不是直接 push）
    if (!pkg.states.some((s) => s.stateId === st.stateId)) {
      pkg.states.push({
        stateId: st.stateId,
        label: st.label,
        trigger: { type: 'click', selector: st.stateId },
        screenshot: st.screenshot,
      });
    }
  }

  pkg.meta.screenshotCount = pkg.states.length;
  return pkg;
}

/**
 * 由滚动采样构建基础包（Sprint 1 路径），供 Sprint 2 继续 mergeClicks。
 */
export function buildBasePackage(
  scrolls: ScrollEvent[],
  viewport: ScrollViewport,
  meta?: { documentHeight?: number; degraded?: string },
): InteractionPackage {
  const pkg = createEmptyInteraction(viewport);
  pkg.scrolls = scrolls;
  pkg.states = buildStatesFromScrolls(scrolls);
  if (meta?.documentHeight !== undefined) pkg.meta.documentHeight = meta.documentHeight;
  if (meta?.degraded) pkg.meta.degraded = meta.degraded;
  pkg.meta.screenshotCount = pkg.states.length;
  return pkg;
}

/**
 * 转换成 interaction.json 的交付格式。
 *
 * 事件按时间排序，把 scroll 与 click 压成一条时间线，
 * 便于 Vision Agent 按「用户如何操作这个页面」的顺序理解。
 */
export function toInteractionExport(pkg: InteractionPackage, url: string): InteractionExport {
  const events: InteractionEvent[] = [];

  for (const s of pkg.scrolls) {
    events.push({
      id: `scroll-${String(s.index).padStart(3, '0')}`,
      type: 'scroll',
      position: s.position,
      state: s.screenshot.id,
      label: s.sectionHint ?? `滚动至 ${s.position}px`,
    });
  }

  for (const c of pkg.clicks) {
    const base = {
      id: c.id,
      type: 'click' as const,
      target: {
        text: c.target.text ?? '',
        selector: c.target.selector,
        kind: c.target.kind,
      },
      before: c.before.id,
      changes: summarizeChanges(c.changes),
    };
    events.push(c.after ? { ...base, after: c.after.id } : { ...base, blocked: c.blocked ?? 'blocked' });
  }

  events.sort((a, b) => {
    const ta = timestampOf(pkg, a);
    const tb = timestampOf(pkg, b);
    return ta - tb;
  });

  return {
    url,
    capturedAt: pkg.meta.capturedAt,
    // 交付格式里剥掉 base64：截图是 .png 落盘的，重复内联会让
    // interaction.json 从几十 KB 膨胀到几十 MB
    states: pkg.states.map((s) => ({
      ...s,
      screenshot: {
        id: s.screenshot.id,
        filename: s.screenshot.filename,
        width: s.screenshot.width,
        height: s.screenshot.height,
      },
    })),
    events,
    meta: pkg.meta,
  };
}

function timestampOf(pkg: InteractionPackage, evt: InteractionEvent): number {
  if (evt.type === 'scroll') {
    return pkg.scrolls.find((s) => s.screenshot.id === evt.state)?.timestamp ?? 0;
  }
  return pkg.clicks.find((c) => c.id === evt.id)?.timestamp ?? 0;
}

/** 导出为 JSON 字符串（写 interaction.json 用）。 */
export function serializeInteraction(pkg: InteractionPackage, url: string): string {
  return JSON.stringify(toInteractionExport(pkg, url), null, 2);
}

/** 供 Animation Agent 直接取用：汇总所有交互实际变化的 CSS 属性。 */
export function collectAnimatedProperties(clicks: ClickEvent[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const c of clicks) {
    if (!c.changed) continue;
    const props = new Set<string>();
    for (const ch of c.changes as ChangeRecord[]) {
      if (ch.type === 'opacity') props.add('opacity');
      if (ch.type === 'transform' || ch.type === 'position') props.add('transform');
      if (ch.type === 'visibility') props.add('visibility');
    }
    if (props.size > 0) out[c.target.selector] = [...props];
  }
  return out;
}

/**
 * 由点击结果推导交互动画记录，填 {@link InteractionPackage.animations}。
 *
 * 只收录**真的产生了变化**的点击：点下去什么都没变的交互对动效恢复
 * 没有参考价值，写进去只会污染 Animation Agent 的输入。
 *
 * duration / easing 本轮不填 —— 需要连续帧采样才能测准，
 * 留到 Sprint 3（Animation Interaction Recovery）与 GSAP Agent 一起做。
 */
export function buildAnimations(clicks: ClickEvent[]): InteractionAnimation[] {
  const out: InteractionAnimation[] = [];
  for (const c of clicks) {
    if (!c.changed) continue;
    const properties = extractAnimatedProperties(c.changes);
    if (properties.length === 0) continue;
    out.push({
      trigger: {
        type: 'click',
        selector: c.target.selector,
        ...(c.target.text ? { text: c.target.text } : {}),
      },
      properties,
    });
  }
  return out;
}
