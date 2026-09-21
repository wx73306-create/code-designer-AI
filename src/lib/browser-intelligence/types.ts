/**
 * Browser Intelligence Layer — 冻结接口定义
 * ===================================================================
 * Phase 1 的「接口冻结」产物：本文件定义**采集层向上层输出什么**。
 *
 * 冻结原则（改动本文件即视为 breaking change，需同步 bump
 * `WEBSITE_PACKAGE_VERSION` 并更新 docs/phase1-browser-intelligence.md）：
 *   1. 所有类型可序列化为 JSON —— 禁止 RegExp / Function / Map 等不可序列化成员
 *   2. 截图一律用「引用 + 可选 base64」表达，是否内联由调用方按 token 预算决定
 *   3. 浏览器引擎差异只允许出现在 `PageController` 之下，explorer 层不感知
 *
 * 当前状态：Sprint 1 只实现 scroll 相关能力。click / animations 的接口
 * **现在就冻结**（避免 Sprint 2 再改数据结构），但实现留到后续 Sprint。
 */

// ---------------------------------------------------------------------------
// 引擎抽象 —— 让 explorer 可以脱离真实浏览器做单测
// ---------------------------------------------------------------------------

/**
 * 浏览器页面的最小能力抽象。
 *
 * 存在理由：真实 puppeteer Page 无法在 vitest（node 环境）里实例化，
 * 若 explorer 直接依赖它，滚动分段、安全策略等**核心逻辑就不可测**。
 * 收窄成这 5 个方法后，测试可注入一个假实现。
 */
export interface PageController {
  /** 当前页面地址。 */
  readonly url: string;
  /** 导航到目标地址。 */
  goto(url: string, options?: { timeoutMs?: number }): Promise<void>;
  /**
   * 在页面上下文求值。刻意只接受「无参函数或字符串」，
   * 避免把外部变量闭包进浏览器上下文（序列化会炸）。
   */
  evaluate<T>(fn: string | (() => T)): Promise<T>;
  /** 截取当前视口，返回 base64 PNG（不含 data URI 前缀）。 */
  screenshot(options?: ScreenshotOptions): Promise<string>;
  /** 设置视口尺寸。 */
  setViewport(width: number, height: number): Promise<void>;
  /** 关闭页面。 */
  close(): Promise<void>;
}

export interface ScreenshotOptions {
  /** 是否截取整页（浏览器拼接长图）。默认 false —— 分段截图用视口即可。 */
  fullPage?: boolean;
  /** 图片格式。 */
  type?: 'png' | 'jpeg';
  /** JPEG 质量（仅 type=jpeg 时有效）。 */
  quality?: number;
}

/** 一次浏览器会话的句柄，负责回收资源。 */
export interface BrowserSession {
  readonly page: PageController;
  close(): Promise<void>;
}

export interface BrowserManagerOptions {
  viewport?: { width: number; height: number };
  userAgent?: string;
  timeoutMs?: number;
  headless?: boolean;
}

// ---------------------------------------------------------------------------
// 截图引用
// ---------------------------------------------------------------------------

/**
 * 一张截图的引用。
 *
 * 为什么 base64 是可选的：Vision Agent 的 token 预算有限，Sprint 1 可能产出
 * 8+ 张截图。全量内联会撑爆上下文，所以这里只存引用，由上层 formatter
 * 按预算决定内联几张（沿用 website-package/formatter.ts 的 LIMITS 机制）。
 */
export interface StateScreenshot {
  /** 稳定标识，如 `scroll-02` / `state-003-menu-open`。 */
  id: string;
  /** 建议的落盘文件名（导出 website-package 时使用）。 */
  filename: string;
  width: number;
  height: number;
  /** base64 PNG，无 data URI 前缀。调用方决定是否填充。 */
  dataUrl?: string;
}

// ---------------------------------------------------------------------------
// 滚动探索（Sprint 1）
// ---------------------------------------------------------------------------

export interface ScrollViewport {
  width: number;
  height: number;
}

/** 一次滚动采样。 */
export interface ScrollEvent {
  type: 'scroll';
  /** 采样序号，从 0 开始（0 = 首屏，未滚动）。 */
  index: number;
  /** 滚动到的绝对 Y 位置（px）。 */
  position: number;
  /** 采集当时的文档总高度 —— 懒加载会让它在过程中变化。 */
  documentHeight: number;
  viewport: ScrollViewport;
  /**
   * 该位置命中的区块提示（由 `document.elementFromPoint` 向上查找得出）。
   * 没有分层信息时省略，**不要**填 'unknown' 占位。
   */
  sectionHint?: string;
  screenshot: StateScreenshot;
  /** 相对采集开始的毫秒数。 */
  timestamp: number;
}

export interface ScrollExplorerOptions {
  /** 采样视口 —— 通常等于浏览器视口。 */
  viewport: ScrollViewport;
  /**
   * 相邻两次采样的重叠比例（0-0.5）。
   * 非 0 是为了避免恰好切在某个区块中间，导致该区块在两张图里都不完整。
   * 默认 0.1。
   */
  overlapRatio?: number;
  /** 采样数上限（含首屏）。防止无限滚动页面产出上百张图。默认 8。 */
  maxSteps?: number;
  /** 每次滚动后的稳定等待（ms），等懒加载与入场动画。默认 600。 */
  settleMs?: number;
  /** 文档高度增长超过此比例则判定为无限滚动并停止采样。默认 1.5。 */
  infiniteScrollGrowthRatio?: number;
  /** 是否内联 base64。默认 false（只存引用）。 */
  inlineScreenshots?: boolean;
}

// ---------------------------------------------------------------------------
// 页面状态（Sprint 1 起，Sprint 2 扩到 click 触发）
// ---------------------------------------------------------------------------

/** 触发某个页面状态的动作。 */
export type StateTrigger =
  | { type: 'initial' }
  | { type: 'scroll'; position: number }
  | { type: 'click'; selector: string; text?: string };

/** 一个被捕获的页面状态。 */
export interface PageState {
  /** 稳定标识，如 `home` / `scroll-02` / `menu-open`。 */
  stateId: string;
  /** 人类可读标签。 */
  label: string;
  trigger: StateTrigger;
  screenshot: StateScreenshot;
  /**
   * 相对上一个状态的可见性差异提示（由 interaction-analyzer 填充）。
   * Sprint 1 不填 —— 差异比对需要像素级 diff，留到后续。
   */
  diffHint?: string;
}

// ---------------------------------------------------------------------------
// Sprint 2 — Interaction Explorer Layer（接口冻结，本轮实现）
// ---------------------------------------------------------------------------

/**
 * 元素语义类型。由 element-detector 从 tag / role / aria 属性推断。
 *
 * 比 `ClickTargetKind` 更细：detector 阶段需要区分 accordion / select 等
 * 交互控件，才能决定「怎么点」以及「点完怎么恢复」。
 */
export type ElementType =
  | 'nav'
  | 'tab'
  | 'menu'
  | 'dropdown'
  | 'accordion'
  | 'modal-trigger'
  | 'button'
  | 'link'
  | 'select'
  | 'unknown';

/**
 * 风险等级。
 *
 * 用字符串联合而非 TS `enum`：InteractionPackage 必须可 JSON 序列化，
 * enum 编译后是数字，`interaction.json` 里会变成无意义的 `2`。
 * 常量对象 {@link RISK} 提供等价的书写便利。
 */
export type RiskLevel = 'SAFE' | 'CAUTION' | 'BLOCKED';

export const RISK = {
  SAFE: 'SAFE',
  CAUTION: 'CAUTION',
  BLOCKED: 'BLOCKED',
} as const satisfies Record<RiskLevel, RiskLevel>;

/** detector 从页面里提取到的一个候选交互元素。 */
export interface DetectedElement {
  /** 稳定标识，如 `element-001`。同一元素在多次刷新间不保证一致。 */
  id: string;
  type: ElementType;
  /** 可见文本（trim + 截断到 80 字符）。 */
  text: string;
  /** 可再次定位的 CSS selector（detector 生成，优先用 id / data-* 属性）。 */
  selector: string;
  /** 元素中心点（视口坐标），用于判断是否在首屏内。 */
  position: { x: number; y: number };
  /** 是否当前可见（宽高 > 0 且 display 非 none）。 */
  visible: boolean;
  /** `<a href>` 目标 —— 用于识别「会跳走的链接」。 */
  href?: string;
  /**
   * 元素所在页面区域，由 detector 从 `closest('footer')` / `closest('header nav, nav')` 得出。
   *
   * 为什么需要这个字段：**不能靠 selector 判断区域**。detector 生成的 selector
   * 优先用 `#id` / `tag.class`，永远不会包含 `footer`，导致
   * `excludeSelectors: ['footer a']` 这类规则形同虚设（真机实测：101 个候选
   * 只拦下 1 个，页脚的法务/社交/站点地图链接全部进了候选集）。
   */
  region?: 'header' | 'footer' | 'main';
  /** `aria-expanded` 原值，tab / menu / accordion 的关键信号。 */
  ariaExpanded?: boolean;
  /** 风险等级，由 interaction-policy 判定后填充。 */
  risk: RiskLevel;
  /** 判定依据（命中了哪条规则），便于回溯。 */
  riskReason?: string;
}

/** state-diff 的比对输入：一批元素的可见性与关键样式快照。 */
export interface ElementSnapshot {
  selector: string;
  /** 元素是否可见。 */
  visible: boolean;
  /** computed opacity。 */
  opacity: string;
  /** computed display。 */
  display: string;
  /** computed transform（平移/缩放类动画的关键）。 */
  transform: string;
  /** 元素矩形，用于识别「滑出」类动画。 */
  rect: { x: number; y: number; width: number; height: number };
}

/** 一次状态比对的输入快照。 */
export interface StateSnapshot {
  /** 快照时间戳（相对采集开始）。 */
  timestamp: number;
  elements: ElementSnapshot[];
}

/** 变化类型 —— 直接决定 GSAP 该用什么属性补间。 */
export type ChangeType =
  | 'dom-added'
  | 'dom-removed'
  | 'visibility'
  | 'opacity'
  | 'transform'
  | 'position'
  | 'text';

/** 一条具体变化。 */
export interface ChangeRecord {
  type: ChangeType;
  /** 发生变化的元素 selector（DOM 增删时为描述性文本）。 */
  target: string;
  /** 人类可读的变化摘要，如 `hidden→visible` / `0→1` / `translateY(-8px)→none`。 */
  change: string;
  /**
   * 结构化细节，供 Animation Agent 直接取用。
   * 例：`{ opacity: '0→1', transform: 'translateY(-8px)→none' }`
   */
  detail?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// 点击探索（接口冻结，Sprint 2 实现）
// ---------------------------------------------------------------------------

export type ClickTargetKind = 'nav' | 'tab' | 'button' | 'dropdown' | 'modal' | 'unknown';

/** 一个被选中（或被排除）的可点击目标。 */
export interface ClickTarget {
  /** 可用于再次定位的 CSS selector。 */
  selector: string;
  /** 可见文本（已 trim，超长截断）。 */
  text?: string;
  kind: ClickTargetKind;
  /** 命中/排除的规则名，便于回溯「为什么点它」。 */
  matchedRule?: string;
}

export interface ClickEvent {
  type: 'click';
  /** 稳定标识，如 `click-001`。 */
  id: string;
  target: ClickTarget;
  before: StateScreenshot;
  /** 点击后的截图。若被安全策略拦截则不存在。 */
  after?: StateScreenshot;
  /** 点击是否真的引起了可见变化。 */
  changed: boolean;
  /** 由 state-diff 得出的变化清单 —— Animation Agent 的主要输入。 */
  changes: ChangeRecord[];
  timestamp: number;
  /**
   * 点击后用于恢复页面的手段。
   * 为什么必须记录：不恢复的话，后续候选元素会基于「已展开」的错误状态去点，
   * 采到的第二、第三个交互全是脏数据。
   */
  recovery?: RecoveryStrategy;
  /** 被安全策略拒绝时记录原因（此时 after 为空）。 */
  blocked?: string;
}

/**
 * 点击后的状态恢复手段，按序尝试。
 * `reload` 是兜底 —— 最慢但一定有效。
 */
export type RecoveryStrategy =
  | { method: 're-click'; selector: string }
  | { method: 'escape' }
  | { method: 'history-back' }
  | { method: 'reload' };

/**
 * 点击安全策略。
 *
 * 为什么必须存在：真实站点上有「删除 / 支付 / 登录 / 注销」类按钮，
 * 自动点击可能造成不可逆副作用。默认策略是**白名单 + 黑名单**，
 * 且黑名单优先级更高。
 */
export interface ClickSafetyPolicy {
  /** 允许点击的 selector 模式（CSS selector 字符串）。 */
  includeSelectors: string[];
  /** 必须排除的 selector 模式 —— 优先级高于 include。 */
  excludeSelectors: string[];
  /**
   * 文本黑名单（正则**字符串**，不是 RegExp —— 本类型必须可 JSON 序列化）。
   * 命中即拒绝，如 '删除' / 'delete' / 'pay' / 'logout'。
   */
  excludeTextPatterns: string[];
  /** 单次采集最多点击次数。默认 6。 */
  maxClicks?: number;
}

// ---------------------------------------------------------------------------
// 交互动画（接口冻结，Sprint 3 接入 GSAP Agent）
// ---------------------------------------------------------------------------

/** 一次交互触发的动画观察结果。 */
export interface InteractionAnimation {
  trigger: StateTrigger;
  /** 实际发生变化的 CSS 属性（决定 GSAP 用 transform 还是 layout 属性）。 */
  properties: string[];
  duration?: string;
  easing?: string;
}

// ---------------------------------------------------------------------------
// 汇总：写入 WebsitePackage.interaction
// ---------------------------------------------------------------------------

/** 采集过程的元信息 —— 用于下游判断数据可信度。 */
export interface InteractionMeta {
  capturedAt: string;
  viewport: ScrollViewport;
  /** 采集结束时的文档高度。 */
  documentHeight: number;
  screenshotCount: number;
  /**
   * 采集被降级或跳过的原因。
   * 例：'browser-unavailable'（没找到 Chrome）/ 'infinite-scroll' / 'timeout'。
   * **有值时下游 Agent 应降低对 interaction 字段的信任度。**
   */
  degraded?: string;
}

/**
 * Browser Intelligence Layer 向 WebsitePackage 输出的完整契约。
 *
 * 对应导出目录：interaction.json
 *   scrolls    → 分段滚动采样
 *   clicks     → 点击探索（Sprint 2）
 *   states     → 页面状态序列
 *   animations → 交互动画（Sprint 3）
 */
export interface InteractionPackage {
  scrolls: ScrollEvent[];
  clicks: ClickEvent[];
  states: PageState[];
  animations: InteractionAnimation[];
  meta: InteractionMeta;
}

/** 创建空的 InteractionPackage —— 保证下游永远不用 guard 顶层字段。 */
export function createEmptyInteraction(viewport: ScrollViewport): InteractionPackage {
  return {
    scrolls: [],
    clicks: [],
    states: [],
    animations: [],
    meta: {
      capturedAt: new Date().toISOString(),
      viewport,
      documentHeight: 0,
      screenshotCount: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// interaction.json —— 导出格式（与内部契约 InteractionPackage 的关系）
// ---------------------------------------------------------------------------

/**
 * 导出用的统一事件流条目。
 *
 * 把 scroll / click 两类采样压平成一条时间线，便于 Vision Agent 按
 * 「用户如何操作这个页面」的顺序理解。
 */
export type InteractionEvent =
  | {
      id: string;
      type: 'scroll';
      position: number;
      /** 状态引用（对应 states[].stateId），而非内联截图。 */
      state: string;
      label: string;
    }
  | {
      id: string;
      type: 'click';
      target: { text: string; selector: string; kind: ClickTargetKind };
      before: string;
      after?: string;
      /** 变化摘要列表（如 `menu-visible`），从 ChangeRecord 提炼。 */
      changes: string[];
      blocked?: string;
    };

/**
 * `interaction.json` 的顶层结构。
 *
 * 与 {@link InteractionPackage} 的分工：
 * - `InteractionPackage` 是**写入 WebsitePackage 的内部契约**，字段齐全、含截图对象；
 * - `InteractionExport` 是**落盘/交付用的文件格式**，用状态 id 引用替代内联截图。
 * 两者由 interaction-recorder 做一次转换，避免让下游 Agent 同时理解两套结构。
 */
export interface InteractionExport {
  url: string;
  capturedAt: string;
  /** 页面状态字典：stateId → 页面状态。 */
  states: PageState[];
  /** 按时间排序的统一事件流。 */
  events: InteractionEvent[];
  meta: InteractionMeta;
}

/** 默认点击安全策略 —— 偏保守，宁可少点也不误点。 */
export const DEFAULT_CLICK_SAFETY: ClickSafetyPolicy = {
  includeSelectors: [
    'header nav a',
    'header button',
    '[role="tab"]',
    '[role="button"]',
    'button[aria-expanded]',
    '[aria-haspopup="true"]',
    '.nav-item',
    '.tab',
  ],
  excludeSelectors: [
    'footer a',
    'footer button',
    'a[target="_blank"]',
    'a[href^="mailto:"]',
    'a[href^="tel:"]',
    '[aria-label*="social" i]',
    '[class*="social"]',
    '[class*="cookie"]',
    '[class*="advert"]',
    'form button',
    'button[type="submit"]',
  ],
  excludeTextPatterns: [
    '删除', '移除', '注销', '退出登录', '登出', '登录', '支付', '付款', '结算',
    '下单', '购买', '订阅', '确认', '提交',
    'delete', 'remove', 'logout', 'log out', 'sign out', 'sign in', 'signin',
    'pay', 'checkout',
    'purchase', 'subscribe', 'confirm', 'submit', 'place order',
  ],
  maxClicks: 6,
};
