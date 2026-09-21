# Phase 1 — Browser Intelligence Layer 技术方案（接口冻结）

> 状态：**接口已冻结**（`src/lib/browser-intelligence/types.ts`）
> 实现进度：Sprint 1 完成 · Sprint 2 / 3 未开始
> 基线：v0.5.0-core-pipeline

---

## 0. 先修正一个关键事实：项目用的是 puppeteer-core，不是 Playwright

原方案写的是「Playwright Intelligence Layer」。**实际代码里的浏览器栈是 puppeteer-core**：

| 能力 | 文件 | 实现 |
|---|---|---|
| 静态采集 | `src/lib/website-scraper.ts` | 纯 `fetch` + 正则解析 HTML/CSS（**完全不用浏览器**） |
| 截图 | `src/lib/screenshot.ts` | `puppeteer-core` + 系统已装的 Chrome/Edge |

`package.json` 里 `@playwright/test` 只在 devDependencies，仅用于 e2e，不在生产链路。

**决定：用 puppeteer-core 实现，不引入 Playwright。** 理由：

1. **浏览器二进制下载在本机不可行**。puppeteer-core 是「不带浏览器的内核」，
   靠 `findBrowserExecutable()` 找系统 Chrome/Edge 启动——这条链路已跑通。
   换 Playwright 需要下载 chromium，本机 `storage.googleapis.com` 不可达
   （实测镜像站速率 0 或 54KB/s 后断连），会直接卡死。
2. **避免两套浏览器栈**。生产链路已经在用 puppeteer-core 截图，再引入一套会增加
   部署体积与排查成本。
3. 引擎差异被收敛在 `browser-manager.ts` 一个模块内（见 §2），
   将来真要换 Playwright，上层 explorer 零改动。

> 若你坚持要 Playwright：改动面仅限 `browser-manager.ts`（约 100 行），
> 但需要先解决浏览器二进制下载问题。

---

## 1. 目标：从「看截图猜网站」到「理解网站」

现状的真实短板不是「只截了首屏」——`captureWebsiteScreenshots()` 其实已经截了
`fullPage`。问题是：

- `fullPage` 是浏览器拼接的**超长图**，喂给 VL 模型会被缩放，细节全丢；
- 这张长图**没有分段语义**，模型不知道「哪里是 Hero 结尾、哪里是 Pricing 开始」；
- 完全没有交互信息——下拉菜单、Tab 切换、Modal 这些状态，静态采集永远拿不到。

升级后：

```
URL
 ↓
Browser Intelligence Layer   ← 新增
 ↓
WebsitePackage（+ interaction 字段）
 ↓
Vision / Planning / Code / Animation / QA
```

---

## 2. 模块划分与职责

```
src/lib/browser-intelligence/
├── types.ts               ★ 冻结接口（本次交付）
├── browser-manager.ts     引擎生命周期：启动/视口/UA/超时/回收
├── scroll-explorer.ts     分段滚动采样（Sprint 1）
├── state-capture.ts       把采样封装成 PageState 序列（Sprint 1）
├── click-explorer.ts      智能点击探索（Sprint 2）
├── interaction-analyzer.ts 状态差异比对（Sprint 2+）
├── interaction-recorder.ts 汇总输出 InteractionPackage（Sprint 2）
└── index.ts
```

### 分层约束（重要）

```
browser-manager   ── 唯一接触 puppeteer 的模块
      │ 输出 PageController（5 个方法的窄接口）
      ▼
scroll-explorer / click-explorer ── 只依赖 PageController，不认识 puppeteer
```

`PageController` 存在的理由不是「为了抽象而抽象」：真实 puppeteer `Page`
在 vitest（node 环境）里无法实例化，若 explorer 直接依赖它，
**滚动分段、安全策略这些核心逻辑就完全不可测**。收窄成 5 个方法后
可注入假实现跑单测。

---

## 3. 接口冻结（契约正文见 `types.ts`）

### 3.1 写入 WebsitePackage 的新字段

```ts
interface WebsitePackage {
  // ...既有字段
  interaction: InteractionPackage;   // 新增，必填（空结构由 createEmptyPackage 填）
}

interface InteractionPackage {
  scrolls: ScrollEvent[];           // Sprint 1
  clicks: ClickEvent[];             // Sprint 2（接口先冻结）
  states: PageState[];              // Sprint 1
  animations: InteractionAnimation[]; // Sprint 3（接口先冻结）
  meta: InteractionMeta;            // 含 degraded 字段，下游据此判断可信度
}
```

**为什么是必填而不是可选**：与现有 `design` / `components` 字段保持一致——
`createEmptyPackage()` 填充空结构，下游 Agent 永远不用 guard 顶层字段缺失。

**版本**：新增字段是向后兼容的加法，`WEBSITE_PACKAGE_VERSION` 1.0.0 → 1.1.0。

### 3.2 截图一律「引用 + 可选 base64」

```ts
interface StateScreenshot {
  id: string;         // 'scroll-02' / 'state-003-menu-open'
  filename: string;   // 建议落盘名
  width: number;
  height: number;
  dataUrl?: string;   // ← 可选
}
```

Sprint 1 可能产出 8 张截图，全量内联会撑爆 Vision Agent 的 token 预算。
是否内联由上层 `formatter.ts` 按预算决定（沿用既有的 LIMITS 截断机制）。

### 3.3 滚动采样

```ts
interface ScrollEvent {
  type: 'scroll';
  index: number;              // 0 = 首屏
  position: number;           // 绝对 Y
  documentHeight: number;     // 采集当时（懒加载会变）
  viewport: ScrollViewport;
  sectionHint?: string;       // elementFromPoint 向上查找得出，无则省略
  screenshot: StateScreenshot;
  timestamp: number;          // 相对采集开始
}
```

### 3.4 状态

```ts
type StateTrigger =
  | { type: 'initial' }
  | { type: 'scroll'; position: number }
  | { type: 'click'; selector: string; text?: string };
```

Sprint 1 只会产出 `initial` 与 `scroll` 两种 trigger；`click` 留到 Sprint 2，
但类型现在就定义好，避免 Sprint 2 改数据结构。

### 3.5 不可序列化的东西一律禁止

`InteractionPackage` 会被写进 `interaction.json` 并跨 Agent 传递。
因此 `ClickSafetyPolicy.excludeTextPatterns` 是 **正则字符串数组**，不是 `RegExp[]`。

---

## 4. 安全策略（Sprint 2，但规则现在就定）

自动点击最大的风险是误触不可逆操作。`DEFAULT_CLICK_SAFETY` 采用
**白名单 + 黑名单，黑名单优先级更高**：

| 规则 | 内容 |
|---|---|
| 允许 | `header nav a`、`[role="tab"]`、`button[aria-expanded]`、`[aria-haspopup]`、`.nav-item`、`.tab` |
| 排除 | `footer *`、外链（`target=_blank`/`mailto:`/`tel:`）、社交图标、cookie 条、广告、 `form button`、`button[type=submit]` |
| 文本黑名单 | 删除/移除/注销/支付/付款/结算/下单/购买/订阅/确认/提交 及对应英文 |
| 次数上限 | 6 |

宁可少点，不可误点。被拦截的点击会记录 `blocked` 原因而不是静默跳过。

---

## 5. Sprint 划分与验收

### Sprint 1：基础采集（本次实现）

- ✅ `browser-manager.ts`
- ✅ `scroll-explorer.ts`
- ✅ `state-capture.ts`

验收：输入 Apple 官网，输出

```
screenshots/ 01-home.png / 02-scroll.png / 03-feature.png / 04-footer.png
+ interaction.json（scrolls[] + states[]）
```

### Sprint 2：交互探索

- `click-explorer.ts`（含安全策略）+ `interaction-recorder.ts` + `interaction-analyzer.ts`
- 验收：`interaction.json` 含导航点击 / 菜单展开 / Modal 的 before-after 状态对

### Sprint 3：Agent 接入

- `WebsitePackage.interaction` 接入 Vision / Planning / Code / Animation
- 验收：Planning 能产出带 `states: ["default", "menu-open"]` 的组件，
  Code 能产出带 `onClick` 的交互代码

---

## 6. 明确不做

| 不做 | 原因 |
|---|---|
| 引入 browser-use | 已验证与 Next.js + TS 栈不符，且本机无 Python 侧链路 |
| 引入 Playwright 替换 puppeteer-core | 浏览器二进制下载本机不可行，见 §0 |
| 自动探索所有点击 | 有触发删除/支付/注销等不可逆操作的风险，需 §4 安全策略 |
| 自动恢复动画 | 先采集；动画生成已由 GSAP Animation Agent 负责 |
| 像素级 diff | Sprint 1 不做，`PageState.diffHint` 留空；需要额外依赖且计算昂贵 |

---

## 7. 降级约定

采集失败**不阻断主流程**。失败时 `InteractionMeta.degraded` 记录原因，
下游 Agent 据此降低对该字段的信任度：

- `browser-unavailable` — 未找到 Chrome/Edge（最可能，取决于部署环境）
- `infinite-scroll` — 文档高度持续增长，提前停止
- `timeout` / `navigation-failed`

这与 Animation Agent 的「失败降级不阻断」策略一致。
