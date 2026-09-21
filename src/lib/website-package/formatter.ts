/**
 * Website Intelligence Package — Formatter
 * ===================================================================
 * 把 WebsitePackage 渲染成 Agent 提示词。
 *
 * 两种形态：
 *   - `formatPackageContext()`      完整版 — Planning / Code 这类需要精确还原的步骤
 *   - `formatPackageContextCompact()` 摘要版 — 其余只需知道风格基调的步骤
 *
 * 所有列表都做了截断，避免把一次采集的全部 CSS 灌进上下文。
 */

import type { LayoutBlock, WebsitePackage } from '@/types/website-package';
import type { ClickEvent, InteractionPackage } from '@/lib/browser-intelligence/types';

// ---------------------------------------------------------------------------
// Limits — 控制注入体积，防止单次请求上下文爆炸
// ---------------------------------------------------------------------------

const LIMITS = {
  colors: 12,
  fonts: 5,
  radius: 6,
  shadows: 5,
  transitions: 8,
  animations: 10,
  sections: 14,
  assets: 10,
  flow: 8,
  /** 注入提示词的交互条数上限（采集侧上限是 6，留出余量）。 */
  clicks: 8,
  /** 交互状态（stateId）条数上限。 */
  interactionStates: 6,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 区块高度描述：`18% (2100px)`。
 *
 * 百分比是相对文档总高的占比，像素是实测高度。`heightPx` 为 1.2.0 新增的
 * **可选**字段，老数据没有它，此时只输出百分比。
 *
 * 两个都要给的理由：文档高 9000px 时，一个 900px 的 hero 只占 10%，
 * 光看百分比模型会以为它是个小块，而像素高度直接告诉它这是个大视觉入口。
 */
function blockHeight(block: LayoutBlock): string {
  return block.heightPx !== undefined
    ? `${block.heightWeight}% (${block.heightPx}px)`
    : `${block.heightWeight}%`;
}

// ---------------------------------------------------------------------------
// Full context
// ---------------------------------------------------------------------------

/**
 * Render the package as a structured prompt block.
 *
 * Sections whose data has not been produced yet are skipped entirely so the
 * model never sees "empty placeholders" it might try to invent content for.
 */
export function formatPackageContext(
  pkg: Partial<WebsitePackage> | null | undefined,
  options: { interactionLevel?: InteractionContextLevel } = {},
): string {
  if (!pkg) return '';

  const blocks: string[] = [];

  const header = formatHeader(pkg);
  if (header) blocks.push(header);

  const structure = formatStructure(pkg);
  if (structure) blocks.push(structure);

  const tokens = formatTokens(pkg);
  if (tokens) blocks.push(tokens);

  const assets = formatAssets(pkg);
  if (assets) blocks.push(assets);

  const animations = formatAnimations(pkg);
  if (animations) blocks.push(animations);

  const components = formatComponents(pkg);
  if (components) blocks.push(components);

  // 交互段：没有 interaction 时 formatInteractionContext 返回 ''，整段跳过，
  // 不会留下空标题（formatter 的既有原则）。
  const interaction = formatInteractionContext(
    pkg,
    options.interactionLevel ?? 'states',
  );
  if (interaction) blocks.push(interaction);

  if (blocks.length === 0) return '';

  return [
    '## Website Intelligence Package（唯一数据源，以此为准）',
    '',
    ...blocks,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Compact context
// ---------------------------------------------------------------------------

/** One-paragraph summary for agents that only need the design gestalt. */
export function formatPackageContextCompact(
  pkg: Partial<WebsitePackage> | null | undefined,
): string {
  if (!pkg) return '';

  const lines: string[] = [];

  const meta = pkg.metadata?.brand || pkg.metadata?.title;
  const pageType = pkg.dom?.pageType;

  lines.push(`[Package] ${meta ?? 'unknown'}${pageType ? ` · ${pageType}` : ''}`);

  if (pkg.layout?.flow?.length) {
    const flow = pkg.layout.flow
      .slice(0, LIMITS.flow)
      .map((b) => `${b.role} ${blockHeight(b)}`)
      .join(' → ');
    lines.push(`Sections: ${flow}`);
  }

  if (pkg.styles?.colors?.length) {
    const palette = pkg.styles.colors
      .slice(0, 6)
      .map((c) => `${c.role}:${c.hex}`)
      .join(' ');
    lines.push(`Colors: ${palette}`);
  }

  if (pkg.styles?.fonts?.length) {
    lines.push(`Font: ${pkg.styles.fonts[0].family}`);
  }

  if (pkg.design?.style && pkg.design.style !== 'unknown') {
    lines.push(`Style: ${pkg.design.style}`);
  }

  if (pkg.animations?.length) {
    lines.push(`Animations detected: ${pkg.animations.length}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function formatHeader(pkg: Partial<WebsitePackage>): string {
  const lines: string[] = [];

  if (pkg.metadata?.brand || pkg.metadata?.title) {
    lines.push(`- 品牌: ${pkg.metadata.brand ?? pkg.metadata.title}`);
  }
  if (pkg.url) lines.push(`- 来源: ${pkg.url}`);
  if (pkg.dom?.pageType) lines.push(`- 页面类型: ${pkg.dom.pageType}`);
  if (pkg.design?.visualLanguage) lines.push(`- 视觉语言: ${pkg.design.visualLanguage}`);
  if (pkg.design?.style && pkg.design.style !== 'unknown') {
    lines.push(`- 设计风格: ${pkg.design.style}`);
  }

  return lines.length > 0 ? ['### 概览', ...lines].join('\n') : '';
}

function formatStructure(pkg: Partial<WebsitePackage>): string {
  const lines: string[] = [];

  if (pkg.layout?.flow?.length) {
    lines.push('页面纵向构成（role · 视觉占比与实测像素高 · 列数 · 对齐 · 是否通栏）：');
    for (const block of pkg.layout.flow.slice(0, LIMITS.flow)) {
      lines.push(
        `  - ${block.role}: ${blockHeight(block)} · ${block.columns}列 · ${block.alignment} 对齐${block.fullBleed ? ' · 通栏' : ''}`,
      );
    }
    // 像素高度只在实测时才存在 —— 顺带告诉模型「文档总高」这个参照系，
    // 否则长页面上所有区块的百分比都会退化成个位数，模型分不清主次。
    const measured = pkg.layout.flow.find((b) => b.heightPx !== undefined);
    if (measured?.heightPx !== undefined && pkg.layout.gridColumns > 0) {
      lines.push(`  （主内容区列数: ${pkg.layout.gridColumns}）`);
    }
  }

  if (pkg.dom?.sections?.length) {
    lines.push('');
    lines.push('DOM 区块：');
    for (const s of pkg.dom.sections.slice(0, LIMITS.sections)) {
      lines.push(`  - <${s.tag}> role=${s.role} layout=${s.layout}`);
    }
  }

  if (pkg.layout?.stickyHeader) {
    lines.push('');
    lines.push('注意: 原站头部为吸顶/固定，复刻时需保留该行为。');
  }

  return lines.length > 0 ? ['### 页面结构', ...lines].join('\n') : '';
}

function formatTokens(pkg: Partial<WebsitePackage>): string {
  const s = pkg.styles;
  if (!s) return '';

  const lines: string[] = [];

  if (s.colors?.length) {
    lines.push('颜色（必须使用这些色值，禁止替换为通用蓝 #0071E3）：');
    for (const c of s.colors.slice(0, LIMITS.colors)) {
      lines.push(`  - ${c.hex}  (${c.role}) ${c.usage}`);
    }
  }

  if (s.fonts?.length) {
    lines.push('');
    lines.push('字体：');
    for (const f of s.fonts.slice(0, LIMITS.fonts)) {
      lines.push(`  - ${f.family}  weight=${f.weights.join('/')}  size=${f.sizes.slice(0, 4).join('/')}  role=${f.role}`);
    }
  }

  if (s.spacing) {
    lines.push('');
    lines.push(
      `间距: 基准 ${s.spacing.base} · 容器最大宽 ${s.spacing.containerMaxWidth} · 区块内边距 ${s.spacing.sectionPadding}`,
    );
    if (s.spacing.scale.length) lines.push(`  刻度: ${s.spacing.scale.join(' ')}`);
  }

  if (s.borderRadius?.length) {
    lines.push('');
    lines.push(`圆角: ${s.borderRadius.slice(0, LIMITS.radius).join(' ')}`);
  }

  if (s.shadows?.length) {
    lines.push('');
    lines.push('阴影:');
    for (const sd of s.shadows.slice(0, LIMITS.shadows)) lines.push(`  - ${sd}`);
  }

  if (s.transitions?.length) {
    lines.push('');
    lines.push(`过渡声明: ${s.transitions.slice(0, LIMITS.transitions).join(' | ')}`);
  }

  const vars = Object.entries(s.cssVariables ?? {});
  if (vars.length) {
    lines.push('');
    lines.push('CSS 变量:');
    for (const [k, v] of vars.slice(0, 10)) lines.push(`  - ${k}: ${v}`);
  }

  return lines.length > 0 ? ['### Design Tokens', ...lines].join('\n') : '';
}

function formatAssets(pkg: Partial<WebsitePackage>): string {
  if (!pkg.assets?.length) return '';

  const lines = ['### 资源'];
  for (const a of pkg.assets.slice(0, LIMITS.assets)) {
    lines.push(`  - ${a.type}${a.role ? ` (${a.role})` : ''}: ${a.url}`);
  }

  return lines.join('\n');
}

function formatAnimations(pkg: Partial<WebsitePackage>): string {
  if (!pkg.animations?.length) return '';

  const lines = ['### 动效（复刻动态体验的依据）'];
  for (const a of pkg.animations.slice(0, LIMITS.animations)) {
    const props = a.properties?.length ? a.properties.join(',') : 'unknown';
    lines.push(
      `  - ${a.type}: ${props} ${a.duration} ${a.easing}${a.infinite ? ' infinite' : ''}${a.delay ? ` delay ${a.delay}` : ''}`,
    );
  }

  const layoutHeavy = pkg.animations.filter(
    (a) => a.properties?.some((p) => /width|height|margin|padding|top|left/i.test(p)),
  );
  if (layoutHeavy.length > 0) {
    lines.push('  提示: 存在作用于布局属性的动画，运行时开销较大，复刻建议改为 transform/opacity 等价效果。');
  }

  return lines.join('\n');
}

function formatComponents(pkg: Partial<WebsitePackage>): string {
  const plan = pkg.components;
  if (!plan?.tree?.length && !plan?.files?.length) return '';

  const lines = ['### 组件结构'];

  const walk = (nodes: typeof plan.tree, depth: number): void => {
    for (const n of nodes.slice(0, 12)) {
      lines.push(`  ${'  '.repeat(depth)}- ${n.name} <${n.type}>`);
      walk(n.children ?? [], depth + 1);
    }
  };
  walk(plan.tree ?? [], 0);

  if (plan.files?.length) {
    lines.push('');
    lines.push(`待生成文件: ${plan.files.slice(0, 20).map((f) => f.filename).join(', ')}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Interaction context（Phase 1 Sprint 3）
// ---------------------------------------------------------------------------

/**
 * 注入粒度 —— 三个 Agent 需要的信息量不同，不能一刀切。
 *
 * | level     | 用在哪     | 给什么                       |
 * |-----------|------------|------------------------------|
 * | `full`    | animation  | 触发条件 + 变化属性 + 状态清单 |
 * | `event`   | code       | 事件 / 目标 / 结果（不塞截图） |
 * | `states`  | planning   | 组件 + 状态列表               |
 */
export type InteractionContextLevel = 'full' | 'event' | 'states';

/**
 * 渲染 `WebsitePackage.interaction`。
 *
 * **没有交互数据时返回空字符串**，调用方据此整段跳过 —— 绝不能输出一个
 * 「## 交互」标题后面跟着空白，那会让模型以为「这个网站没有交互」
 * 甚至自行脑补（与「没采集过」是完全不同的两件事）。
 */
export function formatInteractionContext(
  pkg: Partial<WebsitePackage> | null | undefined,
  level: InteractionContextLevel = 'full',
): string {
  const interaction = pkg?.interaction;
  if (!interaction) return '';
  if (!interaction.clicks?.length && !interaction.scrolls?.length) return '';

  switch (level) {
    case 'states':
      return formatInteractionStates(interaction);
    case 'event':
      return formatInteractionEvents(interaction);
    default:
      return formatInteractionFull(interaction);
  }
}

/** animation：完整 —— 动效恢复需要「什么触发 → 变成什么样」。 */
function formatInteractionFull(interaction: InteractionPackage): string {
  const lines = ['### 交互采集（真实点击验证过，非 CSS 猜测）'];

  const changed = interaction.clicks.filter((c) => c.changed);
  const unchanged = interaction.clicks.filter((c) => !c.changed);

  if (changed.length > 0) {
    lines.push('');
    lines.push('点击后**确实发生变化**的：');
    for (const c of changed.slice(0, LIMITS.clicks)) {
      const props = animatedPropsOf(c);
      const summary = changeSummary(c);
      lines.push(
        `  - click ${c.target.selector}${c.target.text ? ` "${shortText(c.target.text)}"` : ''}` +
          ` → ${summary || '变化'} · 可补间属性: ${props.length ? props.join(',') : 'unknown'}`,
      );
    }
  }

  if (unchanged.length > 0) {
    lines.push('');
    lines.push('点击后**没有变化**的（不要为它们编造动效）：');
    for (const c of unchanged.slice(0, LIMITS.clicks)) {
      lines.push(
        `  - click ${c.target.selector}${c.target.text ? ` "${shortText(c.target.text)}"` : ''}` +
          `${c.blocked ? ` · 未执行(${c.blocked})` : ' · 无响应'}`,
      );
    }
  }

  const states = interaction.states.slice(-LIMITS.interactionStates);
  if (states.length > 0) {
    lines.push('');
    lines.push(`已捕获状态 (${interaction.states.length} 个，stateId 可用于对照截图):`);
    for (const s of states) lines.push(`  - ${s.stateId}: ${s.label}`);
  }

  if (interaction.meta.degraded) {
    lines.push('');
    lines.push(`注意: 本次采集有降级 (${interaction.meta.degraded})，上述数据的完整度较低。`);
  }

  return lines.join('\n');
}

/** code：事件 / 目标 / 结果 —— 够生成 onClick，但不塞截图。 */
function formatInteractionEvents(interaction: InteractionPackage): string {
  const lines = ['### 交互行为（需还原成事件处理代码）'];

  for (const c of interaction.clicks.slice(0, LIMITS.clicks)) {
    const result = c.changed
      ? changeSummary(c, 2)
      : c.blocked
        ? `未执行(${c.blocked})`
        : '无变化';
    lines.push(
      `  - event: click · target: ${c.target.selector}` +
        `${c.target.text ? ` "${shortText(c.target.text)}"` : ''} · result: ${result}`,
    );
  }

  return lines.join('\n');
}

/** planning：组件 + 状态 —— 让组件规划带上 `states`。 */
function formatInteractionStates(interaction: InteractionPackage): string {
  const bySelector = new Map<string, Set<string>>();

  for (const c of interaction.clicks) {
    if (!c.changed) continue;
    const states = bySelector.get(c.target.selector) ?? new Set<string>(['default']);
    for (const ch of c.changes) {
      if (ch.type === 'visibility' && ch.change.startsWith('hidden→')) states.add('open');
      else if (ch.type === 'visibility') states.add('closed');
      else if (ch.type === 'dom-added') states.add('open');
      else if (ch.type === 'dom-removed') states.add('closed');
      else if (ch.type === 'transform' || ch.type === 'position') states.add('shifted');
      else if (ch.type === 'opacity') states.add('faded');
    }
    bySelector.set(c.target.selector, states);
  }

  if (bySelector.size === 0) return '';

  const lines = ['### 需要多状态的组件（有真实交互依据）'];
  for (const [selector, states] of [...bySelector.entries()].slice(0, LIMITS.clicks)) {
    lines.push(`  - ${guessComponentName(selector)} (${selector})`);
    lines.push(`    states: [${[...states].join(', ')}]`);
  }

  return lines.join('\n');
}

/**
 * 一条点击的变化摘要。
 *
 * **去重**：多个元素的 visibility 变化摘要都是 `hidden→visible`，不去重会
 * 输出 `added (visible) / hidden→visible / hidden→visible` 这种重复串
 * （真机在 apple.com 上就是这样），白占 token 还显得像数据错误。
 */
function changeSummary(click: ClickEvent, max = 3): string {
  return [...new Set(click.changes.map((ch) => ch.change))].slice(0, max).join(' / ');
}

/**
 * 截断元素文本。
 *
 * 整块卡片的 `textContent` 可能有几百字（真机在 stripe.com 采到 60+ 字的产品介绍），
 * 全塞进提示词既占 token 又对还原交互毫无帮助 —— 只要能认出是哪个按钮就够了。
 */
function shortText(text: string | undefined, max = 24): string {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function animatedPropsOf(click: ClickEvent): string[] {
  const props = new Set<string>();
  for (const ch of click.changes) {
    if (ch.type === 'opacity') props.add('opacity');
    if (ch.type === 'transform' || ch.type === 'position') props.add('transform');
    if (ch.type === 'visibility' || ch.type === 'dom-added' || ch.type === 'dom-removed') {
      props.add('visibility');
    }
  }
  return [...props];
}

/**
 * 从 selector 猜组件名 —— 只用于给 Planning 一个可读的名字，
 * 猜不出来就返回 Interactive，绝不假装精确。
 */
function guessComponentName(selector: string): string {
  const s = selector.toLowerCase();
  if (/nav|menu|globalnav/.test(s)) return 'Navbar';
  if (/tab/.test(s)) return 'Tabs';
  if (/accordion|summary|collapse/.test(s)) return 'Accordion';
  if (/modal|dialog|overlay/.test(s)) return 'Modal';
  if (/dropdown|select|popup/.test(s)) return 'Dropdown';
  if (/carousel|slider|swiper/.test(s)) return 'Carousel';
  return 'Interactive';
}
