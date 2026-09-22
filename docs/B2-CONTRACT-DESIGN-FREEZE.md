# B.2.0 — Contract Design Freeze

> **状态**：冻结草案，待确认。
> **本文件只定义契约，不包含任何实现。** 确认后才进入 B.2.1（types 扩展）。
> **前置条件已满足**：Release Checkpoint 已落地 —— `origin/main = 9338873`，
> tag `v0.10.1-recovery-20260921 → 2ccd8a3`。

---

## 1. Current Problem — `similarity` 的语义混用

当前全链路只有一个字段承载分数：

```ts
similarity?: number   // src/types/agent.ts:186（已标 @deprecated）
```

它在代码里至少有 **四种互不相同的语义来源**：

| 可能的语义 | 实际证据 |
|---|---|
| 视觉质量分（六维加权） | `use-workflow.ts:1312` 赋的是 `visualScore.overall_score` |
| 还原度（像不像原站） | Sprint B 之前被误当作它使用，UI 曾标「相似度 / 还原度」 |
| 生成置信度 | `api/workflow/route.ts:463,473` 的示例/日志数据（0.978 / 97.8%） |
| 营销展示分数 | `app/page.tsx`（展示卡）、`ModeSelector.tsx`（`mode.similarity`，实为目标还原度） |

**引用点清单（15 个文件，B.2 迁移的完整范围）**：

```
生产：
  src/store/use-workflow.ts:1312        similarity = visualScore.overall_score
  src/store/use-workflow.ts:1444        track 上报 similarity
  src/app/api/track/route.ts:47         接收并落库 similarity

消费：
  src/components/sections/qa-section.tsx        （B.1 已改为读 qualityScore / reconstructionScore）
  src/lib/export-generator.ts                   （B.1 已改为两个字段）
  src/lib/live-stats.ts:29,211,224              in-memory 记录 + 日志「还原度」
  src/app/admin/{analytics,dashboard,generations,generations/[id],projects}/page.tsx
  src/app/page.tsx                              营销展示卡（mock 数据）
  src/components/design-mode/ModeSelector.tsx   mode.similarity（语义是「目标还原度」）
  src/lib/design-knowledge.ts / src/lib/prompts/pixel-copy.ts / src/lib/services/design-memory.ts
```

**核心风险**（Sprint B DISCOVERY 已用对照实验证明）：`好看的页面 ≠ 高还原页面`。
一个字段同时表达两件事，会让 Optimize 去修一个不存在的问题。

---

## 2. Data Flow Contract

```
Vision Agent
   ↓  visualScore（六维：premium/layout/balance/whitespace/color/typography）
Code Agent
   ↓  generatedCode
Preview Renderer
   ↓  previewHtml（buildPreviewHtml）
QA Agent
   ↓  qualityScore  = visualScore.overall_score
Reconstruction Diff（use-workflow.ts:1195-1220 → fetch /api/reconstruction）
   ↓  reconstructionScore（9 维加权 + DiffReport）
Generation Result（use-workflow.ts:1305-1315）
   ↓
Export / Admin / UI
```

| 节点 | Producer | Consumer | 可选性 | 缺失行为 | 失败行为 |
|---|---|---|---|---|---|
| `visualScore` | Vision（QA Agent） | QA Section、Optimize | optional | 回退 mock 演示值（仅首页） | 六维缺失 → 不评分 |
| `qualityScore` | QA（`visualScore.overall_score`） | UI / Export / Admin | **optional** | `undefined` → 不展示 | 不产生 `0` |
| `reconstructionScore` | Reconstruction Diff | UI / Admin / Report | **optional** | `undefined`/`null` → `unavailable` | `null` + `reason`（渲染降级 / 真值缺失） |
| `reconstructionMeta` | Reconstruction（`DiffReport` 派生） | 报告 / 调试 | **optional** | 整体省略 | `degradedReason` 说明原因 |

**关键约束**：`reconstructionScore` 只在 `RECONSTRUCTION_DIFF=on` 且渲染未降级时才有值；
开关关闭时该字段**根本不产生**，而不是产生 `null`。

---

## 3. Type Contract（最终冻结版）

```ts
interface QualityMetrics {
  /**
   * @deprecated 历史兼容字段，语义是「视觉质量分」，不是相似度。
   * 保留、不删除、继续双写，直到 Phase 4 停止生产。
   *
   * Producer: QA Agent（use-workflow.ts:1312）
   * Source  : visualScore.overall_score
   * Read    : 当 qualityScore 也存在时，一律以 qualityScore 为准（见下方读取优先级）
   */
  similarity?: number;

  /**
   * 视觉质量分（0-100）：这个网页设计得好吗
   *
   * Producer: QA Agent
   * Source  : visualScore.overall_score（六维加权）
   */
  qualityScore?: number | null;

  /**
   * 还原度（0-100）：像不像目标网站。
   *
   * Producer: Reconstruction Diff（src/store/use-workflow.ts → /api/reconstruction）
   * Source  : ReconstructionScore.score（9 维加权，types/reconstruction.ts:214）
   * 缺失语义: undefined = 未开启/未产生；null = 有流程但结果不可得（降级/真值缺失）
   */
  reconstructionScore?: number | null;

  reconstructionMeta?: {
    /** 哪些页面区域参与了测量（role 序列，不是计数） */
    measuredSections?: string[];
    // TODO(B.2.x): 由 unknown 收敛为 DiffReport / 具名接口，避免 Export/Admin 侧类型逃逸
    structuralDiff?: unknown;
    visualDiff?: unknown;
    degradedReason?: string;
  };
}
```

**读取优先级（迁移期必现双字段，必须统一规则）**：

```
qualityScore  >  similarity
```

即两者同时存在时，展示与计算一律取 `qualityScore`；`similarity` 仅在 `qualityScore` 缺失时作为历史兜底。
这条同样适用于 `reconstructionScore`：`null` 不等于 `undefined`，两者都不取 `0`。

`reconstructionScore` 的完整对象形态沿用既有 `src/types/reconstruction.ts:214`
（含 `score: number | null`、`reason`、`report`）；本契约里的 `reconstructionScore?: number | null`
是它在 `QAResult` 上的**投影值**，明细仍在 `reconstructionMeta` / 原对象中。

> **契约修订记录（2026-09-22，B.2.1 实施时）**
> 原冻结为 `qualityScore?: number` / `reconstructionScore?: number`，实施中发现与 §4 四态语义冲突：
> `null`（有流程但不可得）无法表达，且生产侧 `qa-section.tsx:85` 已按 `number | null` 消费、
> `QAResult.reconstructionScore` 本就是 `ReconstructionScore | null`，严格模式下 `null` 赋给 `number` 编译失败。
> 故收敛为 `number | null`：
> - `undefined` = 未产生 → 不展示
> - `null` = 有流程但不可得 → `unavailable`
> - `0` = 有效测量结果为零 → 显示 `0`
> 「为什么不可得」仍由 `reconstructionMeta.degradedReason` 承载，两者不重复表达同一件事。

---

## 4. State Semantics Contract

| 值 | 含义 | UI 展示 |
|---|---|---|
| `undefined` | 尚未产生该字段（功能关闭 / 老数据） | **不展示** |
| `null` | 有流程但无法得到结果（渲染降级、真值缺失） | **unavailable** + reason |
| `0` | **有效测量结果为零** | 显示 `0` |
| missing | 历史数据不存在该字段 | **不推断** |

**代码级禁令**：

```ts
score ?? 0        // ❌ 禁止：把「没测/失败」污染成 0 分
score || 0        // ❌ 同理
```

任何实现不得把 `missing → 0`、`failed → 0`、`unmeasured → bad score` 当作展示或计算逻辑。
这与 Sprint A 的 `unknown 不是 guess` 是同一条原则。

---

## 5. API Compatibility Contract — Additive Only

**允许**（新旧字段共存）：

```json
{
  "similarity": 92,
  "qualityScore": 92,
  "reconstructionScore": 87
}
```

**禁止**：

```diff
- similarity
+ reconstructionScore
```

**覆盖场景**：

| 场景 | 行为 |
|---|---|
| 老客户端读 `similarity` | 继续可用，值不变 |
| 新客户端读 `reconstructionScore` | optional，缺失即不展示 |
| 历史数据库记录 | 不迁移、不破坏，允许 `similarity` 有值而新字段缺失 |
| 未采集 | 字段不存在（`undefined`），不是 `0` |
| 采集失败 | `reconstructionScore: null` + `degradedReason` |

受影响接口：`/api/track`（接收）、`/api/admin/stats`（返回，数据来自 `live-stats`）、
`/api/reconstruction`（新增产出，Sprint B Step 3 已有）。

---

## 6. Migration Strategy — 四阶段

| Phase | 动作 | 产出 |
|---|---|---|
| **1. Add** | 新增 `qualityScore` / `reconstructionScore` / `reconstructionMeta` 字段与类型 | types + 类型测试 |
| **2. Dual write** | 生成结果同时写 `similarity` 与 `qualityScore`；还原度单独写 | generation result 链路 |
| **3. Observe** | 统计新字段覆盖率、`null` 比例、`similarity` 与 `qualityScore` 是否一致 | 观察期数据 |
| **4. Deprecate** | 停止**生产** `similarity`，**保留读取** | 老数据仍可读 |

**禁止**：一次 rename、一次删除、硬迁移。

**进度**

| Phase | 状态 | 落地 |
|---|---|---|
| 1. Add（types + 类型测试） | ✅ | `406a903` + `acc6bd0`（`QualityMetrics` / `ReconstructionMeta`，9 条契约类型测试） |
| 2. Dual write（generation result 链路） | ✅ | 见下 |

**Phase 2 落地说明**

- `similarity` 与 `qualityScore` 双写在 Sprint B.1 已完成（`use-workflow.ts` 写 QAResult 处两者同赋值）。
- 本次补齐的是**还原度明细**：新增纯函数 `src/lib/reconstruction/quality-metrics.ts`
  - `deriveReconstructionMeta(reconstructionScore)`：派生 `reconstructionMeta`。
    开关关闭 / 服务没产出对象 → **返回 `undefined`，字段不产生**（不是 `{}`、不是 `null`）；
    有对象但 `score === null` → 必带 `degradedReason`（`reason ?? renderStatus ?? 'unknown'`）；
    全 `extra`（无真值可比对）时 `measuredSections` 不出现。
  - `toQualityMetrics(qa)`：QAResult → QualityMetrics 单向投影，强制执行
    读取优先级 `qualityScore > similarity`，且 `null` / `undefined` / `0` 三者互不塌缩。
- `use-workflow.ts` 只多一行：把派生结果（仅在有值时）写进 QAResult。
- **命名冲突已记录**：`QAResult.reconstructionScore` 是**完整对象**，
  `QualityMetrics.reconstructionScore` 是**投影标量**；二者同名不同义，靠 `toQualityMetrics()` 单向转换，禁止互相赋值。

**实现顺序**（每步 commit + push 后再继续）：

```
B.2.1 types          →  src/types/agent.ts（+ 如需要新增 quality-metrics.ts）
B.2.2 generation     →  src/store/use-workflow.ts（1312 / 1444 双写）
B.2.3 API            →  /api/track（接收新字段）、/api/admin/stats（返回新字段）
B.2.4 Admin / UI     →  admin 页面展示映射、qa-section 微调
B.2.5 Export         →  export-generator 补齐 reconstructionMeta 输出
Full Gate            →  vitest / tsc / eslint / build → tag → push
```

---

## 7. UI Mapping

**旧**：

```
Visual Similarity
92%
```

**新**：

```
Visual Quality        92%
Reconstruction Match  87%
```

| 字段 | 回答的问题 |
|---|---|
| Visual Quality | 做出来的页面质量如何 |
| Reconstruction Match | 像不像目标网站 |

**四种状态的展示口径**：

```
已测量      87%
未采集      Not measured
降级        Unavailable · Reason: <degradedReason>
历史数据    只显示可得的那一项，不推断另一项
```

**新旧混合数据**：只展示存在的字段，`similarity` 单独存在时按「质量分」口径展示（它的数据源就是质量分），
不得改标为还原度。

---

## 8. Explicitly Out of Scope（B.2 不做）

- ❌ 修改 reconstruction 算法 / 9 维权重
- ❌ 引入 pixel diff
- ❌ 触碰 Sprint A Layout Truth / `layout-probe` / `layout-cache`
- ❌ 删除 `similarity` 字段
- ❌ 变更数据库 schema 的破坏性迁移
- ❌ 修改营销页 mock 数据（`app/page.tsx`）与 `ModeSelector` 的「目标还原度」语义
  （两者不是评分，属于独立议题，另开）

---

## 9. Checkpoint

```
本文档
  ↓
用户 review 确认
  ↓
commit（docs:）
  ↓
push
  ↓
B.2.1 types migration
```
