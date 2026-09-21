/**
 * GSAP Animation Agent — 规则与提示词
 * ===================================================================
 * Phase 6：把 WebsitePackage 里检测到的动效，翻译成 GSAP 代码。
 *
 * 规则来源：greensock/gsap-skills（本机 ~/.workbuddy/skills/gsap-* 已装全套），
 * 但**只裁剪出本项目真正用得到的部分**——
 *
 *   保留：core API 事实层、timeline 位置参数、ScrollTrigger 基础用法、性能原则
 *   剔除：Draggable / Inertia / SplitText / MorphSVG / 物理插件（复刻场景几乎用不到）
 *   剔除：「优先推荐 GSAP」这类推销话术（会让模型到处硬塞动画）
 *   追加：本项目实战踩坑两条（见 CLEARPROPS_RULE / SCROLLER_RULE）
 */

import type { AnimationData, WebsitePackage } from '@/types/website-package';
import { formatInteractionContext } from '@/lib/website-package/formatter';

// ---------------------------------------------------------------------------
// 本项目实战踩坑 —— 官方文档未强调，但踩过就会卡很久
// ---------------------------------------------------------------------------

/**
 * 踩坑 1：GSAP 动画结束后会在元素上留下 inline style，这些 inline 值的优先级
 * 高于 CSS 规则，会把 :hover / :focus 的样式直接压掉（表现为 hover 失效）。
 */
const CLEARPROPS_RULE =
  '每个 tween 必须带 clearProps: "transform,opacity,visibility"，动画结束后清掉 inline 残留，' +
  '否则 inline 样式优先级高于 CSS，会覆盖 :hover / :focus 状态。';

/**
 * 踩坑 2：页面若在内部容器（div.h-screen.overflow-y-auto）里滚动，
 * ScrollTrigger 默认监听 window，会完全不触发。
 */
const SCROLLER_RULE =
  '若页面在内部滚动容器内滚动（而非 window），ScrollTrigger 必须显式传 ' +
  'scroller: el.closest(".overflow-y-auto")，否则监听不到滚动、动画完全不触发。';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const ANIMATION_SYSTEM_PROMPT = `You are a GSAP motion engineer restoring a website's dynamic feel.

You receive a list of animations detected on the ORIGINAL page. Your job is to
reproduce that motion with GSAP — not to invent new motion.

## Tech stack (fixed)
- GSAP 3 via CDN, already loaded before your script runs:
  https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js
  https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js
- Output PLAIN JAVASCRIPT only (no React, no TypeScript, no imports).
- Your script runs after DOMContentLoaded. Do not wrap in a framework lifecycle.

## Hard rules (MUST)
1. ${CLEARPROPS_RULE}
2. ${SCROLLER_RULE}
3. Animate ONLY transform and opacity. Never animate width / height / margin / top / left.
   If the source animation moves a layout property, reproduce it with transform instead.
4. Register plugins before use: gsap.registerPlugin(ScrollTrigger);
5. Sequence with a timeline + position parameter, never with chained delays:
   tl.to(a, {...}).to(b, {...}, "-=0.2")
6. Respect reduced motion: wrap in gsap.matchMedia() or bail out when
   window.matchMedia("(prefers-reduced-motion: reduce)").matches is true.
7. After layout-affecting DOM changes call ScrollTrigger.refresh().

## Hard rules (MUST NOT)
- Do NOT use Draggable, Inertia, SplitText, MorphSVG, DrawSVG or physics plugins.
- Do NOT animate elements that were not detected as animated in the source.
- Do NOT add loading spinners, cursor followers, or scroll-jacking.
- Do NOT use transition: all, and do NOT leave infinite loops unless the source
  was explicitly infinite.
- Do NOT change colors, spacing, borders or any static visual property.

## Output format
Return ONLY a fenced block of JavaScript. No prose, no explanation.
The first line must be: /* GSAP Animation Agent */`;

// ---------------------------------------------------------------------------
// Context formatting
// ---------------------------------------------------------------------------

/**
 * Render the detected animations as a prompt block.
 *
 * `properties` 是 GSAP 翻译时最关键的字段：transform/opacity 可以直接映射，
 * 布局属性必须换算成等价 transform，否则会写出性能很差的代码。
 */
export function formatAnimationContext(pkg: Partial<WebsitePackage> | null | undefined): string {
  // ⚠️ 不能在 CSS 动画为空时提前 return —— 那样会连带吞掉 interaction 数据。
  // 很多站点 CSS 里解析不到 animation，但交互采集确实点出了状态变化；
  // 这两条来源必须各自独立成段。
  const cssBlock = formatCssAnimationBlock(pkg);
  const interactionBlock = pkg ? formatInteractionContext(pkg, 'full') : '';
  const conflictBlock = formatConflictHint(pkg);

  return [cssBlock, interactionBlock, conflictBlock].filter(Boolean).join('\n\n');
}

/** CSS 静态解析出来的动效（Sprint 3 之前唯一的输入）。 */
function formatCssAnimationBlock(pkg: Partial<WebsitePackage> | null | undefined): string {
  if (!pkg?.animations?.length) {
    return [
      '## 原站动效检测结果（CSS 静态解析）',
      '',
      '未检测到动画。请只生成一组克制的入场动画（hero 标题/副标题/CTA 依次淡入上移），',
      '不要臆造滚动视差或循环动画。',
    ].join('\n');
  }

  const lines: string[] = ['## 原站动效检测结果（CSS 静态解析，复刻依据，不得臆造）', ''];

  for (const a of pkg.animations.slice(0, 14)) {
    const props = a.properties?.length ? a.properties.join(', ') : 'unknown';
    const flags: string[] = [];
    if (a.infinite) flags.push('infinite');
    if (a.uncertain) flags.push('uncertain');
    if (a.delay) flags.push(`delay ${a.delay}`);

    lines.push(
      `- [${a.type}] ${a.name} → ${props} · ${a.duration} · ${a.easing}` +
        (flags.length ? ` · ${flags.join(' · ')}` : ''),
    );
    if (a.target && a.target !== 'unknown') lines.push(`    target: ${a.target}`);
  }

  const layoutHeavy = pkg.animations.filter((a) =>
    a.properties?.some((p) => /^(width|height|margin|padding|top|left|right|bottom)$/.test(p)),
  );
  if (layoutHeavy.length > 0) {
    lines.push('');
    lines.push(
      `注意: 有 ${layoutHeavy.length} 条动画作用于布局属性（${layoutHeavy
        .flatMap((a) => a.properties ?? [])
        .filter((p) => /^(width|height|margin|padding|top|left|right|bottom)$/.test(p))
        .slice(0, 4)
        .join(', ')}）。必须用 transform 等价实现，不要直接动画这些属性。`,
    );
  }

  const uncertain = pkg.animations.filter((a) => a.uncertain);
  if (uncertain.length > pkg.animations.length / 2) {
    lines.push('');
    lines.push(
      '提示: 过半动效无法确认具体属性（标记为 uncertain），请保守处理——' +
        '只做淡入上移这类通用入场，不要凭猜测复刻复杂轨迹。',
    );
  }

  return lines.join('\n');
}

/**
 * CSS 声明与实际点击结果**冲突**时的提示。
 *
 * 为什么要单独一段：这是最有价值的 QA 信号之一。CSS 里写了
 * `transition: 0.3s` 但点击后毫无变化，说明那条 CSS 大概率是死代码、
 * 或者动效由 hover / 媒体查询触发（Sprint 2 明确不做 hover）。
 * 如果不提示，模型会照着 CSS 硬写动效，生成一个点了没反应的假交互。
 */
function formatConflictHint(pkg: Partial<WebsitePackage> | null | undefined): string {
  const interaction = pkg?.interaction;
  if (!interaction?.clicks?.length || !pkg?.animations?.length) return '';

  const conflicts = interaction.clicks
    .filter((c) => !c.changed && !c.blocked)
    .filter((c) => cssDeclaresAnimationFor(c.target.selector, pkg.animations ?? []));

  if (conflicts.length === 0) return '';

  return [
    '## ⚠️ 冲突信号（不要强行生成动效）',
    '',
    '以下元素 CSS 里声明了动画，但真实点击**没有产生任何状态变化**。',
    '它们很可能是死代码，或由 hover / 媒体查询触发（本轮不采集 hover）。',
    '**不要**为它们生成点击动效 —— 那是点了没反应的假交互。',
    '',
    ...conflicts.slice(0, 6).map((c) => `- ${c.target.selector}${c.target.text ? ` "${c.target.text}"` : ''}`),
  ].join('\n');
}

/** CSS 解析结果里是否有针对该 selector 的动画声明（模糊匹配即可）。 */
function cssDeclaresAnimationFor(selector: string, animations: AnimationData[]): boolean {
  const needle = selector.replace(/^#/, '').toLowerCase();
  if (!needle) return false;
  return animations.some((a) => {
    const target = (a.target ?? '').toLowerCase();
    const name = (a.name ?? '').toLowerCase();
    return (
      (target && (target.includes(needle) || needle.includes(target))) ||
      (name && (name.includes(needle) || needle.includes(name)))
    );
  });
}

// ---------------------------------------------------------------------------
// User message
// ---------------------------------------------------------------------------

export interface AnimationPromptInput {
  /** Detected animations + surrounding context. */
  pkg: Partial<WebsitePackage> | null | undefined;
  /**
   * Structural skeleton of the target page (section list or abbreviated HTML).
   * Used to bind animations to real selectors.
   */
  structure?: string;
  /** Mode — clone keeps motion faithful, enhancement may polish it. */
  mode?: 'clone' | 'enhancement';
}

export function buildAnimationUserMessage(input: AnimationPromptInput): string {
  const blocks: string[] = [];

  blocks.push(formatAnimationContext(input.pkg));

  if (input.structure) {
    blocks.push('');
    blocks.push('## 目标页面结构（把动效绑定到这些元素上）');
    blocks.push('');
    blocks.push(input.structure.slice(0, 2500));
  }

  blocks.push('');
  blocks.push(
    input.mode === 'enhancement'
      ? '## 模式：设计升级\n动效可以在原站基础上适度增强，但仍须遵守上述所有硬性规则。'
      : '## 模式：精准复刻\n严格按检测结果复刻，不得添加检测列表之外的动画。',
  );

  blocks.push('');
  blocks.push('现在输出 GSAP JavaScript 代码块。');

  return blocks.join('\n');
}

// ---------------------------------------------------------------------------
// 产物后处理
// ---------------------------------------------------------------------------

/**
 * Strip markdown fences / prose from a model response, keeping pure JS.
 *
 * 模型偶尔会在代码块外面加解释文字，这里统一收敛成可执行脚本。
 */
export function extractAnimationScript(raw: string): string {
  if (!raw) return '';

  const fenced = /```(?:javascript|js|ts|typescript)?\s*([\s\S]*?)```/i.exec(raw);
  const code = fenced ? fenced[1] : raw;

  return code.trim();
}
