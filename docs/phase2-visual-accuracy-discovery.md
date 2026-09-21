# Phase 2 — Visual Reconstruction Accuracy：DISCOVERY 报告

> **状态：READ-only 侦察完成，设计未冻结，未改动任何生产代码。**
> 本文件只回答一个问题：**现在的「还原准确度」到底能不能被度量？**
> 结论是：不能。而且比「不能」更糟——链路里存在**假数据被当作真数据使用**。

---

## 0. 为什么要先做侦察

Phase 1 三个 Sprint 解决了「能不能看到网页 / 能不能理解交互 / Agent 用不用得上」。
但回到产品核心价值「从网页理解 → 高保真重建」，有一个从未被回答的问题：

> **生成的页面，跟原网站到底有多像？**

现在的系统**没有任何一环在度量这件事**。本轮侦察就是要确认：缺口在哪、要补什么、代价多大。

---

## 1. 侦察范围（READ-only）

| 对象 | 目的 |
|---|---|
| `src/lib/visual-evaluation/`（6 文件 659 行） | 已有的视觉评分是否可用、是否接入 |
| `src/app/api/mimo/route.ts` | 评分在真实链路里的接线方式与输入 |
| `src/lib/website-package/adapter.ts` | 布局数据是怎么算出来的 |
| `src/types/website-package.ts` | 布局 / 截图契约是否齐备 |
| `src/lib/screenshot.ts` | 有没有「给生成的 HTML 截图」的能力 |
| `package.json` | 有没有图像对比库 |
| 真机跑 3 个站点 | 验证 `layout.flow` 的真实输出 |

---

## 2. 既有资产盘点（**不要重复造轮子**）

### 2.1 六维视觉评分模型：已存在且已接入

`src/lib/visual-evaluation/`：

| 文件 | 行数 | 职责 |
|---|---|---|
| `scoring.ts` | 98 | 权重、总分、优化阈值、决策 |
| `schema.ts` | 76 | AI 返回值的规范化（含 clamp / 兜底默认值） |
| `prompt.ts` | 123 | 评分 Prompt + 优化方案 Prompt |
| `plan.ts` | 168 | 优化方案规范化 |
| `plan.test.ts` | 168 | 单测 |
| `index.ts` | 26 | 导出 |

权重（合计 100%）：

| 维度 | 权重 | 触发优化阈值 |
|---|---|---|
| `premium_score` 高级感 ⭐ | 20% | < 80 |
| `layout_score` 布局 | 20% | < 75 |
| `visual_balance` 视觉平衡 | 15% | — |
| `spacing_score` 空间留白 | 15% | — |
| `color_score` 色彩 | 15% | < 75 |
| `typography_score` 字体 | 15% | < 80 |

- `OVERALL_PASS_THRESHOLD = 90`，`MAX_OPTIMIZATION_ROUNDS = 3`
- **已接入真实链路**：`route.ts:15` import，`1685` 评分、`1690` 优化方案
- **不是死代码**（此前 `src/legacy/` 归档过死代码，本轮已核实接入）

### 2.2 布局契约已定义好，不用改协议

`LayoutAnalysis` / `LayoutBlock`（`types/website-package.ts:170-197`）已经具备：
`flow[]`（role / heightWeight / columns / alignment / fullBleed）、`breakpoints`、
`gridColumns`、`gap`、`stickyHeader`、`centered`。

**字段设计是对的，问题在于值是假的**（见 §3.1）。

### 2.3 其他可复用资产

- `puppeteer-core ^25.4.0`：浏览器探测、并发槽（max 2）、截图缓存已实现
- 前端已能把生成 HTML 渲染出来：`<iframe srcDoc={previewHtml}>`
  （`code-section.tsx:353`、`qa-section.tsx:224/649`）

---

## 3. 三处缺口（按严重度排序）

### 3.1 🔴 布局 ground truth 是硬编码常量 —— 假数据被当真数据用

`adapter.ts:373-412` `buildFlow()`：

```ts
// 用正则在 HTML 里猜有哪些 section
if (/<nav|navigation/i.test(html)) roles.push('nav');
if (/(hero|banner|jumbotron)/i.test(...)) roles.push('hero');
...
// 然后用硬编码常量表算高度占比
const canonical = { nav:4, hero:26, feature:20, product:16,
                    pricing:14, testimonial:10, cta:8, footer:10 };
columns:   role === 'feature' || 'pricing' || 'product' ? 3 : 1,
alignment: role === 'hero' || 'cta' ? 'center' : 'left',
fullBleed: role === 'hero' || 'footer' || 'cta',
```

**真机验证（3 个站点，`scripts/recon-layout.ts`）**：

| 站点 | `layout.flow` 实际输出 |
|---|---|
| apple.com | `[]` —— **空数组** |
| stripe.com | `nav 9% · hero 57% · product 35%` |
| linear.app | `nav 100%` |

这些数字与真实页面几何**毫无关系**（`hero 57%` 是 `26/(4+26+16)` 归一化算出来的；
`nav 100%` 是因为只匹配到 `<nav>` 一个角色）。

**为什么这比「没有布局信息」更糟**：

`formatter.ts:160-165` 把这些数字以权威语气喂给 Agent：

```
  - hero: 26% · 1列 · center 对齐 · 通栏
```

模型会**当真**，并按错误比例生成。而 Apple 的情况是 `[]` → `if (pkg.layout?.flow?.length)`
为假 → 整段跳过 → Agent 完全拿不到布局信息。有时是错的，有时是空的。

> 字段注释写着「避免生成『每个区块一样高』的模板感」，意图正确，
> 但实现本身就是模板。

### 3.2 🔴 评分是「绝对分」，不是「相似度」

现在的评分回答的是：**这个页面好不好看。**
产品需要的是：**这个页面像不像原网站。**

链路里**没有任何一步**把「生成页」与「原站」放在一起比对。
六维评分里也没有「还原度 / 一致性」这个维度。

### 3.3 🟠 QA 评的是代码，不是视觉

`prompt.ts:14-19` 系统提示明写：

> 你的任务**不是评价代码**。你的任务是评价网页**视觉质量**。

但 `prompt.ts:64` 喂进去的是：

```ts
msg += `## 网页渲染结果（HTML 结构）\n${previewHtml.slice(0, 12000)}\n`
```

**HTML 源码文本，不是渲染截图。**

原因在 `route.ts:1845`：

```ts
const useScreenshot = screenshotBase64 &&
  (step === 'vision' || step === 'code' || step === 'preview');
```

**截图注入只覆盖 `vision` / `code` / `preview`，`qa` 不在其中。**

所以「视觉评分 Agent」从头到尾没看过一眼视觉，它在**读代码想象画面**。

---

## 4. 能力缺口（要补什么）

| 能力 | 现状 | 需要补 |
|---|---|---|
| 给生成的 HTML 字符串截图 | ❌ `captureWebsiteScreenshots(url)` 只吃 URL，无 `setContent` | 新增 `renderHtmlScreenshot(html)` |
| 两张图做像素 diff | ❌ 无 `pixelmatch` / `sharp` / `jimp` / `resemblejs` | 需新增依赖（待批准） |
| 真实几何测量 | ❌ scraper 不开浏览器，无 `getBoundingClientRect` | 需浏览器采集 |
| SSRF 防护复用 | ⚠️ `isBlockedUrl()` 是给 URL 的，对 HTML 内容不适用 | 新增能力时需区分，勿误用 |

---

## 5. 三个必须先定的决策点

| # | 问题 | 选项 | 我的推荐 |
|---|---|---|---|
| 1 | **度量口径** | A. 客观指标（几何/色彩相似度）<br>B. AI 对比式评分（同给原站+生成页截图，评相似度）<br>C. 两者都要 | **C，但先做 A**<br>客观指标是地基，B 依赖它才有对照 |
| 2 | **布局真值从哪来** | A. 新建浏览器采集（实测 `getBoundingClientRect`）<br>B. 继续用正则猜测<br>C. 交给 Vision Agent 从截图里读 | **A**<br>B 已被证伪，C 会引入模型不稳定性 |
| 3 | **要不要像素级 diff** | A. 引入 `pixelmatch` 做像素 diff<br>B. 只做结构化 diff（高度占比/列数/主色分布） | **先 B 后 A**<br>B 零新依赖、可解释、能定位到具体区块 |

### 5.1 关于决策 2 的成本（必须提前知道）

真实几何采集需要开浏览器，约 **20s**（Phase 1 实测：apple 18.9s / linear 26.1s / stripe 23.1s）。
而 `maxDuration = 300`（5 分钟）是硬约束，且 planning/code/animation 已各调一次采集。

**建议**：与 `INTERACTION_CAPTURE` 共用同一次浏览器会话，或独立开关 `LAYOUT_PROBE`（默认 off）。
具体方案在 DESIGN 阶段定。

---

## 6. 建议的 Phase 拆分（**草案，待拍板**）

### Sprint A — Layout Ground Truth

把 `layout.flow` 从「硬编码常量」换成「浏览器实测几何」：

- 新增 `src/lib/browser-intelligence/layout-probe.ts`
- 实测：每个 section 的真实高度占比、列数、对齐、是否通栏、容器 max-width
- 沿用现有 `LayoutBlock` 契约，**不改协议**
- 空值语义沿用 Sprint 3 定下的原则：**测不到就 `[]`，不填假数据**

验收：三个站点的 `layout.flow` 与人工观察一致（不再出现 `nav 100%` / `hero 57%`）。

### Sprint B — Reconstruction Diff

建立「生成页 vs 原站」的客观对比：

- 新增 `renderHtmlScreenshot(html)`（puppeteer `setContent`）
- 结构化 diff：section 序列、高度占比、列数、主色分布
- 产出 `reconstructionScore`（可解释：哪个区块差多少）
- 把 `qa` step 的截图注入打开（当前遗漏，见 §3.3）

验收：同一站点两次生成的分数稳定；人为改动布局后分数显著下降（证明指标有效）。

---

## 7. 明确不做（本 Phase 边界）

- **不改六维评分的权重**（那是产品口味，不是还原度）
- **不做 hover / 滚动动效的还原度量**（Phase 1 已定不做 hover）
- **不引入新依赖**，除非决策 3 明确选 A
- **不改动 `SYSTEM_PROMPTS`**（改 prompt 是另一个风险维度，单独一轮）
- **不追求像素级 1:1**（那是图像复制，不是「理解 → 重建」）

---

## 8. 本轮产生的临时物（未提交，可删）

| 文件 | 用途 |
|---|---|
| `scripts/recon-layout.ts` | 侦察脚本，打印 3 站点的 `layout.flow` |
| `.recon-layout.log` | 上表证据的原始输出 |
| `.recon-build.log` | esbuild 打包日志 |

均为 READ-only 侦察产物，未写入任何生产文件。

---

## CHECKPOINT — 等待拍板

**DISCOVERY 阶段结束。本轮未改动任何生产代码。**

需要你确认三件事，我才进入 DESIGN 冻结：

1. **度量口径**：A（客观）/ B（AI 对比式）/ C（先 A 后 B）？
2. **布局真值**：是否接受「新增一次浏览器采集（约 20s）」来换真实几何？
3. **Phase 拆分**：Sprint A（布局真值）→ Sprint B（还原度量）这个顺序是否认可？

拍板后我出 DESIGN 文档（含接口冻结、allowed/forbidden 文件清单、STOP-and-wait 检查点），
**仍然不写实现代码**。
