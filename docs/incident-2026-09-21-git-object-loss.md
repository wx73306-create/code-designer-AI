# 事故记录：本地 git 对象库损坏与恢复（2026-09-21）

> 本文是**取证记录**，不是操作手册。目的是让后来者知道：
> 本地 18 个 commit 的粒度已经永久丢失，现在仓库里的那一个「重建提交」是内容等价物，**不是**原始历史。

## 1. 现象

`git log` / `git status` / `git commit` 全部报：

```
fatal: not a git repository (or any of the parent directories): .git
```

## 2. 取证

`.git` 目录本身还在，但内容被挖空了一部分（bash `ls` 与 PowerShell `Get-ChildItem`
交叉验证，排除「只是工具没权限看」的可能）：

| 路径 | 状态 |
|---|---|
| `.git/refs/` | **整个目录消失**（`refs/heads`、`refs/tags`、packed-refs 全无） |
| `.git/objects/pack/*.pack` | **两个 pack 文件消失**，只留 `.idx` 与 `multi-pack-index` |
| `.git/objects/` 松散对象 | 只剩 7 个（tip commit + 4 tree + 1 blob + 1 游离 commit） |
| `.git/index` | 存在，但 cache-tree 指向已丢失的对象 → `invalid sha1 pointer` |
| `git count-objects -v` | `in-pack: 0`、`packs: 0` |

时间线（mtime）：最后 commit `23:48` → `qa-section.tsx` WIP `23:53` → `index` `23:55`，
**损坏发生在 23:55 之后**。原因未能确定：既像是被打断的 `git gc`/`repack`
（先删旧 pack 再落新 pack 的那类顺序），也可能是外部清理/杀软删除；
`.pack` 被删而 `.idx` 与 `multi-pack-index` 留存，是这个判断的主要依据。

## 3. 恢复过程（已执行）

1. 从 `.git/logs/refs/heads/main`（reflog 幸存）取回 tip 哈希 `34972e1`，临时重建 `refs/heads/main`
   → `git status` 恢复可用，确认未提交 WIP 为 `M src/components/sections/qa-section.tsx`。
2. **不做** orphan commit / re-init / 强制重建历史 —— 那会切断与远端的连续性。
3. 网络恢复后 `git fetch origin`：远端 `main = 9b11f4c`，**只有 3 个 commit（全是 README 类文档）**，
   说明 Sprint A/B 的本地 commit **从未 push**，远端救不回它们。
4. 清掉陈旧 `index`、`multi-pack-index`、两个孤儿 `.idx`（均已备份到工作区 backup 目录），
   以 `9b11f4c` 为基线 `git read-tree` 重建索引 —— **工作区文件零改动**。
5. 与 `9b11f4c` 比对出 89 项差异（34 M / 26 D / 29 ??），即自远端 tip 以来的全部工作，
   作为**一次重建提交**落地。

## 4. 永久丢失的 18 个 commit（reflog 原文，哈希已不可解析）

| # | 原哈希 | 提交信息 |
|---|---|---|
| 1 | `d248105` | refactor: archive dead agent orchestration to src/legacy/agents |
| 2 | `bf8ee42` | docs: add ARCHITECTURE.md as single source of truth for current pipeline |
| 3 | `26c7b61` | chore: exclude src/legacy from eslint (archived dead code) |
| 4 | `4f1c54d` | feat: Phase 1 Sprint 1 — Browser Intelligence Layer 接口冻结 + 滚动状态采集 |
| 5 | `adb43e8` | feat(browser): Phase 1 Sprint 2 — Interaction Explorer Layer |
| 6 | `242b56b` | feat(browser): Phase 1 Sprint 3 — 让 AI Agent 真正消费交互采集数据 |
| 7 | `b57f789` | feat(types): WebsitePackage v1.2.0 — LayoutBlock 新增实测像素高度 |
| 8 | `fc72fc2` | feat(browser): layout-probe — 浏览器实测页面几何 |
| 9 | `c4422db` | refactor(website-package): 删除 buildFlow() 硬编码，布局改为实测或 unknown |
| 10 | `26009c2` | feat(browser): layout-cache + LAYOUT_PROBE 开关 + route/formatter 接线 |
| 11 | `49b23ec` | docs: Phase 2 Sprint A — 布局真值验收脚本与设计文档 |
| 12 | `cbc9e09` | docs: Phase 2 Sprint B — DISCOVERY 报告与 DESIGN 冻结文档 |
| 13 | `d5f471c` | feat(types): Sprint B Step 1 — 冻结还原度度量契约 |
| 14 | `3f96718` | feat(render-preview): Sprint B Step 2 — renderHtmlScreenshot() 渲染与降级检测 |
| 15 | `c88dd71` | feat(reconstruction): Sprint B Step 3 — Original/Clone 双截图链路 |
| 16 | `5fe8ed5` | feat(diff): Sprint B Step 4 — 三层结构化还原度 diff |
| 17 | `b8c5ae1` | feat(reconstruction): Sprint B Step 5 — 完整编排与 QA 接入 |
| 18 | `34972e1` | test(reconstruction): Sprint B Step 6 — 决定性证据 quality ≠ reconstruction |

同批丢失的还有两个 tag：`v0.9.0-layout-ground-truth`、`v0.10.0-reconstruction-diff`
（它们指向的对象已不存在，**未**在新提交上重新打同名 tag —— 那会伪造历史）。

## 5. 教训 / 后续

- **本地 commit 必须及时 push**：这次丢的全部是「只在本地存在」的工作。
- 出现 `fatal: not a git repository` 但 `.git` 目录还在时，**先别 `git init`** ——
  先查 `refs/` 与 `objects/pack/*.pack` 是否还在；reflog（`.git/logs/`）通常是最后幸存的证据。
- 若日后要按模块重切这次的重建提交，可用 `git reset --soft HEAD~1` 后分组再提交；
  但**不要**照抄上表伪造 18 个等价 commit —— 树对象已不在，那不是恢复，是编造。
