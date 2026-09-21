/**
 * state-diff — 前后状态比对
 * ===================================================================
 * 不只截图，要**判断点击产生了什么变化** —— 这份输出是 Sprint 3
 * 给 GSAP Agent 的直接输入：`properties` 决定该用 transform
 * （GPU 友好）还是 layout 属性（昂贵，如 width/height/margin）。
 *
 * 刻意不做像素级 diff：需要额外依赖且计算昂贵，
 * 而 DOM/样式快照已经足够回答「菜单展开了没有、从哪个方向滑出来」。
 */

import type { ChangeRecord, StateSnapshot } from './types';

/** 变化判定阈值 —— 避免把亚像素抖动记成动画。 */
export const DIFF_THRESHOLDS = {
  /** opacity 差值小于此值忽略。 */
  opacity: 0.05,
  /** 位移小于此像素数忽略。 */
  position: 4,
} as const;

function parseOpacity(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 1;
}

/** 从 transform 矩阵里取 Y 平移量，无法解析时返回 0。 */
function parseTranslateY(transform: string): number {
  if (!transform || transform === 'none') return 0;
  // matrix(a, b, c, d, tx, ty) / matrix3d(...) 的第 6 项是 ty
  const m = transform.match(/matrix\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()));
    if (parts.length >= 6 && Number.isFinite(parts[5])) return parts[5];
    return 0;
  }
  const m3 = transform.match(/matrix3d\(([^)]+)\)/);
  if (m3) {
    const parts = m3[1].split(',').map((s) => Number.parseFloat(s.trim()));
    if (parts.length >= 14 && Number.isFinite(parts[13])) return parts[13];
  }
  return 0;
}

function fmt(n: number): string {
  return Math.abs(n) < 0.01 ? '0' : String(Math.round(n * 100) / 100);
}

/**
 * 比对两次状态快照，得出变化清单。
 *
 * @param before 点击前快照
 * @param after  点击后快照
 * @returns 变化记录，按「对动画最有用」排序（DOM 增删 > 可见性 > 位移 > 透明度）
 */
export function diffStates(before: StateSnapshot, after: StateSnapshot): ChangeRecord[] {
  const changes: ChangeRecord[] = [];
  const beforeMap = new Map(before.elements.map((e) => [e.selector, e]));
  const afterMap = new Map(after.elements.map((e) => [e.selector, e]));

  // ---- DOM 增删 ----
  for (const [selector, el] of afterMap) {
    if (!beforeMap.has(selector)) {
      changes.push({
        type: 'dom-added',
        target: selector,
        change: `added${el.visible ? ' (visible)' : ' (hidden)'}`,
      });
    }
  }
  for (const [selector] of beforeMap) {
    if (!afterMap.has(selector)) {
      changes.push({ type: 'dom-removed', target: selector, change: 'removed' });
    }
  }

  // ---- 共有元素的属性变化 ----
  for (const [selector, b] of beforeMap) {
    const a = afterMap.get(selector);
    if (!a) continue;

    // 可见性翻转 —— 菜单/浮层最核心的信号
    if (b.visible !== a.visible) {
      changes.push({
        type: 'visibility',
        target: selector,
        change: a.visible ? 'hidden→visible' : 'visible→hidden',
        detail: {
          display: `${b.display}→${a.display}`,
          ...(b.opacity !== a.opacity ? { opacity: `${b.opacity}→${a.opacity}` } : {}),
        },
      });
      continue; // 可见性翻转已是最强信号，不必再报透明度
    }

    const ob = parseOpacity(b.opacity);
    const oa = parseOpacity(a.opacity);
    if (Math.abs(oa - ob) >= DIFF_THRESHOLDS.opacity) {
      changes.push({
        type: 'opacity',
        target: selector,
        change: `${b.opacity}→${a.opacity}`,
        detail: { opacity: `${b.opacity}→${a.opacity}` },
      });
    }

    const tb = parseTranslateY(b.transform);
    const ta = parseTranslateY(a.transform);
    if (Math.abs(ta - tb) >= DIFF_THRESHOLDS.position) {
      changes.push({
        type: 'transform',
        target: selector,
        change: `translateY ${fmt(tb)}→${fmt(ta)}`,
        detail: { transform: `${b.transform}→${a.transform}` },
      });
    }

    // 只报**真正动了的那个轴**。
    // 曾经无条件输出 `y A→B`，结果只变了 x 时会写出 `y 708→708` 这种
    // 自相矛盾的字符串 —— 进了提示词后模型会以为有 y 方向动画。
    const dx = a.rect.x - b.rect.x;
    const dy = a.rect.y - b.rect.y;
    if (Math.abs(dx) >= DIFF_THRESHOLDS.position || Math.abs(dy) >= DIFF_THRESHOLDS.position) {
      const moved: string[] = [];
      if (Math.abs(dx) >= DIFF_THRESHOLDS.position) {
        moved.push(`x ${Math.round(b.rect.x)}→${Math.round(a.rect.x)}`);
      }
      if (Math.abs(dy) >= DIFF_THRESHOLDS.position) {
        moved.push(`y ${Math.round(b.rect.y)}→${Math.round(a.rect.y)}`);
      }
      changes.push({
        type: 'position',
        target: selector,
        change: moved.join(' / '),
        detail: {
          x: `${Math.round(b.rect.x)}→${Math.round(a.rect.x)}`,
          y: `${Math.round(b.rect.y)}→${Math.round(a.rect.y)}`,
        },
      });
    }
  }

  return changes;
}

/** 变化清单是否代表「真的发生了交互」——用于填 ClickEvent.changed。 */
export function hasMeaningfulChange(changes: ChangeRecord[]): boolean {
  return changes.some((c) => c.type !== 'text');
}

/**
 * 把变化清单提炼成简短摘要，供 interaction.json 的 `changes` 字段使用
 * （例：`menu-visible` / `opacity-fade` / `slide-up`）。
 */
export function summarizeChanges(changes: ChangeRecord[]): string[] {
  const out = new Set<string>();
  for (const c of changes) {
    switch (c.type) {
      case 'dom-added':
        out.add('element-added');
        break;
      case 'dom-removed':
        out.add('element-removed');
        break;
      case 'visibility':
        out.add(c.change.startsWith('hidden→') ? 'menu-visible' : 'menu-hidden');
        break;
      case 'opacity':
        out.add('opacity-fade');
        break;
      case 'transform':
      case 'position':
        out.add('slide');
        break;
      case 'text':
        out.add('text-changed');
        break;
    }
  }
  return [...out];
}

/**
 * 提取本次交互实际变化的 CSS 属性 —— GSAP 补间的直接依据。
 *
 * 刻意过滤掉 layout 属性之外的噪声：只保留 opacity / transform / display，
 * 因为其余属性（width/height/margin）做补间会触发重排，性能差。
 */
export function extractAnimatedProperties(changes: ChangeRecord[]): string[] {
  const props = new Set<string>();
  for (const c of changes) {
    if (c.type === 'opacity') props.add('opacity');
    if (c.type === 'transform' || c.type === 'position') props.add('transform');
    if (c.type === 'visibility') props.add('visibility');
    // DOM 增删也算「元素从无到有/从有到无」，可动画的属性就是 visibility。
    // 真机统计：Apple 的 mega-menu 只报 dom-added/removed，不映射的话
    // 6 个有效交互里只有 1 条能产出 animation，Animation Agent 拿不到输入。
    if (c.type === 'dom-added' || c.type === 'dom-removed') props.add('visibility');
  }
  return [...props];
}
