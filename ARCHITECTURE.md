# Code Designer AI — 系统架构

> **本文是当前架构的唯一权威来源。**
> `docs/execution-task-breakdown.md` 是 2026-09-20 的初版计划拆解，其中提到的
> `browser-use` 路线**已否决**（与 Next.js + TS 技术栈不符，改为 Playwright 自研）。
> 两者冲突时以本文为准。

最后更新：2026-09-20 · 对应基线 `v0.5.0-core-pipeline`

---

## 1. 真实数据链路

```
URL
 │
 ├──► Scraper：fetch + 正则，src/lib/website-scraper.ts（**不开浏览器**）
 │      HTML / CSS / 颜色字体 / 资源清单
 └──► Browser Intelligence：puppeteer-core，src/lib/browser-intelligence/
        （可选，`INTERACTION_CAPTURE=on` 才启用）→ interaction
 ▼
WebsitePackage ★统一数据包 src/types/website-package.ts（v1.1.0）
 │  buildWebsitePackage() 纯本地解析，零模型调用
 │  ── 全流水线唯一数据源 ──
 ├──────────┬──────────┬──────────┬──────────┐
 ▼          ▼          ▼          ▼          ▼
Vision     Planning   Code      Animation  QA
(VL 模型)   (组件树)   (React)    (GSAP)    (六维评分)
                          │          │
                          └────┬─────┘
                               ▼
                           Preview
                        （单文件 HTML）
                               │
                               ▼
                        Manual Optimization
                      （用户手动触发，非自动闭环）
```

**关键变化**：在引入 WebsitePackage 之前，`scrapedData` 只是 Vision 步骤的**局部变量**，
Planning / Code 拿不到真实色值与间距，只能靠 Vision 的文字描述去猜。现在所有步骤共享
同一份结构化数据，抓取结果另有 10 分钟 TTL 缓存（`getScraped()`）。

> **已退役的模拟接口（B.2.3.3，2026-09-24）**
>
> `POST /api/workflow`（`src/app/api/workflow/route.ts`）是一条**模拟**流水线：用硬编码
> 数据 + `setTimeout` 假装跑 6 个 Agent，**不调用模型、不抓取网页**，与上面这条真实链路无关。
> 它默认返回 `410 Gone` + 弃用说明（`{ deprecated, replacement, endpoints }`）；
> 仅当显式带 `?legacy=1` 时才返回旧的模拟 SSE 流（保留是给
> `docs/execution-task-breakdown.md` P1-19 演示留的余量）。
> **任何消费方都不得把它的输出当作真实分析结果。**

---

## 2. 两条产物路径（重要）

| | 路径 A：React 工程 | 路径 B：单文件 HTML |
|---|---|---|
| 产出步骤 | `code` | `preview` |
| 技术栈 | React + TypeScript + Tailwind + **Framer Motion** | 原生 HTML + Tailwind CDN + **GSAP / CSS @keyframes** |
| 用途 | 下载 ZIP 工程源码 | 页面内实时预览与导出 |
| 动效来源 | Framer Motion 组件 | Animation Agent 生成的 GSAP 脚本（内联） |

`preview` 步骤的提示词明令**禁止**使用 React / Framer Motion 组件，因此 Animation Agent
产出的 GSAP 脚本只注入 `preview` 路径，不动 React 路径。

---

## 3. 流水线阶段与代码位置

| 阶段 | Agent ID | 服务端 Prompt | 客户端编排 |
|---|---|---|---|
| 抓取 | `browser` | — | `runWorkflow()` §1 |
| 视觉分析 | `vision` | `SYSTEM_PROMPTS.vision` | §2 |
| 风格匹配 | `stylematcher` | 知识库匹配（非模型） | §3 |
| 架构规划 | `planning` | `SYSTEM_PROMPTS.planning` | §3 |
| 代码生成 | `code` | `SYSTEM_PROMPTS.code` | §4 |
| 动效恢复 | `animation` | `SYSTEM_PROMPTS.animation` | §5（try/catch，失败降级） |
| 高保真预览 | `preview` | `SYSTEM_PROMPTS.preview` | §5 |
| 质量评分 | `qa` | `SYSTEM_PROMPTS.qa` | §6 |
| 优化方案 | —（复用 `qa` 日志） | `SYSTEM_PROMPTS.optimize` | `triggerManualOptimization()` |
| 导出 | `deploy` | — | — |

- 服务端单入口：`src/app/api/mimo/route.ts`（按 `step` 分派）
- 客户端编排：`src/store/use-workflow.ts` 的 `runWorkflow()`

> ⚠️ `src/lib/agents/pipeline.ts` 是**历史遗留的旧编排，零调用方**，已归档到
> `src/legacy/agents/`。不要基于它理解当前架构，详见 `src/legacy/agents/README.md`。

---

## 4. 模块地图

| 目录 / 文件 | 职责 |
|---|---|
| `src/types/website-package.ts` | 统一数据包协议（单一数据源） |
| `src/lib/website-package/adapter.ts` | `buildWebsitePackage()`：DOM/CSS → 结构化数据 |
| `src/lib/website-package/formatter.ts` | 完整版 / 摘要版两种上下文，带截断 |
| `src/lib/animation/gsap-rules.ts` | GSAP 系统提示词 + 脚本提取；内置 ClearProps / Scroller 两条踩坑规则 |
| `src/lib/browser-intelligence/` | **Phase 1 采集层**：滚动分段 + 交互探索，产出 `InteractionPackage` |
| `src/lib/visual-evaluation/` | 六维视觉评分 + 优化方案归一化 |
| `src/lib/code-rules/` | Premium Design Rules 确定性校验 |
| `src/lib/knowledge-base/` | 风格匹配与设计系统生成 |
| `src/store/use-workflow.ts` | 流水线编排 + 手动优化入口 |
| `src/store/agent-store.ts` | Agent / Task 状态（Zustand） |
| `src/legacy/` | 归档死代码，**已排除出 tsconfig** |

---

## 4.1 Phase 1 采集层（Browser Intelligence Layer）

`src/lib/browser-intelligence/` 把「静态抓取」升级为「动态理解」，产出
`InteractionPackage`（Sprint 3 起写入 `WebsitePackage.interaction`）。

```
openBrowserSession (browser-manager，唯一接触 puppeteer-core 的模块)
   ↓
explorePageScroll        → 滚动分段截图 + section 提示            [Sprint 1]
explorePageInteraction   → 上面 + 元素扫描 → 风险分级 → 点击 → 恢复  [Sprint 2]
   ↓
interaction-recorder     → interaction.json（stateId 引用，不含 base64）
```

| 模块 | 职责 |
|---|---|
| `browser-manager.ts` | 唯一接触 puppeteer-core 的地方；复用 `screenshot.ts` 的 `getBrowser()` 与 `website-scraper.ts` 的 `assertSafeUrl()`（SSRF 必须共用，否则新模块成绕过点） |
| `element-detector.ts` | 候选元素扫描、类型推断、selector 生成、去重排序 |
| `interaction-policy.ts` | 风险分级 SAFE / CAUTION / BLOCKED + 恢复策略建议 |
| `click-explorer.ts` | 点击执行与**状态恢复**（恢复失败则后续交互全是脏数据） |
| `state-diff.ts` | 前后状态比对 → `ChangeRecord[]`（Sprint 3 给 GSAP 的输入） |
| `interaction-recorder.ts` | 汇总 + 导出 `interaction.json` |
| `interaction-explorer.ts` | 高层编排：滚动分段 → 回到顶部 → 点击探索 |
| `interaction-cache.ts` | **带缓存的采集入口**（Sprint 3）—— 见下 |

### Sprint 3 — interaction 如何进入 Agent

```
explorePageInteraction
   ↓
getInteractionPackage(url)   ← 缓存：key 含 url+viewport+device，
   ↓                           成功 10min / 失败 60s，并发去重
buildWebsitePackage({ scraped, interaction })
   ↓
WebsitePackage v1.1.0  { ...既有字段, interaction? }
   ↓
┌──────────────┬──────────────┬──────────────┐
│ vision       │ planning     │ code         │
│ 不注入        │ states 粒度   │ event 粒度    │
└──────────────┴──────────────┴──────────────┘
                                     ↓
                              animation（full 粒度）
```

**为什么必须缓存**：一次生成会调三次 `buildWebsitePackage()`
（`planning` / `code` / `animation` 各一次），采集实测 20-32s，
不缓存就是约 90s 白烧，而 `/api/mimo` 的 `maxDuration` 只有 300s。

**两条不可违反的约定**：

1. `WebsitePackage.interaction` 缺失时必须是 **`undefined`，不能是空对象** ——
   formatter 的原则是「空段整体跳过，绝不让模型看到空占位符」，
   否则模型会把「没采集过」误读成「这个网站没有交互」甚至自行补全。
2. **Agent 不得直接读 `interaction.json`** —— 采集产物将来可能来自数据库或
   云端队列，`buildInteractionPackage()` 是唯一归一化入口。

**开关**：`INTERACTION_CAPTURE`（默认 `off`）。未开启时链路行为与开启前完全一致。

要点：

- **引擎是 puppeteer-core，不是 Playwright**（`browser-manager.ts` 之内消化差异）。
- 任何失败都降级返回带 `meta.degraded` 的包，**不抛错**——采集层挂掉不该阻断流水线。
- Animation Agent 里 **CSS 静态解析 与 交互采集是并列两段，不合并** ——
  两者的矛盾（CSS 写了 transition 但点击无变化）本身就是 QA 信号。
- 真机验收脚本：`npm run verify:interaction -- <url>`（`.verify/<host>/`）、
  `npm run verify:sprint3 -- <url>`（`.verify-sprint3/`）。
- 设计文档：`docs/phase1-browser-intelligence.md`、`docs/phase1-sprint2-interaction.md`、
  `docs/phase1-sprint3-animation-recovery.md`。

### Phase 2 Sprint A — 布局真值（Layout Ground Truth）

```
scrapeWebsite（fetch + 正则，不开浏览器）
   ↓
getLayoutProbe(url)   ← 缓存：key 含 url+viewport+device，
   ↓                    成功 10min / 失败 60s，并发去重
probeLayout(page)     ← 浏览器内只采原始几何（top/height/width/childTops…）
   ↓                    Node 侧做语义推断（role/列数/占比）
buildWebsitePackage({ scraped, interaction, layout })
   ↓
WebsitePackage v1.2.0  { ..., interaction?, layout.flow[].heightPx }
   ↓
formatter → 「- hero: 18% (2100px) · 1列 · center 对齐 · 通栏」
```

**这一轮修的是什么**：`layout.flow` 曾经由 `buildFlow()` 用**硬编码常量表**
（nav:4 / hero:26 / feature:20 …）按角色推算，任何网站的 hero 都是同一个百分比——
它产出的是**伪装成测量结果的猜测**，比没有数据更危险，因为下游会当真。
该函数已删除。

**核心约定**：

> 没测过 = `flow: []`（**unknown**），不是 guess。宁可没有数据，也不给假数据。

**开关**：`LAYOUT_PROBE`（默认 `off`）。未开启时 `flow` 为 `[]`，formatter 整段跳过。

**分层原则**：浏览器内**只返回原始几何**，禁止 hero/feature 判断、列数推断、占比计算；
全部语义推断在 Node 侧纯函数里做。理由：判定规则改起来不用碰浏览器代码、
引擎差异隔离在 `PageController` 之下、Node 侧可在 vitest 里直接单测。

**真机验收**：`npm run verify:layout`（三站点 Layout Truth Test，产物 `.verify-layout/`）。
实测 apple `hero 18% (2100px)`、stripe `hero 4% (685px)`、linear 最大区块 12%，
修复前的 `[]` / `hero 57%` / `nav 100%` 全部消失。

设计文档：`docs/phase2-visual-accuracy-discovery.md`、
`docs/phase2-sprintA-layout-ground-truth-design.md`。

---

## 5. QA 手动优化模式

```
六维评分展示  ──►  [用户点击]生成优化方案  ──►  Optimization Agent
                                                    │
                                                    ▼
                                           优化方案卡片（P0/P1/P2）
                                                    │
                                            [用户点击]应用并重新生成
                                                    │
                                                    ▼
                                      注入 optimizationIssues → 重跑 code
```

**不存在自动触发路径**：`pendingOptimizationIssues` 只有 `applyOptimizationPlan()`
会写入，`runWorkflow()` 中零引用。这是「评分不达标就自动重生成」被移除后的硬保证。

注意：`applyOptimizationPlan()` 会走 `startTask()` 重跑完整流水线，**消耗一次生成配额**。

---

## 6. 本地运行约定（端口）

| 端口 | 用途 |
|---|---|
| 3000 | ChatGPT2API（**已被占用**，勿用于本项目） |
| 3100 | Docker 生产等价栈 |
| 3111 | 本地 dev 预览 |

构建 / 启动前必须 `unset NODE_OPTIONS=--use-system-ca`，否则与 Next.js build worker 冲突。

---

## 7. 质量门禁

每次改动需全绿：

```
npx vitest run          # 单元测试
npx tsc --noEmit        # 类型检查
npx eslint src          # 静态检查
npx next build          # 构建
```

已知历史问题：`next build` 报 `errno -4094` 时，是 `.next/standalone` 残留所致
（非权限问题），执行 `mv .next/standalone .next/_standalone_stale_*` 后重试。
