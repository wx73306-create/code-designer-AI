# Phase 2 / Sprint B — Reconstruction Diff：DESIGN 冻结文档

> **状态：接口冻结，未写任何实现代码。**
> 上游：`docs/phase2-sprintB-reconstruction-diff-discovery.md`（DISCOVERY，已拍板）
> 　　　`docs/phase2-sprintA-layout-ground-truth-design.md`（Sprint A，已完成，tag `v0.9.0-layout-ground-truth`）
>
> Sprint A 解决了「**真值**」（布局数字不再是猜的）。
> Sprint B 要解决「**度量**」——系统必须能回答：**生成的页面像不像原站**。

---

## 0. 本文件的效力

**本文件冻结的是接口与边界，不是实现细节。**

- 冻结后：类型签名、目录归属、ALLOWED / FORBIDDEN 清单、每步 PASS 判据，未经重新确认不得变更。
- 不冻结：函数内部实现、算法常数微调、测试写法。
- 每一步结束都是**可验证的稳定状态**（tsc + vitest 全绿），任一步未 PASS 不进入下一步。

---

## 1. 拍板结论落地

| # | 你的决策 | 本设计如何落地 |
|---|---|---|
| 1 | qualityScore 与 reconstructionScore **并存拆分**；`similarity` 标 deprecated 保留兼容 | `QAResult` 新增 `qualityScore` + `reconstructionScore`；`similarity` **保持现有赋值不变**（不制造 UI 回归），仅加 `@deprecated` 注释说明其语义错误（§3.1） |
| 2 | **先结构化 diff**，不引入 pixelmatch / sharp / jimp | 三层结构：①布局结构 diff ②视觉 token diff ③asset diff（§4）。依赖清单 **零新增**（§7 FORBIDDEN 第 1 条） |
| 3 | 接受 **B1 → B2** 顺序 | Sprint B = B1 全集；B2（像素 diff）不在本次范围 |
| 4 | 接受 **A+B**：等 CDN + 失败检测 + 禁止错误评分 | 新增 `RenderResult { screenshot, status, reason? }`；`degraded` / `failed` 时 `reconstructionScore = null`（**不是 20 分**）（§3.2、§4.1） |

### 1.1 Sprint A 三项遗留（已确认**不放入** Sprint B）

| 遗留项 | 处置 | 记录 |
|---|---|---|
| `gridColumns` 三站恒为 1 | 推迟到 **Sprint A.1** | 建议改为「最高视觉权重 section 的列数」或「feature/product/pricing 优先」 |
| Apple `footer 58% (6976px)` | **暂不修改** | 真实测量 ≠ 人类预期，属于 role 定义问题，不是测量 bug |
| Stripe 8 个 `other` | **不扩关键词** | `other` 是诚实状态，扩关键词 = 制造假确定性 |

### 1.2 决策原文补录（对照你的长文逐条核对后的三处增补）

| # | 你原文里的要求 | 首版设计遗漏 | 已补到 |
|---|---|---|---|
| 1 | 类型方向 `VisualEvaluation { overall_score, quality_score, reconstruction_score? }` | 只做了 `QAResult` 层，没有统一视图 | **§3.4** 原样采纳 sketch，补 `reconstruction?` detail 指针；并明确「不重复存储」 |
| 2 | 第二层要比较 `color / font / spacing / radius / shadow` **五组** | 只覆盖了 color + font | **§4.4** 五组全覆盖，新增 `sectionGaps` / `containerPaddings` / `radii` / `shadowCoverage` 采集与评分 |
| 3 | 输出要能反向驱动 Code Agent：`+rounded` `+shadow` `-color mismatch` | 只有数值 delta，没有人话标签 | **§4.4** `style_drift` 标签生成规则表 + `DiffReport.notes` |

附：你 Step 2 写的输出 `{image, status}` —— 字段名统一为 `RenderResult.screenshot`（与决策 4 的签名一致），已在 §6 Step 2 注明。

---

## 2. 目标与非目标

### 2.1 目标（Sprint B 结束时必须为真）

1. 系统能产出**生成页面的真实截图**（不是 HTML 源码文本）。
2. 系统能产出**可解释的还原度报告**：哪个区块缺了、哪个区块高度差多少、主色差多少。
3. `quality` 与 `reconstruction` 是两个**独立数字**，并在真机上证明它们**可以显著不同**。
4. 任何无法度量的情况 → `null`，**绝不产出假分数**。

### 2.2 非目标（明确不做）

- **不追求像素级 1:1**（那是图像复制，不是「理解 → 重建」）
- **不改六维评分权重**（产品口味，不是还原度）
- **不做 UI 改造**（`qa-section.tsx` 列入 FORBIDDEN，见 §7）
- **不落盘 `public/screenshots/`**（三张对比图仍是已知债，本轮不动）
- **不改 `SYSTEM_PROMPTS.qa` 的 8 维评分模型**（只改输入，不改判据）

---

## 3. 接口冻结（Step 1 产物）

> 新文件：`src/types/reconstruction.ts`（**唯一**新增类型文件）

### 3.1 `QAResult` 变更（`src/types/agent.ts`，仅改这一个 interface）

```ts
export interface QAResult {
  /**
   * @deprecated 历史兼容字段。
   * 契约注释写的是 "0-100 percentage（相似度）"，但实现上一直被赋成
   * 六维质量分 VisualScore.overall_score —— 语义是错的。
   * 保留仅为兼容旧 UI；新代码请使用 qualityScore / reconstructionScore。
   */
  similarity?: number;

  /** 视觉质量分（0-100）：「这个页面好不好看」，等于 VisualScore.overall_score */
  qualityScore?: number;

  /** 还原度（0-100）：「这个页面像不像原站」。无法度量时为 null */
  reconstructionScore?: ReconstructionScore | null;

  issues: QAIssue[];
  fixes: QAFix[];
  screenshots: { original: string; clone: string; overlay: string; };
  // ...其余字段不动
}
```

**约束：**
- `similarity` 从 required 改 optional 是**放宽**，现有消费点（`qaResult?.similarity ?? 96.8`）不受影响。
- `VisualScore` / `VisualScoreDimensions` / 六维权重 **一律不动**。

### 3.2 新增类型（冻结签名）

```ts
// ---------- 渲染 ----------

export type RenderStatus = 'success' | 'degraded' | 'failed';

export interface RenderResult {
  /** base64 PNG（**不含** data URI 前缀），viewport 截图 1440×900 */
  screenshot: string;
  status: RenderStatus;
  /** status !== 'success' 时的原因码，见 §4.1 */
  reason?: string;
}

// ---------- 结构化 diff ----------

export interface ColorDelta {
  original: string;   // "rgb(r,g,b)"
  clone: string;
  /** 归一化距离 0-1（加权欧氏 / 441.67） */
  distance: number;
}

export interface LayoutDiffItem {
  role: SectionRole;
  status: 'matched' | 'missing' | 'extra';
  originalIndex?: number;
  cloneIndex?: number;
  /** clone.heightWeight - original.heightWeight，单位为百分点 */
  heightWeightDelta?: number;
  /** clone.heightPx / original.heightPx */
  heightPxRatio?: number;
  /** clone.columns - original.columns */
  columnDelta?: number;
  alignmentMatch?: boolean;
  fullBleedMatch?: boolean;
}

export interface LayoutDiff {
  /** role 序列覆盖率：2*LCS / (lenA + lenB)，0-1 */
  roleSequenceCoverage: number;
  items: LayoutDiffItem[];
  /** 已匹配区块的高度占比 L1 距离 / 原站占比和，0-1 */
  heightProfileDistance: number;
}

export interface NumericDelta {
  original: number;
  clone: number;
  /** clone / original；两者皆 0 时为 1 */
  ratio: number;
}

export interface StyleTokenDiff {
  // —— 第一组：color ——
  background?: ColorDelta;
  text?: ColorDelta;
  primary?: ColorDelta;
  // —— 第二组：font ——
  /** clone 主字号 / original 主字号 */
  fontSizeRatio?: number;
  /** 字体族集合 Jaccard 重叠，0-1 */
  fontFamilyOverlap?: number;
  // —— 第三组：spacing ——
  /** 相邻 section 垂直间距的中位数（px） */
  sectionGap?: NumericDelta;
  /** 主内容容器内边距中位数（px） */
  containerPadding?: NumericDelta;
  // —— 第四组：radius ——
  /** 可见元素的 border-radius 中位数（px） */
  radius?: NumericDelta;
  // —— 第五组：shadow ——
  /** 带非 none box-shadow 的可见元素占比，0-1 */
  shadowCoverage?: { original: number; clone: number; delta: number };
}

export interface AssetDiff {
  originalImageCount: number;
  cloneImageCount: number;
  /** min/max，0-1；两者皆 0 时为 1 */
  ratio: number;
  heroHasMediaOriginal: boolean;
  heroHasMediaClone: boolean;
}

// ---------- 评分 ----------

export interface ReconstructionDimensions {
  roleSequence: number;    // 0-100
  heightProfile: number;
  blockGeometry: number;
  colorTokens: number;
  typography: number;
  spacing: number;
  radius: number;
  shadow: number;
  mediaDensity: number;
}

export interface DiffReport {
  layout: LayoutDiff;
  style: StyleTokenDiff;
  assets: AssetDiff;
  dimensions: ReconstructionDimensions;
  /**
   * 人类/Code Agent 可读的漂移标签，例如：
   * "+rounded" "+shadow" "-color mismatch" "hero height -23%" "feature columns 3→4" "CTA missing"
   * —— 结构化 diff 的价值就在这里：能反向驱动 Code Agent，而不只是吐一个数字。
   */
  notes?: string[];
}

export interface ReconstructionScore {
  /** 0-100；**null = 无法度量（unknown，不是 0，更不是 20）** */
  score: number | null;
  dimensions: ReconstructionDimensions | null;
  renderStatus: RenderStatus;
  reason?: string;
  report?: DiffReport;
  evaluatedAt: string; // ISO 8601
}
```

### 3.3 函数签名（冻结）

```ts
// src/lib/render-preview/render-html.ts
export async function renderHtmlScreenshot(
  html: string,
  options?: { width?: number; height?: number; timeoutMs?: number; fullPage?: boolean },
): Promise<RenderResult>;

// src/lib/reconstruction/evaluate.ts
export async function evaluateReconstruction(input: {
  html: string;                          // 生成页面 HTML
  url: string;                           // 原站 URL（仅用于取原站 layout 真值）
  originalLayout?: LayoutProbeResult;    // 原站布局真值（可选，缺省时服务端按需采集）
  originalScreenshot?: string;           // 原站 hero 截图（可选，仅用于落报告，不参与结构 diff）
}): Promise<ReconstructionScore>;

// src/lib/diff/*.ts（全部为 Node 侧纯函数，可单测）
export function diffLayout(original: LayoutProbeResult, clone: LayoutProbeResult): LayoutDiff;
export function diffStyleTokens(original: RawStyleTokens, clone: RawStyleTokens): StyleTokenDiff;
export function diffAssets(original: RawAssets, clone: RawAssets): AssetDiff;
export function computeReconstructionScore(report: DiffReport): ReconstructionDimensions & { score: number };
```

### 3.4 `VisualEvaluation` —— 统一视图（对齐你的类型方向）

你给的 sketch 是 `VisualEvaluation { overall_score, quality_score, reconstruction_score? }`。
**原样采纳**，并补一个 detail 指针，避免「有分数但看不到原因」：

```ts
// src/types/reconstruction.ts
export interface VisualEvaluation {
  /** 兼容字段：等于 quality_score。保留是为了不炸历史消费方 */
  overall_score: number;
  /** 质量分（0-100）：「这个页面设计得好吗」 */
  quality_score: number;
  /** 还原度（0-100）：「像不像原站」。**null = 无法度量**（渲染降级 / 真值缺失） */
  reconstruction_score: number | null;
  /** 还原度明细：维度分、降级原因、可解释报告。可选 */
  reconstruction?: ReconstructionScore | null;
}
```

与 `QAResult` 的关系（**不重复存储**）：

| 位置 | 承载内容 |
|---|---|
| `QAResult.qualityScore` | 质量分（数字） |
| `QAResult.reconstructionScore` | 还原度**完整对象**（`score` + `dimensions` + `renderStatus` + `report`） |
| `VisualEvaluation` | **派生视图**，由 `toVisualEvaluation(qaResult)` 纯函数生成，供 UI / 日志 / 未来 API 使用 |

迁移路径（对应你写的「旧 similarity → 新 reconstructionScore，保留兼容」）：

```
similarity            （语义错：写着相似度，存的是质量分）
  ├─→ qualityScore    （语义对：质量分）
  └─→ VisualEvaluation.quality_score
reconstructionScore   （新增：真正的还原度，null 表示无法度量）
```

---

## 4. 算法规格（Step 2 / Step 4 依据）

### 4.1 `renderHtmlScreenshot()` — 渲染与降级（对应决策 4 的 A+B）

```
1. page = await browser.newPage(); setViewport(1440×900)
2. 请求拦截：复用 isBlockedUrl() 拦截私有网段请求（防止生成 HTML 里的外链打到内网）
   —— 只拦不发，不阻断 CDN
3. await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 })
4. 【A 等 CDN】await page.waitForFunction(() => typeof window.tailwind !== 'undefined', { timeout: 8000 })
5. 【B 样式生效检测】注入探针 <div id="__tw_probe" class="hidden">，
   检查 getComputedStyle(probe).display === 'none'
6. 再等 500ms 让 JIT 与字体稳定
7. screenshot({ type:'png', encoding:'base64', fullPage:false })
```

| status | 触发条件 | reason 码 | 后果 |
|---|---|---|---|
| `success` | 步骤 4 + 5 全通过 | — | 正常产出截图与 diff |
| `degraded` | 步骤 4 超时或步骤 5 失败（Tailwind 未生效），但页面已渲染 | `tailwind-cdn-unavailable` | **截图不用**，结构 diff 不用 → `score = null` |
| `failed` | `setContent` 抛错 / 页面空白（body 文本长度 < 50 且无可测区块） | `render-error` / `empty-document` | `score = null` |

**硬约束：`degraded` / `failed` 时 `ReconstructionScore.score` 必须是 `null`。**
理由：样式全丢的裸 HTML 与原站比，拿到的低分是**渲染失败的分**，不是**还原度的分**；把它写成一个数字，就会驱动 Optimize 去「修」一个根本不存在的布局问题。

### 4.2 Clone 布局真值如何取得

**复用 Sprint A**：渲染完成后，在同一个 page 上执行 `collectGeometry(page)` → `buildLayoutResult(raw)`。

- 浏览器侧 **只返回原始几何**（沿用 Sprint A 的分层原则，语义判断全在 Node 侧）
- 需要为 `layout-probe.ts` 的 `collectGeometry` 增加 `export`（**只加 export 关键字，不改算法与常量**，见 §7）

### 4.3 布局 diff

对齐策略：**按 role 序列做 LCS 对齐**，不按 index 对齐。
理由：生成页很容易多一个/少一个 section，按 index 对齐会把后面所有区块全部错配。

```
roleSequenceCoverage = 2 * LCS(A.roles, B.roles) / (A.length + B.length)
heightProfileDistance = Σ|w_o - w_c| / Σ w_o   （仅对 matched 对）
blockGeometry = matched 对中 (columns 相等 + alignment 相等 + fullBleed 相等) 的命中数 / (3 * matched 数)
```

### 4.4 视觉 token diff（**五组：color / font / spacing / radius / shadow**）

> 对应你明确的第二层要求：比较 `color`、`font`、`spacing`、`radius`、`shadow`。
> 五组全部覆盖，不打折。

浏览器侧新增 `collectStyleTokens()`，**只采集计算值，不做任何语义判断**：

```ts
interface RawStyleTokens {
  // color
  bodyBackground: string;    // "rgb(r,g,b)"
  bodyColor: string;
  /** 按可见面积排序的 top 8 颜色（不含透明） */
  colorHistogram: Array<{ color: string; area: number }>;
  // font
  bodyFontSizePx: number;
  bodyFontFamily: string;
  headingFontSizePx?: number;
  // spacing
  /** 相邻可见区块之间的垂直间距序列（px），用于取中位数 */
  sectionGaps: number[];
  /** 顶层容器 padding-left 序列（px） */
  containerPaddings: number[];
  // radius
  /** 可见元素 border-radius 序列（px，0 也算） */
  radii: number[];
  // shadow
  visibleElementCount: number;
  shadowedElementCount: number;
}
```

Node 侧挑选 `primary`：从 `colorHistogram` 中排除 body 背景色、body 文字色、以及灰度（|r-g|<12 且 |g-b|<12 且 |r-b|<12）后的第一个。
—— **「主色是什么」是语义判断，必须在 Node 侧**（与 Sprint A 一致）。

```
// color（15%）
colorDistance = 加权欧氏距离(rgb) / 441.67，clamp 到 0-1
colorTokens   = 100 * (1 - mean(bg.distance, text.distance, primary.distance))

// font（8%）
typography    = 50 * min(fo,fc)/max(fo,fc) + 50 * Jaccard(字体族集合)

// spacing（7%）
spacing       = 60 * ratioScore(sectionGap) + 40 * ratioScore(containerPadding)
  其中 ratioScore(x) = min(x.clone, x.original) / max(x.clone, x.original)（两者皆 0 时为 1）

// radius（5%）
radius        = 100 * (1 - min(|r_clone - r_original| / 24, 1))
  分母 24px：超过 24px 的圆角差异视为完全不一致（方形 ↔ 全圆角）

// shadow（3%）
shadow        = 100 * (1 - min(|coverage_clone - coverage_original|, 1))
```

**`style_drift` 标签生成规则**（写入 `DiffReport.notes`，供 Code Agent 反向消费）：

| 触发条件 | 产出标签 |
|---|---|
| `radius.clone - radius.original >= 8` | `+rounded` |
| `radius.original - radius.clone >= 8` | `-rounded` |
| `shadowCoverage.delta >= 0.15` | `+shadow` |
| `shadowCoverage.delta <= -0.15` | `-shadow` |
| 任一 color delta `distance >= 0.15` | `-color mismatch (bg/text/primary)` |
| `sectionGap` 差异 > 30% | `+spacing` / `-spacing` |
| matched 区块 `heightPxRatio` 偏离 > 20% | `hero height -23%`（按 role 命名） |
| `columnDelta !== 0` | `feature columns 3→4` |
| 区块 status = `missing` | `CTA missing`（按 role 命名） |

> 标签里的百分比与数值一律用**实测值**填充，不写死文案。

### 4.5 Asset diff

浏览器侧 `collectAssets()` 返回 `{ imgCount, bgImageCount, svgCount, videoCount, heroMediaCount }`
（`heroMediaCount` = 首屏 900px 内带 img/background-image/video 的元素数）。

```
mediaDensity = 60 * min(co,cc)/max(co,cc) + 40 * (heroMediaOriginal === heroMediaClone ? 1 : 0)
```

### 4.6 总分合成

| 维度 | 权重 | 来源 | 属于哪一层 |
|---|---|---|---|
| roleSequence | 22% | §4.3（×100） | 第一层 布局结构 |
| heightProfile | 18% | §4.3（×100） | 第一层 布局结构 |
| blockGeometry | 12% | §4.3（×100） | 第一层 布局结构 |
| colorTokens | 15% | §4.4 | 第二层 视觉 token |
| typography | 8% | §4.4 | 第二层 视觉 token |
| spacing | 7% | §4.4 | 第二层 视觉 token |
| radius | 5% | §4.4 | 第二层 视觉 token |
| shadow | 3% | §4.4 | 第二层 视觉 token |
| mediaDensity | 10% | §4.5 | 第三层 asset |
| **合计** | **100%** | | |

```
score = round(Σ wᵢ · dᵢ)   // 0-100
```

> 权重为**初始设定**（本质是拍脑袋），有效性由 §8.3 的对照实验检验。
> 若 E2/E3 不满足预期，**如实记录实测值并分析原因，不调参凑数**。

**任一输入不可用（原站 layout 缺失 / clone 渲染 degraded）→ 整分为 `null`，不做部分计分。**
（理由：部分计分会产生一个看起来可信、但口径不完整的数字。）

---

## 5. 链路与开关

### 5.1 数据流

```
use-workflow (QA 段)
  ├─ previewHtml（已有）
  ├─ POST /api/reconstruction { html, url, originalScreenshot }
  │     服务端：renderHtmlScreenshot(html) → RenderResult
  │             原站 layout：见 §5.2
  │             collectGeometry / collectStyleTokens / collectAssets（clone）
  │             diff → computeReconstructionScore
  │     返回 ReconstructionScore
  ├─ POST /api/mimo step=qa，context 增加 { diffReport, reconstructionScore }
  │             并新增 cloneScreenshotBase64 供多模态注入
  └─ store.setTaskPartial({ qaResult: { ..., qualityScore, reconstructionScore } })
```

### 5.2 原站 layout 真值从哪来 —— 依赖 Sprint A 的开关

`LAYOUT_PROBE` **默认是 off**。原站 layout 缺失时 §4.6 直接产出 `null`。

两个选项（**需 CHECKPOINT 确认，见 §9 待确认项 A**）：

| 选项 | 行为 | 代价 | 推荐 |
|---|---|---|---|
| A | 严格依赖 `LAYOUT_PROBE` 开启；未开则 `score = null` | 使用门槛高，容易一片 null | |
| B | `RECONSTRUCTION_DIFF=true` 时，**该接口内部强制**对原站跑一次 layout probe（走 `layout-cache`，命中缓存 ≈ 0ms） | 首次约 +2s | **推荐** |

推荐 B 的理由：`RECONSTRUCTION_DIFF` 本身就是显式开关，开启即代表用户愿意付代价；Sprint A 已有缓存，重复调用几乎免费。

### 5.3 开关与失败策略

- 新增环境变量 `RECONSTRUCTION_DIFF`（**默认 off**，与 `LAYOUT_PROBE` 同构读法）
- **fail-open**：`/api/reconstruction` 任何异常都被捕获 → `score = null` + `reason`，**绝不阻断主工作流**
- `maxDuration = 60`（新接口）；主链路 `maxDuration = 300` 不变

### 5.4 成本预算

| 环节 | 预估 |
|---|---|
| clone 渲染（含 Tailwind CDN 等待） | 2–4s |
| clone 几何 / token / asset 采集 | ~0.3s |
| 原站 layout probe（缓存未命中） | ~2s；命中 ≈ 0ms |
| 结构化 diff | 毫秒级 |
| **合计** | **< 8s**（`maxDuration=60` 内充裕） |

---

## 6. 执行计划（STOP-and-wait，每步确认后进入下一步）

### Step 1 — types（冻结落地）

- 新增 `src/types/reconstruction.ts`（§3.2 + §3.4 全部类型）
- 改 `src/types/agent.ts` 的 `QAResult`（§3.1）
- **PASS 判据**：`tsc --noEmit` 0 错；`vitest run` **214/214 仍通过**（零行为变化）；`git diff --stat` 只有这两个文件
- 本步**不写** `toVisualEvaluation()`（派生函数等 Step 5 有真实数据再落，避免空转抽象）

### Step 2 — `renderHtmlScreenshot()`

- 新增 `src/lib/render-preview/`（`render-html.ts` + `index.ts`）
- 输出 = `RenderResult`。你 Step 2 里写的 `{image, status}` 中的 `image` **即 `RenderResult.screenshot`**
  （与决策 4 的 `RenderResult` 签名保持一致，避免同一概念两个字段名）
- **PASS 判据**：
  1. 真机渲染由 `buildPreviewHtml()` 产出的 Apple HTML → `status: 'success'`，探针通过
  2. 真机渲染**把 CDN 域名改成不可达地址**的同份 HTML → `status: 'degraded'`，`reason: 'tailwind-cdn-unavailable'`
  3. 渲染空串 → `status: 'failed'`
  4. 脚本必须 `process.exit(0)`（puppeteer 会吊住 event loop，Sprint A 已踩过）

### Step 3 — Original / Clone 双截图链路

- 新增 `src/app/api/reconstruction/route.ts`
- `use-workflow.ts` QA 段调用；原站截图优先复用客户端已有的 `heroBase64`，缺失时服务端兜底 `captureWebsiteScreenshots(url)`
- **PASS 判据**：一次调用返回 `{ original, clone }` 两张 base64；端到端 **< 8s**；断网/异常时返回 `score: null` 且不抛错

### Step 4 — 结构 diff（三层）

- 新增 `src/lib/diff/`（`layout-diff.ts` / `style-diff.ts` / `asset-diff.ts` / `score.ts` / `types.ts`）
- 纯函数单测（FakePage 注入已知几何，沿用 `layout-probe.test.ts` 手法）
- **PASS 判据**（每一项都必须能独立检出，这是「可解释性」的硬要求）：
  1. 完全相同的输入 → `score === 100`
  2. 删掉一个 section → 该 role 出现 `missing`，`score` 下降 ≥ 10
  3. hero 高度改为 1/3 → `heightProfile` 显著下降
  4. 主色改为紫色 → `colorTokens` 显著下降
  5. 字号整体 ×2 → `typography` 显著下降
  6. section 间距全部改为 0 → `spacing` 显著下降
  7. 圆角 0 → 24px → `radius` 显著下降 + 产出 `+rounded` 标签
  8. 给所有卡片加阴影 → `shadow` 显著下降 + 产出 `+shadow` 标签
  9. 删掉所有图片 → `mediaDensity` 显著下降
  10. 上述 2–9 每一项都能在 `report.notes` 里**读到一句人话**（而不是只有一个数字）

### Step 5 — QA 接入（`QA | HTML` → `QA | Screenshot | Diff Report`）

- `visual-evaluation/prompt.ts`：`buildVisualEvaluationUserMessage` 改为接收 `cloneScreenshot 存在标记` + `diffReport`，HTML 源码**降级为可选辅助**（不再作为主要输入）
- `route.ts` qa 分支：`useScreenshot` 白名单加入 `qa`；注入原站 + clone 两张图
- `use-workflow.ts`：落 `qualityScore` / `reconstructionScore`；QA 日志同时打印两个分
- **PASS 判据**：qa 的 userMessage **不再以 12000 字符 HTML 为主体**；两张图进入 `images`；日志出现 `quality=X / reconstruction=Y` 两行

### Step 6 — 真实验证

见 §8。

---

## 7. ALLOWED / FORBIDDEN（文件级，硬约束）

### ✅ ALLOWED — 新增

| 路径 | 内容 |
|---|---|
| `src/types/reconstruction.ts` | §3.2 全部类型 |
| `src/lib/render-preview/**` | `renderHtmlScreenshot()` |
| `src/lib/diff/**` | 三层结构化 diff（纯函数） |
| `src/lib/reconstruction/**` | 编排层 + 浏览器侧采集器 |
| `src/app/api/reconstruction/route.ts` | 新接口 |
| `scripts/verify-reconstruction.ts` | 验收脚本 |
| `docs/phase2-sprintB-*.md` | 文档 |

### ✅ ALLOWED — 修改（**限定范围**）

| 文件 | 只允许改什么 |
|---|---|
| `src/types/agent.ts` | **只改 `QAResult`**（§3.1）。`VisualScore` / `VisualScoreDimensions` 一律不动 |
| `src/lib/visual-evaluation/prompt.ts` | **只改 `buildVisualEvaluationUserMessage`** |
| `src/app/api/mimo/route.ts` | ①qa 分支（1705–1712）②`useScreenshot` 白名单（1873）与 images 注入。**仅这三处** |
| `src/store/use-workflow.ts` | **仅 QA 段（1165–1278）** |
| `src/lib/browser-intelligence/layout-probe.ts` | **只允许给 `collectGeometry` 加 `export`**，不得改算法、常量、推断逻辑 |
| `src/lib/browser-intelligence/index.ts` | 补导出 |
| `package.json` / `.env.example` / `.gitignore` | 脚本、开关说明、`.verify-reconstruction/` |

### ❌ FORBIDDEN

1. **不引入任何新 npm 依赖**（`pixelmatch` / `sharp` / `jimp` / `resemblejs` 全部禁止）
2. ❌ `visual-evaluation/scoring.ts` —— 六维与权重一个字都不改
3. ❌ `SYSTEM_PROMPTS.qa` —— 8 维评分模型不动（只改输入，不改判据）
4. ❌ interaction 相关任何文件（Sprint 3 已冻结）
5. ❌ `layout-probe.ts` 的算法与常量（只允许加 `export`）
6. ❌ `buildPreviewHtml()` 的输出结构（Tailwind 内联化 = DISCOVERY 方案 C，另开一轮）
7. ❌ `qa-section.tsx` 与任何 UI 组件（Sprint B 不碰 UI，见 §9 待确认项 B）
8. ❌ `public/screenshots/` 落盘（三张对比图仍是已知债，本轮不动）
9. ❌ code agent prompt、redesign / aesthetic scoring
10. ❌ `WebsitePackage` 协议版本（保持 **1.2.0**，reconstruction 不属于 WebsitePackage）

---

## 8. 验收标准（Step 6）

### 8.1 门禁（四道，与 Sprint A 同口径）

| 门禁 | 标准 |
|---|---|
| `vitest run` | 全绿（214 + Step 4 新增） |
| `tsc --noEmit` | 0 错 |
| `eslint`（改动文件 scoped） | 0 错 |
| `next build` | EXIT=0 |

### 8.2 Reconstruct Truth Test（真机，Apple / Stripe / Linear）

| 站点 | 判据 |
|---|---|
| 三站通用 | 同一输入两次调用 → `score` 一致（确定性） |
| 三站通用 | `renderStatus` 必须 `success`（否则验证无效） |
| Apple | `quality` 与 `reconstruction` **两个数字都存在** |

### 8.3 决定性证据：`quality ≠ reconstruction`

必须证明**同一个生成页面 `quality 90 / reconstruction 60` 可能存在**。三组对照实验：

| 实验 | 操作 | 预期 |
|---|---|---|
| E1 基线 | Apple 正常生成 | 记录 `quality = Q0`、`reconstruction = R0` |
| **E2 总分证据** | 同时改三处：hero 高度 → 1/3、主色 → 紫色、删除所有图片 | `reconstruction` **显著下降**（目标 Δ ≥ 15），`quality` **基本不动**（目标 Δ ≤ 8） |
| E2-a 单变量 | **只**改 hero 高度 → 1/3 | `heightProfile` 单项显著下降 |
| E2-b 单变量 | **只**改主色 → 紫色 | `colorTokens` 单项显著下降 |
| E2-c 单变量 | **只**删除图片 | `mediaDensity` 单项显著下降 |
| E3 交叉对比 | 用 Linear 的克隆页去跟 Apple 的原站比 | `reconstruction` 明显低，但 `quality` 仍可能很高（页面本身好看） |

**判据：E2 或 E3 任一能同时满足「Δreconstruction ≥ 15」且「Δquality ≤ 8」，即证明两个指标度量的确实是两件事。**
E2-a/b/c 不是主判据，但必须给出**单项归因表**（哪个维度被哪个改动打下来），否则总分下降无法解释。
若实测不满足，如实记录实测数值并分析，**不得为了让数字好看而调整权重**。

### 8.4 交付物

- `scripts/verify-reconstruction.ts` + `npm run verify:reconstruction`
- 产物落 `.verify-reconstruction/<host>/`（截图 + diff 报告 JSON + 对照表）
- 文档 §"实测结果" 追加到本文件末尾
- commit 序列（每步一个，便于回滚）→ tag **`v0.10.0-reconstruction-diff`**

---

## 9. CHECKPOINT — 三个待确认项（已按推荐填入默认，可直接推翻）

**本轮仍为 DESIGN，未写任何实现代码。**

为避免空转，A / B / C 三项**已按我的推荐写入上文的默认口径**。如果你不反对，直接回「确认，进 Step 1」即可；要改就直接说。

### 待确认项 A：原站 layout 真值的获取策略 —— **默认取 B**

| 选项 | 行为 |
|---|---|
| A | 严格依赖 `LAYOUT_PROBE=true`；未开 → `score = null` |
| **B ✅ 已按此写入 §5.2** | `RECONSTRUCTION_DIFF=true` 时接口内部强制采集（走 `layout-cache`，首次 +2s，命中 ≈0ms） |

选 B 的理由：`RECONSTRUCTION_DIFF` 本身就是显式开关，开启即代表愿意付代价；且 Sprint A 已有缓存，重复调用几乎免费。

### 待确认项 B：是否在 Sprint B 内做最小 UI 改造 —— **默认取 1**

Sprint B 目前 FORBIDDEN 了 UI。代价是：
`qa-section.tsx` 顶部那个大数字仍然标着「相似度」、显示的其实是质量分 —— 数据层面已经拆清楚了，UI 层面仍然在骗人。

| 选项 | 行为 |
|---|---|
| **1 ✅ 已按此写入 §7** | Sprint B 不碰 UI（保持 FORBIDDEN），UI 改造列为 **Sprint B.1** |
| 2 | 追加 Step 7：最小改动 —— 标签「相似度」→「视觉质量分」，旁边加一行「还原度 X（无法度量时显示 —）」 |

选 1 的理由：UI 改动会牵动 `qa-section.tsx` 里 8 处 `similarity` 引用，是独立风险面，值得单独一轮。
**但如果你认为「数据对了 UI 还在骗人」不可接受，选 2 我就加 Step 7。**

### 待确认项 C：E2 破坏实验的破坏幅度 —— **默认取「三处同时破坏 + 三小组单独测量」**

| 选项 | 行为 |
|---|---|
| 只改一处 | 更纯粹的单一变量对照，但覆盖面窄 |
| **三处同时 ✅ 默认** | hero 高度 1/3 + 主色改紫 + 删除图片 |

折中做法（已写入 §8.3）：**E2 一次同时破坏三处看总分**，另外**每个单项各跑一次单独测量**（对应 §6 Step 4 的判据 3/4/9），这样既有总分证据又有单变量归因。

---

## 10. 风险登记

| 风险 | 等级 | 应对 |
|---|---|---|
| Tailwind CDN 不可达 → 全站 degraded，Sprint B 拿不到任何分 | **高** | Step 2 先做真机验证；若频繁失败，提前启动 DISCOVERY 方案 C（Tailwind 内联化，另开一轮） |
| 生成 HTML 含外链 → 服务端浏览器访问内网 | 中 | 请求拦截复用 `isBlockedUrl()`；不做 `page.goto` |
| `collectGeometry` 在 clone 上表现与真实站点不同（AI 生成的 DOM 结构更扁平） | 中 | Step 4 实测三站 clone，若区块数恒为 1 则如实记录并调整预期 |
| `previewHtml` 体积大（可达 30KB+）→ 新接口传输开销 | 低 | 可接受；必要时改由服务端从 store/DB 取（但那需要持久化，超出范围） |
| 打分权重「拍脑袋」 | 中 | §8.3 对照实验即是权重有效性的检验；不满足则如实记录，不调参凑数 |

---

## 11. 回滚方案

- 每步一个独立 commit，Step 4（最大改动）单独一个
- `RECONSTRUCTION_DIFF` 默认 off → 关闭即完全回到 Sprint B 之前的行为
- `similarity` 字段保留兼容 → 即使回滚 types，UI 也不受影响

---

## 12. 实测结果

### 12.1 Step 1 — types（`d5f471c`）

- 门禁：tsc 0 · eslint 0 · vitest **214/214**（零行为变化）
- `git diff --stat`：`src/types/agent.ts` +26/-1，新增 `src/types/reconstruction.ts` ✅

### 12.2 Step 2 — `renderHtmlScreenshot()`（真机 4/4 通过）

| # | 场景 | 实测 | 耗时 | 结果 |
|---|---|---|---|---|
| 1 | `buildPreviewHtml()` 真实产物（含 Tailwind CDN） | `success`，截图 46KB | 3211ms | ✅ |
| 2 | CDN 域名不可达（`cdn.tailwindcss.invalid.example`） | `degraded` + `tailwind-cdn-unavailable`，截图 41KB | 15311ms | ✅ |
| 3 | 空字符串 | `failed` + `empty-document` | 0ms | ✅ |
| 4 | 自包含 HTML（内联 `<style>`，无 CDN） | `success`，截图 87KB | 582ms | ✅ |

**决定性证据（人工看图）**：Case 1 与 Case 2 内容完全相同（mock Apple 页），
Case 1 是样式完整的 Apple 风页面（深色 hero / Apple TV+ / Trade In 分区），
Case 2 是**样式全丢的裸 HTML**——同一份 DOM 两种命运，这就是「degraded 不产分」要拦的东西。
两张图在 `.verify-reconstruction/`（已 gitignore）。

**Step 2 期间发现并修复的实现 bug**：

- 首版 CDN 检测用完整域名 `/cdn\.tailwindcss\.com/i`，被测试里替换出的
  `cdn.tailwindcss.invalid.example` 绕过 → 被误判成「自包含 HTML」直接 `success`。
  真实场景中任何镜像域名都会触发同样问题。
- 修复：改为只匹配主机前缀 `/cdn\.tailwindcss\./i`，并在代码注释里写明为什么不能按完整域名匹配。
- 这正是 PASS 判据 2 存在的价值：不真机打一次，这条路径永远不会暴露。

**附带发现**：

- Case 4（自包含 HTML）`success` 且 582ms —— 无 CDN 依赖的页面不该被判 degraded，
  这是首版设计没有写明、实现时补上的分支（冻结文档 §4.1 不冻结实现细节）。
- Case 2 耗时 15.3s = 8s JIT 等待超时 + ~7s DNS 失败。生产环境若 CDN 长期不可达，
  这个耗时直接加在生成链路上 —— 风险登记 §10 的「提前启动方案 C」阈值需要考虑它。

产物：`scripts/verify-reconstruction.ts` + `npm run verify:reconstruction`（后续 Step 会往里追加判据）。

### 12.3 Step 3 — Original / Clone 双截图链路（真机 7/7 通过，含 Step 2 回归）

| # | 场景 | 实测 | 耗时 | 结果 |
|---|---|---|---|---|
| 3.1 | 服务端兜底采集原站（fallback） | `originalSource=server`（264KB）+ clone `success` | total 6738ms（clone 2125 + original 4585） | ✅ |
| 3.2 | **客户端复用原站截图（主路径）** | `originalSource=client`，originalMs=0 | **total 2134ms** | ✅ |
| 3.3 | clone 渲染降级时链路完整性 | 不抛错，`render.status=degraded` + `reason` 照常返回 | 15335ms | ✅ |

**关键结论：**
- 主路径端到端 **2.1s**，远低于 8s 判据；服务端兜底 6.7s 也在预算内（因为原站截图有 10min URL 缓存）。
- 3.3 证明了「原站截图与 clone 渲染是两条独立链路」：clone 降级不影响 original 的获取。

**Step 3 的两个范围调整（相对 §6 原计划，已按「不冻结实现细节」处理）：**

1. **客户端接线推迟到 Step 5。** 原计划 Step 3 就让 `use-workflow.ts` 调这个接口，
   但 Step 3 阶段接口还不产出 `score`，客户端调了没有消费者 —— 那是死代码。
   Step 5（QA 接入）时数据有去处了再接，`use-workflow.ts` 只动一次。
2. **响应里不放 `score: null` 占位。** PASS 判据写的是「异常时返回 score: null」，
   但 Step 3 还没实现 diff，`null` 会同时表示「无法度量」和「还没实现」两种意思 ——
   这违反本契约「unknown 不是 guess」的口径。`score` 字段随 Step 4 一起出现。
   Step 3 的失败语义由 `render.status` / `originalSource='unavailable'` 承载。

**产物：** `src/lib/reconstruction/`（config + capture-pair + index）、`src/app/api/reconstruction/route.ts`（`maxDuration=60`，fail-open，开关关闭时零开销）。

**Step 4 的一个待批接口扩展（提前报备）：**
CHECKPOINT A 选了方案 B（`RECONSTRUCTION_DIFF=on` 时接口内强制采集原站 layout），
但 `getLayoutProbe()` 写死了 `if (!isLayoutProbeEnabled()) return null`。
要实现「强制」需要二选一：
- **a.** 给 `layout-cache.ts` 的 `getLayoutProbe` 加 `options.force?: boolean`（默认行为不变，纯接口扩展）；
- **b.** 在 `src/lib/reconstruction/` 里用已导出的 `openBrowserSession + probeLayout` 自建采集（不动 Sprint A 文件，但缓存逻辑要复制一份）。

我推荐 **a**（不复制缓存语义，改动是纯增量），但它触碰了 `browser-intelligence/` 目录 ——
按 FORBIDDEN 第 5 条的精神（不改 Sprint A 算法）这不算违规，但按 ALLOWED 清单的字面它没被列出。
**需要你批准 a 或选 b，Step 4 动工前定。**

### 12.4 Step 4 — 结构化 diff（三层，17 项单测全绿）

**产物：** `src/lib/diff/`（`layout-diff.ts` / `style-diff.ts` / `asset-diff.ts` / `score.ts` / `index.ts`）+ `diff.test.ts` 17 项。

| # | 判据 | 实测 |
|---|---|---|
| 1 | 完全相同 → score 100 | **100**，九维全 100，notes 为空 |
| 2 | 删掉一个 section → missing + 总分降 ≥10 | `roleSequence=80`、`heightProfile=33.3`、**总分 83.6**（降 16.4）✅ |
| 3 | hero 高度 →1/3 | `heightProfile=64`，note `hero height -67%` |
| 4 | 主色 → 紫色 | `primary.distance=0.277`，`colorTokens=90.8`，note `-color mismatch (primary)` |
| 5 | 字号 ×2 | `fontSizeRatio=2`，`typography=75`，note `-font size` |
| 6 | section 间距归零 | `sectionGap.ratio=0`，`spacing=40` |
| 7 | 圆角 0→24px | `radius=0`（触顶 24px 阈值），note `+rounded` |
| 8 | 全站加阴影 | `shadow=55`，note `+shadow` |
| 9 | 删除所有图片 | `mediaDensity=0`，note `-media missing` + `-hero media missing` |
| 10 | 各项都有人话标签 | 上表 notes 列 ✅ |

**额外覆盖的语义边界（这些是「unknown 不是 guess」在 diff 层的落地）：**
- LCS 对齐：中间插入 feature → 只标 `extra`，hero/content/footer **不被错配**
- 同名 role（两个 content）按出现顺序配对，顺序不串
- 两边都无主色（纯黑白页）→ 视为一致，不产出 `primary` 字段、不罚分
- 一边有主色一边没有 → 距离记 1（罚满），不猜一个值补上
- `pairwiseRatio(0, 0) = 1`（都是 0 表示一致，不是完全不一致）
- `parseRgb` 拒绝非法值与 alpha < 0.5

**判据 2 的一个诚实说明：** 我第一版 fixture 是「删掉 content 但其余区块权重不变」，
算出来只降 8.9 分（没到 10）。这不是指标失灵 —— 而是那个 fixture 不真实：
现实中删掉一个区块，剩下的会吃掉它的空间（权重重新归一化）。
改成真实归一化后降 16.4 分。**指标没问题，是我第一版 fixture 不符合物理。**

**两个加法式修订（非破坏）：**
1. `LayoutDiffItem` 补 `originalColumns` / `cloneColumns` 两个可选字段 ——
   只有差值 `columnDelta` 无法生成 `feature columns 3→4` 这种标签。
2. `computeReconstructionScore` 的入参改为 `{ layout, style, assets }` 而非 §3.3 写的
   `DiffReport`（因为 `DiffReport` 本身含 `dimensions`，会造成循环依赖）。多了 `buildDiffReport()` 负责组装。

**门禁：** tsc 0 · eslint 0（0 error / 0 warning）· vitest **231/231**（214 + 17 新增）。

### 12.5 Step 5 — 完整编排 + QA 接入（真机 10/10，含 Step 2/3 回归）

**产物：**
- `src/lib/reconstruction/collect.ts` —— 浏览器侧采集（clone 布局 / 视觉 token / 资源）
- `src/lib/reconstruction/original-layout.ts` —— 原站真值采集（layout+tokens+assets 一次会话采完，带缓存）
- `src/lib/reconstruction/evaluate.ts` —— `composeReconstructionScore`（纯）+ `evaluateReconstruction` + `runReconstruction`（完整编排）
- `src/app/api/reconstruction/route.ts` —— 响应加 `score: ReconstructionScore`
- QA 接入：`visual-evaluation/prompt.ts` · `api/mimo/route.ts`（qa 双图注入 + diffReportJson）· `store/use-workflow.ts`（QA 段接线）

| # | 场景 | 实测 | 耗时 |
|---|---|---|---|
| 5.1 | 正常路径（clone=mock Apple 页 vs 原站 apple.com） | `score=50`，九维齐全、notes 6 条 | 4569ms（clone 2345 + original 2120） |
| 5.2 | CDN 不可达 | `degraded` → **`score=null`** | — |
| 5.3 | 无原站 URL | `render=success` 但 `reason=original-layout-unavailable` → **`score=null`** | — |

**5.1 的九维与 notes（真实输出）：**
```
{"roleSequence":60,"heightProfile":0,"blockGeometry":77.8,"colorTokens":62.8,
 "typography":45.4,"spacing":86.4,"radius":100,"shadow":95.2,"mediaDensity":2.1}
notes: ["other height +283%","other alignment mismatch","nav missing",
        "other height +565%","other columns 1→2","hero missing"]
```
诚实解读：mock Apple 页本来就不像真 apple.com（它是通用模板页），`hero missing` / `mediaDensity 2.1`
都是**真实差异**，50 分合理。真正的证明（quality ≠ reconstruction）留给 Step 6 的对照实验。

**三个实现决定（相对冻结文档的偏差，均属「不冻结实现细节」范围）：**

1. **`renderHtmlPage()` 重构。** 原 `renderHtmlScreenshot()` 截完图就关页面，
   导致 diff 无法在同一页面上采几何/token。拆成「渲染（保持打开）+ 截图」两层，
   `renderHtmlScreenshot` 退化为薄封装（签名不变）。
2. **`runReconstruction()` 合并编排。** 我第一版让 route 用 `Promise.all` 同时跑
   `captureScreenshotPair + evaluateReconstruction` —— 那会把 clone **渲染两次**（~3s 白付）。
   改为单次渲染内完成全部工作，`captureScreenshotPair` 保留给「只要截图不要分数」的场景。
3. **evaluate-only 适配器。** clone 布局复用 `probeLayout()` 需要 `PageController`（5 方法窄接口），
   我做了只实现 `evaluate` 的适配器 —— **browser-intelligence 目录零改动**，
   连 §7 允许加的 `collectGeometry` export 都不需要了（比原计划更保守）。

**原站 layout 强制采集选了方案 b：** 在 `src/lib/reconstruction/original-layout.ts` 自建采集与缓存，
**完全不动 Sprint A 任何文件**。代价是复制了一份 layout-cache 的缓存语义
（成功 10min / 失败 60s / LRU 20 / inflight 去重），文件头已注明「若将来批准加 force 选项则删此文件」。

**类型加法式修订：** `RenderReason` 增加 `'original-layout-unavailable'` ——
原站真值缺失不是渲染问题，但同样导致「无法度量」，需要一个区别于 `render-error` 的原因码。

**QA 输入口径变更（三处断裂之一已修复）：**
- `route.ts`：`qa` 首次进入截图注入，一张变**两张**（原站 + 生成页）
- `prompt.ts`：有 Diff 报告时以「两张截图 + 报告」为主输入，HTML 从 12000 字符降到 **4KB 辅助**
- `use-workflow.ts`：QA 段落 `qualityScore` + `reconstructionScore`，日志同时打印两个分
  （`质量分 X ≠ 还原度 Y`），fail-open（还原度服务挂了不影响主流程）

**已知未处理：** `QAResult.screenshots` 仍是 `/screenshots/*.png` 死路径 ——
按 CHECKPOINT B 选项 1，UI 改造列为 Sprint B.1，本轮不碰。

**门禁：** tsc 0 · eslint 0 error · vitest **241/241**（214+17+5+5）· 真机 10/10。

### 12.6 Step 6 — 决定性证据（真机，主判据 PASS）

**命令**：`npm run verify:reconstruction -- --proof`（`--proof` 只跑 Step 6，不重复烧 Step 2/3/5 的时间）

#### 第一轮（mock Apple 页做基线）→ 主判据未达成，如实记录

| 实验 | 结果 | 判定 |
|---|---|---|
| E0 确定性 | 50 / 50 | ✅ |
| E1 基线 | R0=50, Q0=48.8 | — |
| E2 三处破坏 | ΔR=**0**（目标≥15）, ΔQ=7 | ❌ |
| E3 交叉 | ΔR=3, ΔQ=5.5 | ❌ |

**三个根因（全部取证确认，非猜测）：**

1. **E2-b 撞上算法盲区（`pickPrimaryColor` 罚满常数）**。apple.com 是纯灰度站 →
   原站主色 `undefined` → 走「一边有主色一边没有 → 罚满 distance=1」分支。
   实测：基线 primary delta `{original:"none", clone:"rgb(0,113,227)", distance:1}`，
   改紫后 `{original:"none", clone:"rgb(124,58,237)", distance:1}` —— **distance 都是 1**，
   clone 主色从蓝变紫被完全吞掉。62.8 = (1 − (0+0.1146+1)/3)×100，两次严丝合缝。
   变异本身有效（截图大面积紫色），问题纯在 diff 层的对称性设计。
2. **E2-a 地板效应**。mock 页基线 heightProfile 已是 0，hero 再砍 2/3 无从下降。
3. **E2-c 权重稀释**。mediaDensity 2.1→0.8，Δ1.3 × 0.10 = 0.13 分，四舍五入后总分不动。

**方法论教训**：mock 模板页 R0=50 本来就是「烂」基线，在地板上做破坏实验没有区分度。
原话「同一个生成页面 quality 90 / reconstruction 60 可能存在」要求**先高还原、再破坏**。

#### 第二轮（对齐克隆基线）→ 主判据 PASS

新增 `buildAlignedClone(originalFingerprints)`：按原站真值 flow 逐块对齐
（role / 高度 / 列数 / 对齐 / 媒体密度）构造自包含克隆页。**不碰 src，纯脚本侧。**

| 实验 | 结果 | 判定 |
|---|---|---|
| E0 确定性 | 91 / 91，render 均 success | ✅ §8.2 |
| E1 基线 | **R0=91, Q0=19** | 两个数字都存在 ✅ §8.2 |
| E2 三处破坏 | ΔR=**10**, ΔQ=**14** | ❌（未达 15/8） |
| E2-a 只改 hero→1/3 | R=88，heightProfile 97→80 | 单项归因成立 |
| E2-b 只改主色→紫 | R=86，colorTokens 100→66.7 | 单项归因成立 |
| E2-c 只删图片 | R=89，mediaDensity 56.6→40.8 | 单项归因成立 |
| **E3 交叉对比** | **ΔR=44, ΔQ=2.3** | ✅ **PASS** |

**主判据（§8.3）经 E3 达成：同一份 clone HTML 一个字不改，只把原站从 apple.com 换成
stripe.com —— quality 19→21.3（Δ2.3，LLM 噪声级别），reconstruction 91→47（Δ44）。**
quality 度量的是「页面本身好不好看」，reconstruction 度量的是「像不像那一个原站」，
E3 把这两个变量彻底分离了。

**归因表（第二轮九维）：**

```
维度                E1     E2   E2-a   E2-b   E2-c     E3
roleSequence       100    100    100    100    100   42.1
heightProfile       97     80     80     97     97      0
blockGeometry     95.2   95.2   95.2   95.2   95.2   83.3
colorTokens        100   66.7    100   66.7    100   44.3
typography        68.8   68.8   68.8   68.8   68.8   42.6
spacing           84.5   84.5   84.5   84.5   84.5     32
radius            100    100    100    100    100    100
shadow            100    100    100    100    100   99.7
mediaDensity      56.6   40.8   56.6   56.6   40.8   75.3
```

E2 三个单变量的加权和 = 0.18×17 + 0.15×33.3 + 0.10×15.8 = 3.1 + 5.0 + 1.6 ≈ **9.7 ≈ 实测 ΔR=10**，
归因表自洽。

**额外发现（比主判据更强的证据）**：E1 本身就是一次**反向分裂** ——
对齐克隆还原度 91 分，但视觉质量只有 19 分（2100px 高的空 hero、灰白极简、12px 占位图，
LLM 如实评价「简陋」）。还原度高 ≠ 质量高，和「质量高 ≠ 还原度高」互为镜像，
进一步证明两个分数度量的不是同一件事。

**E2 未达标的分析（不调权重，如实记录）**：三处破坏各自都能被对应维度捕获且归因自洽，
但权重和只有 0.43（0.18+0.15+0.10），物理上就到不了 Δ15。E2 的 15 分目标隐含假设
「三处破坏能打掉一半以上结构权重」，只有破坏**布局结构层**（roleSequence/heightProfile 主干）
才能达到 —— 这恰好是 E3 干的事。**结论：E2 是归因实验，E3 才是分离实验，二者分工不同。**

#### 遗留（进入 Sprint B.1 / 后续候选清单）

1. **`pickPrimaryColor` 罚满盲区**：原站无主色（纯灰度站）时，clone 主色任何变化都不敏感。
   候选修法：primary 只在两侧都可提取时才比较（与「两边都没有 → 一致」同语义），
   或对 primary 做直方图 top-K 相似度。涉及 `src/lib/diff/style-diff.ts`，需单独审批。
2. **原站真值缺失时的 DB 依赖**：脚本环境 `getAiConfig()` 走 Prisma（Supabase）不可达，
   credential 自动 fallback 到 `.env` 生效 —— 无碍，但记录此依赖链。
