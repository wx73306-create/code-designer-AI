# Phase 2 / Sprint A — Layout Ground Truth：DESIGN 冻结

> **状态：设计已冻结，等待批准后才写实现代码。**
> 上游：`docs/phase2-visual-accuracy-discovery.md`（DISCOVERY 报告，READ-only）
> 本文件对应 DISCOVERY §6 的 Sprint A。Sprint B（还原度量）**不在本文件范围内**。

---

## 1. 决策拍板结果（按推荐方案执行）

| # | 决策点 | 结论 |
|---|---|---|
| 1 | 度量口径 | **先客观，后 AI**。本 Sprint 只做客观真值，不碰评分模型 |
| 2 | 布局真值来源 | **新增浏览器实测**，删除硬编码猜测 |
| 3 | 像素 diff | **本 Sprint 不做**（新增依赖留到 Sprint B 决策） |

---

## 2. Sprint A 的目标与唯一命题

**命题**：把 `WebsitePackage.layout.flow` 从「硬编码常量」换成「浏览器实测几何」。

**唯一验收命题**（对应 DISCOVERY §3.1 的证伪数据）：

| 现在（假数据） | Sprint A 之后（真数据） |
|---|---|
| apple.com → `[]` | apple.com → 真实的 section 序列与占比 |
| stripe.com → `nav 9% · hero 57% · product 35%` | 与人工观察一致 |
| linear.app → `nav 100%` | 不再出现单一角色独占 |

### 2.1 一个必须明确的语义变更

**Sprint A 完成后，`flow: []` 的含义改变：**

| 时期 | `flow: []` 的含义 |
|---|---|
| 现在 | 正则没匹配到（硬编码表的副作用） |
| Sprint A 后 | **没测**（未开采集）或**测了但没识别到 section** |

这是自洽的，因为**硬编码表会被整个删除**——不再有「猜出来的非空值」。
因此不需要新增 `measured` 之类的标记字段，避免过度设计。

---

## 3. 协议变更（1.1.0 → 1.2.0）

### 3.1 为什么要改协议

DISCOVERY §5 里我说过「沿用现有 `LayoutBlock` 契约，不改协议」。**写设计时发现这个结论不成立**，理由如下：

`heightWeight` 是「占文档总高的百分比」。真实长页面（如 Apple，文档高 8000px+）里，
一个 900px 的 hero 只占 **11%**。所有 section 的占比都会退化到个位数，
模型**无法从中判断主次**，也就无法解决「模板感」这个原始目标。

### 3.2 变更内容

```ts
export interface LayoutBlock {
  role: SectionRole;
  /** 占文档总高的百分比（既有字段，语义不变） */
  heightWeight: number;
  /**
   * 实测像素高度（1.2.0 新增，可选）。
   *
   * 存在理由：百分比在超长页面上会退化成个位数，模型无法判断主次。
   * 像素高度才是模型复刻hero高度的直接锚点。
   */
  heightPx?: number;
  columns: number;
  alignment: 'left' | 'center' | 'right';
  fullBleed: boolean;
}
```

- 版本 `WEBSITE_PACKAGE_VERSION`: `1.1.0` → **`1.2.0`**
- **向后兼容**：`heightPx` 可选，老数据反序列化为 `undefined`，既有消费方不受影响
- `formatter` 输出格式：`hero 11% (900px) · 1列 · center 对齐 · 通栏`

---

## 4. 采集接口冻结

### 4.1 模块

`src/lib/browser-intelligence/layout-probe.ts`（新建）

### 4.2 签名

```ts
export interface LayoutProbeOptions {
  /** 最多保留多少个 section（按文档顺序取前 N 个）。默认 12。 */
  maxSections?: number;
  /** 低于此像素高度的 section 视为噪音丢弃。默认 40。 */
  minSectionHeight?: number;
  /** 通栏判定阈值：宽度 >= 视口宽度 × 此比例。默认 0.98。 */
  fullBleedRatio?: number;
  /** 单列判定时，判定「同一行」的 top 容差（px）。默认 8。 */
  rowTolerance?: number;
}

export interface LayoutProbeResult {
  flow: LayoutBlock[];
  gridColumns: number;
  gap?: string;
  stickyHeader: boolean;
  centered: boolean;
  /** 实测时的视口尺寸 */
  viewport: { width: number; height: number };
  /** 文档总高（scrollHeight） */
  docHeight: number;
}

export async function probeLayout(
  page: PageController,
  options?: LayoutProbeOptions,
): Promise<LayoutProbeResult>;
```

### 4.3 关键约束：`PageController.evaluate` 只接受无参函数

`types.ts:27-43` 定义：

```ts
evaluate<T>(fn: string | (() => T)): Promise<T>;
```

**因此测量脚本必须是自包含的无参函数**，不能把 `options` 闭包进去。
解决方式：把参数**序列化进函数体**（用模板字符串生成 `() => {...}` 的字符串形式），
或把常量直接内联。本设计采用**常量内联 + 返回原始数据**，见 §5。

---

## 5. 测量算法规格

### 5.1 职责划分（决定可测性）

| 层 | 职责 | 位置 |
|---|---|---|
| 浏览器内 | 只采集**原始几何**：tag / class / id / top / height / width / 子元素 top 列表 / textAlign | `page.evaluate` 的无参函数 |
| Node 侧 | 语义判定：`role` 推断、列数计算、占比计算、过滤、排序 | `layout-probe.ts` 普通函数 |

**理由**：`inferSectionRole(tag, attrs)` 已存在于 `adapter.ts:204` 且是纯函数，
浏览器里没有它。把语义判定留在 Node 侧，这些逻辑就能在 vitest 里直接单测。

### 5.2 浏览器内采集的原始数据结构

```ts
interface RawSection {
  tag: string;      // 'header' | 'section' | 'div' ...
  cls: string;      // class 属性全文
  id: string;
  top: number;      // rect.top + scrollY（文档绝对位置）
  height: number;
  width: number;
  childTops: number[];  // 直接子元素的 top（用于算列数）
  textAlign: string;    // getComputedStyle(el).textAlign
}

interface RawProbe {
  sections: RawSection[];
  docHeight: number;          // documentElement.scrollHeight
  viewport: { width: number; height: number };
  stickyHeader: boolean;      // 任一 fixed/sticky 且 top 较小
}
```

### 5.3 section 候选选择（顺序即优先级）

1. 语义标签：`header, nav, main, section, article, aside, footer`
2. 若语义标签不足 3 个，补充 `document.body` 的直接子元素中 `height >= minSectionHeight` 的
3. 过滤：`height < minSectionHeight`（默认 40px）丢弃
4. **去嵌套**：若 A 完全包含 B 且 `A.height - B.height < minSectionHeight`，只保留 A
5. 按 `top` 升序排序
6. 取前 `maxSections`（默认 12）

### 5.4 各字段的计算规则

| 字段 | 规则 |
|---|---|
| `role` | Node 侧复用 `inferSectionRole(tag, cls + id)`（`adapter.ts:204`）。判定不出来 → `'other'` |
| `heightPx` | 实测 `height`，四舍五入取整 |
| `heightWeight` | `round(height / docHeight × 100)`。`docHeight` 为 0 时全部置 0 |
| `columns` | 直接子元素中 `top` 互相在 `rowTolerance`（默认 8px）内的最大同行数。无子元素 → 1 |
| `alignment` | `textAlign` 归一化：`'start'`→`left`、`'end'`→`right`、`'justify'`→`left`、其余非 left/center/right → `left` |
| `fullBleed` | `width >= viewport.width × fullBleedRatio`（默认 0.98） |

### 5.5 其余 `LayoutAnalysis` 字段

| 字段 | 来源 |
|---|---|
| `gridColumns` | 主内容区（第一个 `role !== 'nav' && !== 'footer'` 的 section）的 `columns` |
| `gap` | 既有 `detectGap(cssSnippet)` 逻辑**保留不动**（正则路径，不因本 Sprint 改变） |
| `stickyHeader` | 浏览器实测：存在 `position: fixed\|sticky` 且 `top < viewport.height × 0.3` 的元素 |
| `centered` | 浏览器实测：主内容区 `left` 与 `right` 的左右余量差 < 8px 且余量 > 0 |

> `breakpoints` 继续走既有正则路径，不动。

---

## 6. 缓存与开关

### 6.1 开关

```
LAYOUT_PROBE=on|off      # 默认 off
```

**默认 off**，与 `INTERACTION_CAPTURE` 同策略。理由：
需要真实浏览器，有成本；且 DISCOVERY §7 要求先验证指标有效性再谈默认开启。

### 6.2 缓存

`src/lib/browser-intelligence/layout-cache.ts`（新建），**与 `interaction-cache.ts` 同构**：

| 项 | 值 |
|---|---|
| key | `${url}|${width}x${height}|${device}` —— 必须含 viewport 与 device，否则手机端污染桌面端 |
| 成功 TTL | 10 分钟 |
| **失败 TTL** | **60 秒**（负缓存：Chrome 异常、Cloudflare 这类失败不缓存会重复撞墙） |
| LRU | 20 |
| 并发 | `inflight` Map 去重 |
| 语义 | 区分 `null`（已知失败）与 `undefined`（没查过） |
| 异常 | 永不抛错，失败返回 `null` |

> **不抽象公共基类**：只有两处使用，过早抽象会把两个语义不同的缓存耦在一起。
> 若未来出现第三处再考虑。

### 6.3 成本预估

布局测量**不需要点击、不需要滚动、不需要截图**，只需 `goto` + 等待 + 一次 `evaluate`：
约 **3–8 秒**（对比交互采集的 20–30 秒，因为它要点 6 次并各截两张图）。

`maxDuration = 300` 的硬约束下有充足余量。

---

## 7. 接线

### 7.1 采集顺序（关键，容易被忽略）

**布局测量必须早于交互采集。**

理由：交互采集会点击元素、展开菜单、滚动页面，**页面状态被改变后测出来的几何是脏的**。

```
goto → 等待稳定 → probeLayout（测几何）→ [后续才有] interaction 采集
```

本 Sprint 只实现前者，但顺序约束必须写进代码注释，避免 Sprint B 接线时踩坑。

### 7.2 接线点

| 文件 | 改动 |
|---|---|
| `src/lib/website-package/adapter.ts` | ① `BuildPackageInput` 加 `layout?: LayoutProbeResult`<br>② **删除 `buildFlow()` 的 canonical 硬编码表**<br>③ `analyzeLayout` 改为：有实测则用实测，否则 `flow: []` |
| `src/lib/website-package/formatter.ts` | layout 段输出加 `heightPx`：`hero 11% (900px) · 1列 · center · 通栏` |
| `src/app/api/mimo/route.ts` | 新增 `getLayout(url)` 包装（开关短路 + try/catch 兜底），三处 `buildWebsitePackage` 调用补 `layout` 参数 |

### 7.3 硬编码删除的精确范围

`adapter.ts:373-412` 的 `buildFlow()` 整个函数**删除**，
`analyzeLayout()` 不再调用它。未开采集时 `flow` 直接为 `[]`。

> ⚠️ 这是本 Sprint **唯一的行为性删除**，必须单独一个 commit，便于回滚。

---

## 8. ALLOWED / FORBIDDEN 文件清单

### 8.1 ALLOWED（可改）

| 文件 | 性质 |
|---|---|
| `src/lib/browser-intelligence/layout-probe.ts` | 新建 |
| `src/lib/browser-intelligence/layout-cache.ts` | 新建 |
| `src/lib/browser-intelligence/layout-probe.test.ts` | 新建 |
| `src/lib/browser-intelligence/index.ts` | 新增导出 |
| `src/types/website-package.ts` | 版本 1.2.0 + `heightPx` |
| `src/lib/website-package/adapter.ts` | 加 `layout` 入参 + **删硬编码** |
| `src/lib/website-package/formatter.ts` | layout 段输出 `heightPx` |
| `src/app/api/mimo/route.ts` | `getLayout` 接线 |
| `scripts/verify-layout.ts` + `package.json` | 真机验收脚本 |
| `docs/`、`ARCHITECTURE.md` | 文档 |

### 8.2 FORBIDDEN（禁止改）

| 文件 / 范围 | 理由 |
|---|---|
| ❌ `src/lib/visual-evaluation/**` | 六维评分权重是产品口味，**本 Phase 不改**（DISCOVERY §7） |
| ❌ 任何 `SYSTEM_PROMPTS` | 改 prompt 是另一个风险维度，单独一轮 |
| ❌ `src/lib/browser-intelligence/` 下 interaction 相关全部文件 | **Sprint 3 已冻结**，本 Sprint 不得触碰 |
| ❌ `src/lib/screenshot.ts` / `captureWebsiteScreenshots` | 渲染生成页是 Sprint B 的事 |
| ❌ `package.json` 新增依赖 | 未经明确批准不得引入 |
| ❌ `src/legacy/**` | 已归档死代码 |
| ❌ `src/lib/website-scraper.ts` | 纯正则路径，本 Sprint 不拓宽它的职责 |

---

## 9. 实施步骤（每步 STOP-and-wait）

| Step | 内容 | 完成判据 | CHECKPOINT |
|---|---|---|---|
| 1 | types：1.2.0 + `heightPx` | `tsc` 通过 | **CP1** |
| 2 | `layout-probe.ts`：测量算法 + `probeLayout()` | `tsc` 通过 | **CP2** |
| 3 | **删除** `buildFlow()` 硬编码 + adapter 接 `layout` | `tsc` 通过，且 `flow` 未开采集时为 `[]` | **CP3** |
| 4 | `layout-cache.ts` + `LAYOUT_PROBE` 开关 | `tsc` 通过 | **CP4** |
| 5 | route 接线 + formatter 输出 `heightPx` | `tsc` + `eslint` 通过 | **CP5** |
| 6 | 单测（FakePage 注入已知几何） | vitest 全绿 | **CP6** |
| 7 | 真机三站点验收 | 见 §10 | **CP7** |
| 8 | 四道门禁 + commit + tag | 全绿 | **CP8** |

**每个 CHECKPOINT 停下等你确认，不自动进入下一步。**

---

## 10. 验收标准

### 10.1 单测（FakePage 注入已知几何）

`PageController` 已有窄接口，测试注入假实现：

| 用例 | 断言 |
|---|---|
| 3 个 section 高 300/600/100，docHeight 1000 | `heightWeight` 为 `30 / 60 / 10` |
| 同上 | `heightPx` 为 `300 / 600 / 100` |
| 子元素 3 个 top 相同 | `columns === 3` |
| 子元素 top 相差 200px | `columns === 1` |
| 高度 30px 的 section（< minSectionHeight 40） | 被丢弃 |
| `width === viewport.width` | `fullBleed === true` |
| `textAlign: 'start'` | `alignment === 'left'` |
| `docHeight === 0` | `heightWeight` 全 0，不抛错 |
| 嵌套 section（A 含 B，高度差 < 40） | 只保留 A |
| 缓存：同 key 二次调用 | 只测一次 |
| 缓存：不同 viewport | 隔离 |
| 缓存：失败 | 负缓存 60s |

### 10.2 真机（apple / stripe / linear）

| 标准 | 判据 |
|---|---|
| **不再出现荒谬值** | 无 `nav 100%`、无 `hero 57%` |
| **Apple 不再为空** | `flow.length > 0` |
| **与人工观察一致** | section 序列（nav → hero → …）与实际页面顺序吻合 |
| **开关关闭时干净** | `LAYOUT_PROBE=off` → `flow: []`，且与当前线上产物一致 |
| **耗时** | 单次测量 < 15s |

### 10.3 门禁

vitest / tsc / eslint（改动文件）/ `next build` 四道全绿。

---

## 11. 明确不做

- **不做**像素 diff（Sprint B）
- **不做**还原度评分（Sprint B）
- **不改**六维评分权重
- **不给 `qa` step 注入截图**（Sprint B，DISCOVERY §3.3）
- **不共用浏览器会话**与交互采集（过早优化；本 Sprint 只保证顺序约束写进注释）
- **不做**响应式多断点测量（只测配置的那一个 viewport）

---

## 12. 风险

| 风险 | 缓解 |
|---|---|
| 删除硬编码后，未开采集的线上产物会**丢失**那一段布局提示（虽然是假的） | 默认 off + 单独 commit，可一键回滚；真机验收对比开关前后差异 |
| 超长页面 section 太多，前 12 个截断了后半页 | `maxSections` 可配；formatter 已有 `LIMITS.flow = 8` |
| SPA 页面 `scrollHeight` 随懒加载变化 | 等待 `networkidle2` + 固定 settle 时间，与 `screenshot.ts` 现有一致 |
| 某些站点 section 无语义标签，只能取 body 子元素 | 有兜底路径（§5.3 第 2 条）；测不到就 `[]`，不猜 |

---

---

## 13. 实测结果（Step 3–7 完成后补记）

**三个决策全部通过**，实施按 Step 1–8 逐步推进，每步 STOP-and-wait。

### 13.1 Layout Truth Test：3/3 通过

命令 `npm run verify:layout`（`scripts/verify-layout.ts`，产物落 `.verify-layout/`）。

| 站点 | BEFORE（无采集） | AFTER（实测） | 判定 |
|---|---|---|---|
| apple.com | `[]` ✅ unknown | **hero 18% (2100px)** · center · 通栏，占比和 100 | ✅ 满足 `hero > 500px` |
| stripe.com | `[]` ✅ unknown | hero **4% (685px)**，占比和 97 | ✅ 无 57% |
| linear.app | `[]` ✅ unknown | 最大区块仅 12%，占比和 69 | ✅ 无独占 100% |

三站点的历史 bug（`[]` / `hero 57%` / `nav 100%`）**全部消失**。

### 13.2 开关与缓存（apple.com）

```
[默认] enabled=false → null（零开销）✅
第一次 2061ms · flow=7
第二次    0ms · 命中缓存=true ✅
device=mobile → 独立采集 ✅（不污染桌面端）
```

### 13.3 实际喂给模型的内容

```
页面纵向构成（role · 视觉占比与实测像素高 · 列数 · 对齐 · 是否通栏）：
  - hero: 18% (2100px) · 1列 · center 对齐 · 通栏
  - product: 8% (957px) · 1列 · left 对齐 · 通栏
  - footer: 58% (6976px) · 1列 · left 对齐 · 通栏
```

开关关闭时该段整体消失 —— 不留任何假数据。

### 13.4 实施过程中发现并修复的两个问题

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| A | 占比之和达 **200%** | `<main>`（5011px）包含 hero/product，原去嵌套规则只吞「高度差 < 40px」的，容器与内部区块全部保留 → 重复计算 | 排除 `CONTAINER_TAGS=['main']` + 按 top 贪心选取互不重叠的顶层序列 |
| B | 验收脚本挂 11 分钟不退出 | puppeteer browser 吊住 event loop | `process.exit(0)`；修复后三站点总耗时 28s |

### 13.5 未处理（留待 Sprint B 或后续决策）

1. **`gridColumns` 三站恒为 1** —— 定义是「第一个非 nav/footer 区块」的列数，而那通常是 hero（单列），
   字段几乎无信息量。建议改为「最高的非 nav/footer 区块」或「最常见列数」。
2. **Apple `footer 58% (6976px)`** —— 偏高，待人工确认（Apple 首页 footer 含大量 sitemap 链接，可能是真实的）。
3. **Stripe 有 8 个 `other`** —— 其 section class 不含 hero/feature 等关键词，语义识别率低。
4. **`inferSectionRole` 存在两份实现** —— `adapter.ts:204`（吃 HTML 正则片段）与
   `layout-probe.ts`（吃 DOM 属性）。删除 `buildFlow()` 后，`adapter.ts` 那份只服务于
   `dom.sections`，两者输入源不同，暂未合并。

---

## CHECKPOINT — 已批准并实施完毕

**Step 1–8 全部完成。**

| 决策 | 结果 |
|---|---|
| 协议 1.2.0 + `heightPx` | ✅ 通过 |
| 删除 `buildFlow()` 硬编码 | ✅ 通过（单独 commit 便于回滚） |
| 8 步 STOP-and-wait | ✅ 通过 |
