# Sprint 3 — Animation Interaction Recovery

> 状态：**已实现**（三个设计决策按推荐方案确认后执行）
> 基线：v0.7.0-interaction-explorer（commit adb43e8）
> 交付：commit + tag `v0.8.0-interaction-aware-agents`
> 上游：docs/phase1-browser-intelligence.md · docs/phase1-sprint2-interaction.md

---

## 0. 这一轮要解决什么

Sprint 2 已经能采到「点菜单 → 展开」这类交互，但**数据还没进入生成链路**。
Animation Agent 现在看到的只有静态 CSS 解析出来的东西：

```
- [transition] nav-menu → opacity · 0.3s · ease
```

它不知道这 0.3s 是**谁触发的**。结果只能生成入场动画，无法恢复交互。

Sprint 3 的目标：把 `interaction` 真正写进 `WebsitePackage`，让 Agent 看到：

```
- 点击 #globalnav-menubutton-link-store → visibility, transform（菜单展开）
```

---

## 1. 现状侦察结论（READ-only）

| 事实 | 位置 | 影响 |
|---|---|---|
| `WebsitePackage` 有 12 个顶层字段，**没有 `interaction`** | `src/types/website-package.ts:30` | 需新增 |
| `WEBSITE_PACKAGE_VERSION = '1.0.0'`，注释要求「breaking change 必须 bump」 | 同文件 `:354` | 需 bump |
| `createEmptyPackage()` 是完整骨架 | 同文件 `:366` | 必须同步改，否则下游拿到 undefined |
| planning / code / animation **各自调用一次** `buildWebsitePackage({ scraped })` | `api/mimo/route.ts:1600 / 1605 / 1633` | 不缓存会跑 3 次浏览器 |
| `getScraped()` 已有内存缓存（TTL 10min / LRU 50） | 同文件 `:29-48` | interaction 应做成同构缓存 |
| animation step 走 `buildAnimationUserMessage` → `formatAnimationContext`，**只读 `pkg.animations`**，上限 14 条 | `animation/gsap-rules.ts:87-111` | 主接入点 |
| `AnimationData` 无「谁触发的」字段 | `types/website-package.ts:324` | 不与 InteractionAnimation 合并 |
| formatter 有 `LIMITS` 截断，空段整体跳过 | `website-package/formatter.ts:19-29` | interaction 必须走同一套截断 |
| `maxDuration = 300`（5 分钟） | `api/mimo/route.ts:5` | **硬约束**，采集不能拖爆 |
| 实测采集耗时 20.8s / 27.2s / 31.7s | Sprint 2 真机验收 | 一次生成最多 +30s |

---

## 2. 协议变更（breaking change 区）

### 2.1 新增字段

```ts
export interface WebsitePackage {
  // ... 既有 12 个字段
  /**
   * 交互采集结果（Sprint 2 产出）。
   *
   * **可选**：采集需要真实浏览器，可能失败、超时或被显式关闭。
   * 下游 Agent 必须容忍 `undefined`，不得假设它一定存在。
   */
  interaction?: InteractionPackage;
}
```

### 2.2 版本 bump

`WEBSITE_PACKAGE_VERSION` → **`1.1.0`**

新增可选字段属于 minor：老数据反序列化后该字段为 `undefined`，既有消费方不受影响。

### 2.3 `createEmptyPackage()` 的处理

**保持 `interaction: undefined`**，不要填 `createEmptyInteraction()`。

理由：formatter 的既有原则是「空段整体跳过，绝不让模型看到空占位符」
（`formatter.ts:38-40`：*the model never sees "empty placeholders" it might try
to invent content for*）。填一个全空的 `InteractionPackage` 会让
`meta.capturedAt` 之类的假数据出现在提示词里，模型可能据此编造交互。

### 2.4 类型放在哪

`src/types/website-package.ts` 直接 `import type { InteractionPackage } from '@/lib/browser-intelligence/types'`。

刻意**不做**「把 InteractionPackage 抽到 `src/types/interaction.ts`」的重构：
纯 `import type` 编译后消失，不产生运行时依赖；为了分层洁癖去动一个已经
冻结的接口，风险大于收益。

---

## 3. 采集缓存（关键，决定这轮能不能上线）

`planning` / `code` / `animation` 三个 step 各调一次 `buildWebsitePackage`，
若不缓存就是三次浏览器采集（~90s），加上模型调用会顶穿 `maxDuration=300`。

新增 `src/lib/browser-intelligence/interaction-cache.ts`，与 `getScraped` 同构：

```ts
getInteractionPackage(url, options): Promise<InteractionPackage | null>
```

- 缓存 key = `${url}@${viewport.width}x${viewport.height}`（不同视口结果不同）
- TTL 10min / LRU 20（比 scrape 小 —— 单条体积远大于 scraped data）
- **永不抛错**，失败/超时返回 `null`，由调用方写 `degraded`
- 缓存**负面结果**（采集失败也缓存 60s），避免每个 step 都重试一次 30s

---

## 4. 开关策略

新增环境变量 `INTERACTION_CAPTURE`：

| 值 | 行为 |
|---|---|
| `off`（**默认**） | 完全不启动浏览器，`pkg.interaction` 保持 `undefined`，链路行为与今天完全一致 |
| `on` | 启用采集，三个 step 共享缓存（只采一次） |

**为什么默认 off**：

1. 一次生成最多 +30s，而 `maxDuration=300` 是硬约束；
2. 采集依赖本机 Chrome（`CHROME_PATH`），线上 Lighthouse 环境未验证；
3. 先灰度跑通再开默认，符合「零接触生产变更」的既定流程。

开关读取位置：`interaction-cache.ts` 内部，调用方无需感知。

---

## 5. 注入方式

### 5.1 formatter 新增一段

`formatter.ts` 加 `formatInteraction(pkg)`，`LIMITS` 增加：

```ts
clicks: 8,        // 最多 8 条点击（默认采集上限是 6）
interactionStates: 6,
```

输出形态（示意）：

```
## 原站交互采集结果（真实点击验证，非猜测）

点击过的元素：
- #globalnav-menubutton-link-store "Store menu" → 变化: 新增元素, 菜单显现, 位移 · 可动画属性: visibility, transform
- button.hds-button.hds-navigation-menu__trigger "解决方案" → 变化: 位移, 菜单显现 · 可动画属性: transform, visibility

无变化（点了没反应，不要为它编造动效）：
- button[data-base-ui-navigation-menu-trigger] "Product"
```

最后一段**必须保留**：Sprint 2 在 linear.app 上采到 3 个 `changed: false`，
明确告诉模型「这些没有动效」，比让它自由发挥更安全。

### 5.2 分 step 的注入粒度

| step | 注入 | 理由 |
|---|---|---|
| `animation` | **完整**（clicks + states + animations） | 主目标：GSAP 要绑定 trigger |
| `planning` | 精简（只要「哪些 selector 有交互状态」） | 让组件规划带上 `states: ['default','open']` |
| `code` | 精简（同 planning） | 生成 `onClick` handler |
| `vision` | 不注入 | 视觉分析不需要交互数据，省 token |

### 5.3 animation step 的具体接法

`formatAnimationContext(pkg)` 在既有「CSS 检测结果」之后追加一段
「交互触发的动效」，两条来源**并列呈现、不合并**：

```
## 原站动效检测结果（复刻依据，不得臆造）
- [transition] nav-menu → opacity · 0.3s · ease      ← 静态 CSS 解析

## 交互触发的动效（点击验证过）
- 点击 #globalnav-menubutton-link-store → visibility, transform   ← Sprint 2 实测
```

不合并的理由：`AnimationData` 描述「CSS 里写了什么」，`InteractionAnimation`
描述「点下去真的发生了什么」。两者可能矛盾（CSS 写了 transition 但点击无变化），
合并会丢失这个信号。

---

## 6. 验收标准

| 层 | 标准 |
|---|---|
| 单测 | adapter 传入 interaction → `pkg.interaction` 正确写入；不传 → `undefined` |
| 单测 | `createEmptyPackage().interaction === undefined` |
| 单测 | formatter：有 interaction 渲染出段落；无 interaction 整段跳过（不留空标题） |
| 单测 | 缓存：二次调用命中不重复采集；失败被负缓存；TTL 过期重采 |
| 门禁 | vitest / tsc / eslint / next build 四道全绿 |
| 真机 | `INTERACTION_CAPTURE=on` 跑一次完整生成，animation step 的 prompt 里出现「交互触发的动效」段 |
| 回归 | `INTERACTION_CAPTURE=off`（默认）时，产物与当前线上**逐字一致** |

---

## 6.1 真机实测结果（apple / linear / stripe）

命令：`npm run verify:sprint3 -- <url>`（三站点注入检查）+ `--with-llm`（真实模型调用）。

| 站点 | 采集耗时 | clicks | 有效（有变化） | planning 交互段 | code 交互段 | animation 交互段 | 回归（off 时） |
|---|---|---|---|---|---|---|---|
| apple.com | 18.9s | 6 | **6** | ✅ 命中 | ✅ 命中 | ✅ 命中 | ✅ 干净 |
| linear.app | 26.1s | 6 | **3** | ✅ 命中 | ✅ 命中 | ✅ 命中 | ✅ 干净 |
| stripe.com | 23.1s | 6 | **6** | ✅ 命中 | ✅ 命中 | ✅ 命中 | ✅ 干净 |

> linear 只有 3/6 是**真实数据**，不是缺陷：它的导航菜单由 hover 触发，
> 点击不产生状态变化，Sprint 2 已明确不做 hover。

### 6.2 对照实验：以前 vs 现在（决定性证据）

同一站点（apple.com）、同一模型、同一 prompt 模板，唯一变量是
`INTERACTION_CAPTURE` 的开关：

| | baseline（**不采集**，＝以前） | 现在（**采集** interaction） |
|---|---|---|
| 产物长度 | 2129 字符 | 4439 字符 |
| 选择器来源 | `[data-opacity-transition]`、`[data-height-transition]`…<br>**模型臆造的 data 属性，原站并不存在** | `#globalnav-menubutton-link-store` → `.store-menu`<br>**采集器真实抓到的 selector** |
| 交互行为 | **0 个 click 绑定**，只有入场/淡入时间线 | `button.addEventListener('click', …)`<br>+ `hideAllMenus()` / `showMenu()` 完整 dropdown 开合 |
| 语义层级 | 复刻 CSS transition 的**数值** | 复刻「点 Store → 菜单展开」这个**行为** |

开启采集后的产物逐条使用了采集结果，且精确反映了采集到的差异：

```js
{ button: '#globalnav-menubutton-link-store', menu: '.store-menu', hasTransform: true },
{ button: '#globalnav-menubutton-link-mac',   menu: '.mac-menu',   hasTransform: false },
```

`hasTransform: false` 对应 Mac 菜单**只采到 `visibility`、没采到 `transform`**——
说明模型是在逐条读采集数据，而不是套模板。

> 这就是本轮验收的核心命题：**以前是「按钮存在」，现在是「按钮行为存在」**。

### 6.3 真机过程中发现并修复的 6 个问题

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| A | `y 708→708` 自相矛盾 | `state-diff.ts` 无条件输出 y 轴，只变 x 时写出无意义串，AI 会误判有 y 方向动画 | `position` 只报真正动了的轴 |
| B | stripe 的 `target.text` 抓到整张卡片上百字 | 候选元素取的是整块 card 的 textContent，占大量 token | `shortText()` 截断到 24 字 |
| C | 回归检查恒真 | 脚本拿「带采集」的 planning 自比，当然有交互 | 改为对照组 `pkgOff` 的三个 prompt |
| D | 交互段截取命中了 CSS 段 | 正则含「动效检测」，优先级高于交互段 | 只匹配「交互 / 冲突信号 / 需要多状态」 |
| E | `--with-llm` 静默跳过 | 裸 node 不加载 `.env`（Next.js 才会自动加载） | 脚本加 `loadEnv()` |
| F | 模型返回 200 但 0 字符 | 该模型输出 `reasoning_content`，`max_tokens: 4096` 被思考吃掉 | `max_tokens` → 16384，模型用项目默认 `mimo-v2.5` |

---

## 7. 明确不做

- **duration / easing 测量**：需要连续帧采样，本轮 `InteractionAnimation`
  的 `duration` / `easing` 仍留空，GSAP 侧继续用 CSS 解析到的值。
- **hover**：Sprint 2 已明确不做，Sprint 3 不补。
- **把 `InteractionAnimation` 合并进 `AnimationData`**：见 §5.3。
- **默认开启采集**：见 §4。
- **改动任何 Agent 的 system prompt**：本轮只加 user message 的数据段落，
  不动 `SYSTEM_PROMPTS`（改 prompt 是另一个风险维度，单独一轮做）。

---

## 8. 三个决策点（已确认，按推荐方案执行）

| # | 问题 | 决策 | 理由 |
|---|---|---|---|
| 1 | `INTERACTION_CAPTURE` 默认 off 还是 on？ | ✅ **off** | 见 §4 |
| 2 | 版本 bump 到 `1.1.0` 是否接受？ | ✅ **是** | 加可选字段 = minor |
| 3 | interaction 是否也注入 `vision` step？ | ✅ **不注入** | 省 token，视觉分析用不上 |

> 字段名说明：需求里写作 `schemaVersion`，实际沿用现有字段
> `WEBSITE_PACKAGE_VERSION`（写入 `WebsitePackage.version`），不新增字段。
