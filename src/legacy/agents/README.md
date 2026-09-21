# ⚠️ 归档代码（dead code）— 请勿直接复用

本目录是**历史遗留的旧 Agent 编排实现**，已于 2026-09-20 从 `src/lib/agents/`
整体归档到这里。**当前线上链路完全不经过本目录的任何代码。**

## 为什么还留着，而不是删掉

- 保留可追溯的设计意图（旧的多 Agent 编排思路、字段约定）。
- 其中的文本 Prompt 仍有参考价值，后续增强 Vision / Planning 时可能回抄片段。
- 直接删除会让 `git log` 断链；归档后 `git log --follow` 仍可追溯原始提交。

## 为什么不能用（关键）

`captureAgent.ts` 对采集数据的字段假设**与真实结构不符**，历史上从未被真正接线，
所以这些错误一直没被发现：

| 字段 | captureAgent 的假设 | `ScrapedDesignData` 的真实结构 |
|---|---|---|
| `colors` | `string[]` | `{ value, context }[]` |
| `spacing` | 对象 | `string[]` |
| `cssVariables` | 存在 | **不存在** |

正确实现请见 `src/lib/website-package/adapter.ts`（`buildWebsitePackage()`），
它由 `src/lib/website-package/adapter.test.ts` 的 17 项测试覆盖，其中 3 项是针对
上表缺陷的回归测试。

## 引用关系（归档前的实况）

```
pipeline.ts  ──► captureAgent.ts
             ──► visionAgent.ts
             ──► reviewAgent.ts
             ──► optimizeAgent.ts
             ──► types.ts
designMemoryAgent.ts  ──► （零引用，连 pipeline 都没用它）
```

`pipeline.ts` **没有任何外部调用方**（`src/app/api/mimo/route.ts` 才是真实链路，
编排逻辑在 `src/store/use-workflow.ts` 的 `runWorkflow()`）。

> 注：`src/app/admin/settings/page.tsx` 里的 `"pipeline"` 是后台 UI 的 tab 名称，
> 与 `pipeline.ts` 无关，不是引用。

## 类型检查

`src/legacy` 已加入 `tsconfig.json` 的 `exclude`。理由：归档代码**不参与类型检查、
不需要维护**，且其内部的相对 import（`../website-scraper`、`../prompts/*`）是按旧的
`src/lib/agents/` 位置写的，修路径等于无谓地"复活"依赖。

代价：本目录的代码质量不再受 tsc 保护——这是刻意接受的，因为它本来就不该被用。
真要复活，请先把它移回 `src/` 并修正 import。

## 文件清单

| 文件 | 状态 |
|---|---|
| `pipeline.ts` | 旧编排入口，零调用方 |
| `captureAgent.ts` | 字段假设错误，不可复用 |
| `visionAgent.ts` / `reviewAgent.ts` / `optimizeAgent.ts` | 仅被 pipeline 引用 |
| `designMemoryAgent.ts` | 零引用 |
| `types.ts` | 已改为 re-export `src/types/website-package.ts`，仅为让旧文件能编译 |

## 复活条件

若要重新启用，必须：
1. 修正 `captureAgent.ts` 的字段假设（或彻底改用 `buildWebsitePackage()`）；
2. 补测试，且测试要能覆盖上表的三处历史缺陷；
3. 明确它与 `runWorkflow()` 的分工，避免出现「两个 pipeline」的认知歧义。
