/**
 * state-capture — 把采样结果封装成页面状态序列
 * ===================================================================
 * Sprint 1 只处理滚动触发的状态；Sprint 2 的 click 触发会复用同一套
 * {@link PageState} 结构（trigger 类型已经冻结），本文件不需改动。
 *
 * `PageState` 的未来消费方是 Animation Agent：
 * 「点击菜单 → 状态变化」正是动效恢复最需要的输入。
 */

import type {
  InteractionPackage,
  PageState,
  ScrollEvent,
  ScrollViewport,
} from './types';
import { createEmptyInteraction } from './types';

/** 由滚动采样推导页面状态序列。 */
export function buildStatesFromScrolls(scrolls: ScrollEvent[]): PageState[] {
  return scrolls.map((evt) => {
    const isInitial = evt.index === 0;

    return {
      stateId: evt.screenshot.id,
      label: isInitial
        ? '首屏（未滚动）'
        : `滚动至 ${evt.position}px${evt.sectionHint ? ` · ${evt.sectionHint}` : ''}`,
      trigger: isInitial
        ? { type: 'initial' as const }
        : { type: 'scroll' as const, position: evt.position },
      screenshot: evt.screenshot,
    };
  });
}

/**
 * 汇总 Sprint 1 采集结果为一个完整的 {@link InteractionPackage}。
 *
 * Sprint 2 接入 click 后，clicks / animations 会由 interaction-recorder 填充；
 * 这里先把结构建好，保证下游永远拿到可序列化、字段齐全的对象。
 */
export function buildInteractionFromScrolls(
  scrolls: ScrollEvent[],
  viewport: ScrollViewport,
  options: { documentHeight?: number; degraded?: string } = {},
): InteractionPackage {
  const pkg = createEmptyInteraction(viewport);
  pkg.scrolls = scrolls;
  pkg.states = buildStatesFromScrolls(scrolls);
  pkg.meta.documentHeight = options.documentHeight ?? 0;
  pkg.meta.screenshotCount = scrolls.length;
  if (options.degraded) pkg.meta.degraded = options.degraded;
  return pkg;
}

/**
 * 追加点击产生的状态（Sprint 2 使用，此处预留以保持 state 构造逻辑集中）。
 *
 * 刻意放在本文件：状态的 stateId 生成与去重规则必须只有一处实现，
 * 否则 scroll 与 click 两条路径会产生互相冲突的 id。
 */
export function appendState(
  states: PageState[],
  candidate: PageState & { stateId: string },
): PageState {
  // id 冲突时加序号后缀，保证 interaction.json 里的 stateId 唯一
  let stateId = candidate.stateId;
  let n = 2;
  while (states.some((s) => s.stateId === stateId)) {
    stateId = `${candidate.stateId}-${n++}`;
  }
  const next = { ...candidate, stateId };
  states.push(next);
  return next;
}
