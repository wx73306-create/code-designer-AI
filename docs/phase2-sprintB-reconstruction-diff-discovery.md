# Phase 2 / Sprint B — Reconstruction Diff：DISCOVERY 报告

> **状态：READ-only 侦察完成，未改动任何生产代码。**
> 上游：`docs/phase2-visual-accuracy-discovery.md`（Phase 2 总侦察）
> 　　`docs/phase2-sprintA-layout-ground-truth-design.md`（Sprint A，已完成并打 tag）
>
> Sprint A 解决了「**真值**」（布局数字不再是假的）。
> Sprint B 要解决「**度量**」——系统至今不知道生成页面**像不像**原站。

---

## 0. 一句话结论

**产品意图里早就设计了「相似度对比」，但实现层面它从未真正工作过。**

类型定义写着 `similarity: number // 0-100 percentage`，UI 设计了原图/克隆图/叠图三张对比图，
但：相似度被赋成了质量分、三张图是死路径、QA Agent 从未看过任何一张截图。

---

## 1. 侦察范围

| 对象 | 目的 |
|---|---|
| `src/store/use-workflow.ts` | QA 结果如何组装、截图传给哪些 step |
| `src/types/agent.ts` | `QAResult` 的契约语义 |
| `src/lib/preview-utils.ts` `buildPreviewHtml()` | 生成的 HTML 能否被服务端渲染 |
| `src/app/api/screenshot/route.ts` | 截图能力边界 |
| `src/app/api/mimo/route.ts` | qa step 的注入情况 |
| `public/screenshots/` | 对比图是否真的存在 |

---

## 2. 既有资产（产品意图已经在了）

| 资产 | 位置 | 说明 |
|---|---|---|
| **`QAResult.similarity`** | `types/agent.ts:175` | 注释明写 `// 0-100 percentage` |
| **`QAResult.screenshots`** | `types/agent.ts:177+` | 契约含 `original` / `clone` / `overlay` 三张图 |
| 原站截图 | `/api/screenshot` → `heroBase64` | 前端已持有，传给 vision / code / preview |
| 生成页 HTML | `buildPreviewHtml()` | 前端已用 `<iframe srcDoc>` 渲染，说明可渲染 |
| 浏览器能力 | `puppeteer-core 25.4.0` | 探测、并发槽、缓存已实现 |

**结论：不需要重新定义产品目标，只需要把已有的契约兑现。**

---

## 3. 三处断裂（代码级证据）

### 3.1 🔴 `similarity` 名不副实 —— 赋的是质量分，不是相似度

`use-workflow.ts:1266`：

```ts
qaResult: {
  similarity: visualScore.overall_score,   // ← 关键
  ...
}
```

而 `types/agent.ts:175` 的契约是：

```ts
similarity: number; // 0-100 percentage
```

`visualScore.overall_score` 是什么？是 `visual-evaluation/scoring.ts` 里六维的加权合成：

| 维度 | 权重 |
|---|---|
| premium_score 高级感 | 20% |
| layout_score 布局 | 20% |
| visual_balance / spacing / color / typography | 各 15% |

**这六个维度回答的都是「这个页面好不好看」，没有一个是「像不像原站」。**

后果很直接：一个**好看但完全不像**的页面会拿到高分。
`similarity` 这个字段因此从产品语义上讲是**错的**。

### 3.2 🔴 三张对比图是死路径 —— UI 的对比功能是空壳

`use-workflow.ts:1265-1269`：

```ts
screenshots: {
  original: '/screenshots/original.png',
  clone:    '/screenshots/clone.png',
  overlay:  '/screenshots/overlay.png',
},
```

**`public/screenshots/` 目录不存在。** 这三张图从未被生成过，路径是硬编码占位符。

### 3.3 🔴 QA 拿不到任何截图 —— 「视觉评分」评的是源码

两处独立证据：

**证据 A（前端）** —— `use-workflow.ts:1209`，`callMimoAPI` 的第 5 个参数 `screenshotBase64` 没传：

```ts
const qaResult = await callMimoAPI('qa', url, {
  previewHtml, designAnalysisSummary, designSystemSummary, round: 1,
}, generationId);          // ← 少了第 5 个参数
```

对比 vision / code / preview 三个 step 都传了：

```ts
callMimoAPI('vision',  url, {...}, generationId, websiteScreenshot);   // :632
callMimoAPI('code',    url, {...}, generationId, websiteScreenshot);   // :967
callMimoAPI('preview', url, {...}, generationId, websiteScreenshot);   // :1129
```

**证据 B（服务端）** —— `route.ts:1873`：

```ts
const useScreenshot = screenshotBase64 &&
  (step === 'vision' || step === 'code' || step === 'preview');
```

`qa` 不在其中。

两处都堵死，所以「视觉评分 Agent」**从未看过任何一张图**——它读的是
`previewHtml.slice(0, 12000)` 这段 HTML 源码文本（见 `visual-evaluation/prompt.ts:64`）。

> 系统提示词明写着「你的任务**不是**评价代码。你的任务是评价网页**视觉质量**。」
> 但输入是代码。这是自相矛盾。

---

## 4. 能力缺口（要补什么）

| 能力 | 现状 | 需要补 |
|---|---|---|
| 给生成的 HTML 截图 | ❌ `captureWebsiteScreenshots(url)` 只吃 URL；`/api/screenshot` 只收 `{url}` | 新增 `renderHtmlScreenshot(html)`（puppeteer `setContent`） |
| 像素 diff | ❌ 无 `pixelmatch` / `sharp` / `jimp` / `resemblejs` | 需新增依赖（**待批准**） |
| SSRF 防护复用 | ⚠️ `isBlockedUrl()` 是给 URL 的，对 HTML 内容不适用 | 新增能力时需区分，勿误用 |

### 4.1 ⚠️ 头号风险：`previewHtml` 不是自包含的

`buildPreviewHtml()` 产出的 HTML 里，CSS 与 JS 几乎全部内联，
**但有一个外部依赖**：

```html
<script src="https://cdn.tailwindcss.com"></script>
```

Tailwind 走 CDN 是**运行时 JIT**：浏览器加载脚本后扫描 DOM 才生成样式。

这意味着服务端渲染截图时：

1. **必须能访问外网**。CDN 不可达 → 所有 Tailwind class 失效 → 截图是无样式裸 HTML
   → 与真实预览**完全不符** → diff 结果毫无意义，而且会**误导**优化方向。
2. **必须等 JIT 编译完成**才能截图，否则截到的是样式未生效的中间态。

**这是 Sprint B 最大的不确定项**，必须先验证：服务端 puppeteer 能否稳定加载该 CDN。

候选应对方案：

| 方案 | 做法 | 代价 |
|---|---|---|
| A | 渲染时等 CDN，`waitUntil: networkidle2` + 固定等待 | 依赖外网；失败率不可控 |
| B | **检测降级**：截图前检查基础 class 是否生效，未生效则标记 degraded、不产出 clone 图 | 兜底，避免产出假对比 |
| C | 把 Tailwind 编译结果内联进 `previewHtml` | 彻底解决，但要改 `preview-utils.ts`（风险较大） |

**我的推荐：A + B 必须做，C 列为后续独立一轮。**
理由：B 是安全底线——宁可没有 clone 截图，也不能拿一张样式全丢的裸 HTML 去和原站比。

---

## 5. 三个必须先定的决策点

| # | 问题 | 选项 | 我的推荐 |
|---|---|---|---|
| 1 | **`similarity` 怎么办** | A. 改成真实的还原度分数<br>B. 保留质量分，另加 `reconstructionScore` 字段<br>C. 两者都展示，UI 区分开 | **C** —— 质量分与还原度是两件事，混在一个字段里才是问题根源 |
| 2 | **对比口径** | A. 结构化 diff（section 序列 / 高度占比 / 列数 / 主色分布）<br>B. 像素 diff（需引入 `pixelmatch`）<br>C. 先 A 后 B | **先 A** —— 零新依赖、可解释、能定位到具体区块；像素 diff 无法告诉你「哪个区块差了」 |
| 3 | **三张对比图** | A. 真实生成 original / clone / overlay<br>B. 只生成 original + clone，去掉 overlay | **先 B** —— overlay 需要像素级叠图，依赖决策 2 选 B |

### 5.1 关于成本

- 渲染一次生成页截图：约 **2–4s**（含 Tailwind CDN 加载）
- 结构化 diff：纯计算，**毫秒级**
- 总计对单次生成增加约 2–4s，`maxDuration = 300` 下有充足余量

---

## 6. 建议的 Sprint B 拆分（**草案，待拍板**）

### B1 — 让 `similarity` 名副其实（零新依赖）

1. 新增 `renderHtmlScreenshot(html)`：`setContent` + 等 Tailwind 就绪 + **样式生效检测**，失败标记 degraded
2. 新增 `computeReconstructionScore(origin, clone)`：结构化对比，产出可解释的分数
3. qa step 注入两张图（原站截图 + 生成页截图）—— **补上遗漏的截图注入**
4. `similarity` 改用还原度分数；质量分保留在 `visualScore`，两者不再混用
5. 三张图真实落盘（先做 original + clone）

验收：同一站点两次生成分数稳定；**人为改动布局后分数显著下降**（证明指标真的在度量还原度，而不是在度量美观）。

### B2 — 像素级 diff（**仅在决策 2 选 B 后做**）

引入 `pixelmatch`，产出 overlay 叠图与像素差异率。

---

## 7. 明确不做

- **不改六维评分的权重**（产品口味，不是还原度）
- **不改 `SYSTEM_PROMPTS`**（改 prompt 是另一个风险维度，单独一轮）
- **不追求像素级 1:1**（那是图像复制，不是「理解 → 重建」）
- **不碰 interaction 相关**（Sprint 3 已冻结）
- **不碰 `visual-evaluation/scoring.ts`**（只在其之上加还原度，不改既有模型）

---

## 8. 本轮产生的临时物

无 —— 本轮为纯 READ-only 侦察，未新增或修改任何文件。

---

## CHECKPOINT — 等待拍板

**DISCOVERY 完成，未改动任何生产代码。**

需要你确认：

1. **`similarity` 的处理**：改成还原度 / 另开字段 / 两者并存（我推荐并存并分开展示）？
2. **对比口径**：先结构化 diff（零新依赖）还是直接上像素 diff（需引入 `pixelmatch`）？
3. **Sprint B 拆分**：B1（让 similarity 名副其实）→ B2（像素 diff）这个顺序是否认可？
4. **头号风险 `previewHtml` 依赖 Tailwind CDN** —— 是否接受「检测降级」作为底线
   （即：CDN 加载失败就不产出 clone 截图，而不是产出一张样式全丢的裸 HTML）？

拍板后我出 DESIGN 冻结文档（接口冻结 + allowed/forbidden 清单 + STOP-and-wait），
**仍然不写实现代码**。
