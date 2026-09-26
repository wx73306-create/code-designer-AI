# P3-06 · `animation_score` 兼容说明（书面）

> **本文就是执行计划书 Phase 3 DoD 里那句「或有书面兼容说明」的兑现物。**
>
> 结论先说：**我们没有把 `animation_score` 做进 0–100 的六维加权总分，而且这是有意的。
> 动效质量被单独采集、单独归档、并被显式暴露，但**没有**被静默改写成别的维度。**
> 下面把「为什么」和「那动效到底测没测」两件事讲清楚。

---

## 1. 事实对照

执行计划书 §八 列出的评价指标（原文，无空格连排）：

```
layout_score  visual_balance  spacing_score  color_score  typography_score  animation_score
```

代码里实际实现的是（`src/types/agent.ts` → `VisualScoreDimensions`，`src/lib/visual-evaluation/scoring.ts` → `DIMENSION_WEIGHTS`）：

| 维度 | 权重 | 计划书里有吗 |
|---|---:|---|
| `layout_score` 布局 | 20% | ✅ 有 |
| `visual_balance` 视觉平衡 | 15% | ✅ 有 |
| `spacing_score` 空间 | 15% | ✅ 有 |
| `color_score` 颜色 | 15% | ✅ 有 |
| `typography_score` 字体 | 15% | ✅ 有 |
| **`premium_score` 高级感** | **20%** ⭐ | ❌ 计划书没写 |
| **`animation_score`** | **—** | ✅ 计划书要求，**未进权重表** |

⇒ 缺口是**真实的**，不是文档笔误：计划书要的第六维是动效，权重表里的第六维是高级感。
两者恰好都在「第六个位置」，容易被误当成一回事 —— 本文的主要目的就是阻止这个误判。

---

## 2. 为什么**不**直接把 `premium_score` 改名为 `animation_score`

三个独立理由，任意一个单独成立就足以否决改名：

### 2.1 语义不同，改名等于**跨义合并**（这是最关键的一条）

- `premium_score` 度量的是**整页气质**：像不像 Apple / Tesla / Linear / Stripe 的水准
  （见 `src/lib/visual-evaluation/prompt.ts`：留白、真实图片、统一字体、克制颜色、模板感扣分）。
- `animation_score` 要度量的是**动效正确性**：过渡曲线、滚动联动、状态回馈是否还原。

这两件事**可以一个 95 一个 20 同时存在**：静态截图极精致的页面可能滚动动效完全生硬。
把它们合并成一个数，正是本项目刚修完的那类缺陷的同型复发 ——
修复前 `normalizeVisualScore` 会把模型给的 `visualFidelity` / `hierarchy` 分类**静默改写成** `premium`，
结果「字体问题」被记成「高级感问题」（详见 `src/lib/visual-evaluation/report.ts` 文件头）。
**把「改名」当成「补维度」，就是把同一个错误再犯一次。**

### 2.2 改名会作废全部历史样本

`qualityScore` 是六维**加权和**，由服务端权威写入 `generations.qualityScore` 并驱动 B.2 双分契约迁移的
观察期闸门（覆盖率 / 漂移）。改一个维度的语义，等于宣布此前所有样本的分数含义变了 ——
但它们在库里**长得一模一样**，无法事后区分。这正是 B.2.4.3「假数据比没数据更危险」要防的事。

### 2.3 本轮约束

QA 权重表本轮**冻结**（不改权重、不改指标字典）。因此本轮的正确动作是**说明**，不是**改分**。

---

## 3. 所以动效到底测了没有？—— 测了，四层都是实测

「没进加权总分」≠「没测」。真实情况是动效有独立的采集与产物链路：

| 层 | 位置 | 产出 |
|---|---|---|
| ① 采集 | `src/lib/browser-intelligence/interaction-cache.ts`（`INTERACTION_CAPTURE=on`） | 真实浏览器里采滚动 / 点击 / 状态 / 动画四类事实 |
| ② 契约 | `WebsitePackage.interaction`（schema 1.3.0，`interactionPackage`） | 结构化的 `{scrolls, clicks, states, animations, meta}` |
| ③ 归档 | `runs/<jobId>/website-package/interaction/` | 动效证据**落盘**（仅在真的有内容时创建该目录） |
| ④ 生成 | `src/lib/animation/`（`ANIMATION_SYSTEM_PROMPT` + `gsap-rules`） | 独立的**动效还原 Agent**（即计划书 C3 约束） |

另外，**模型自己在 qa 步骤就给出了动效评分**。它的真实输出形状是 8 维：

```json
{
  "scores": { "visualFidelity":78, "layout":70, "hierarchy":75, "typography":68,
              "color":78, "spacing":72, "interaction":80, "premium":65 },
  "totalScore": 71,
  "problems": [ { "category": "interaction", "severity": "minor", "priority": "P2", ... } ]
}
```

注意 `interaction: 80` —— 模型已经在打这个分，`problems[].category` 里也已经出现 `interaction`。
**缺的是契约里的一个位置，不是一次测量。** 我们的处理是：

- 不把它塞进 `premium_score`（跨义）；
- 不新增第七维（权重冻结）；
- 而是让它在 QA 报告里**显式可见** —— `QaReport.unmatchedCategories` 会列出
  `visualFidelity` / `hierarchy` / `interaction`，`qa-report.md` 里有专门的「⚠️ 契约盲区」小节。

⇒ 从「静默改写」变成「明写在案」。这是本轮能给出的、不撒谎的最大改进。

---

## 4. 已知风险与后续动作（登记在案，不假装不存在）

**风险：** 因为动效不在加权总分里，一个「静态极美、动效崩坏」的页面仍可能拿到高分。
分数不会自己暴露这个问题。

**当前缓解：**

1. `qa-report.md` 的「契约盲区」小节会点名 `interaction` 是否出现、出现几次；
2. `QaReport.problems` 保留模型给的 `severity` / `priority` / `reason` / `solution`（不压扁），
   动效问题会带着 `P0/P1` 优先级原样呈现；
3. 动效事实在 `runs/<jobId>/website-package/interaction/` 里可复算，不依赖模型自述。

**建议的后续（需要单独立项，本轮不做）：**

- 把 `interaction` 提升为第七维 `animation_score`，同时**重新配平七维权重**并在迁移文档里
  写清「哪一批样本属于六维时代」——否则又是一次不可区分的分数语义变更；
- 或在 `QaReport` 上增设 `motionVerdict`（独立于 0–100 总分的动效结论），
  让「总分 88 / 动效待修」这种组合成为一等公民。

---

## 5. 复现方式

```bash
# 1) 看模型真实输出里有没有 interaction 维度与分类
grep -o 'interaction[^,]*' .b2verify/run20*.log | head

# 2) 看契约盲区是否被显式列出（不落盘也能在日志里取到）
docker logs cda-app --since 30m 2>&1 | grep '\[QA-REPORT\]' | tail -1
```

参见：`src/lib/visual-evaluation/report.ts`（`CATEGORY_TO_DIMENSION` 刻意留空的三个键）、
`src/lib/visual-evaluation/report.test.ts`（锁死「不硬塞」语义的用例）、
`docs/execution-task-breakdown.md`（P3-06 条目）。
