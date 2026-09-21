# Sprint 2 — Interaction Explorer Layer 设计（接口已冻结）

> 状态：**接口已冻结**（`src/lib/browser-intelligence/types.ts` 的 Sprint 2 段）
> 基线：v0.6.0-browser-foundation
> 上游设计：docs/phase1-browser-intelligence.md

---

## 0. 改名：不叫 click-explorer，叫 Interaction Explorer Layer

未来不止点击，还有 hover / expand / tab switch / dropdown / modal / accordion。
模块名若写死 `click`，后续每加一种交互就要改一次命名。

```
src/lib/browser-intelligence/
├── element-detector.ts      候选交互元素提取（Sprint 2）
├── interaction-policy.ts    风险分级与放行判定（Sprint 2）
├── click-explorer.ts        点击执行 + 状态恢复（Sprint 2）
├── state-diff.ts            前后状态比对（Sprint 2）
├── interaction-recorder.ts  汇总 + 导出 interaction.json（Sprint 2）
└── types.ts                 ★ 冻结接口
```

---

## 1. 流程：发现 → 判定 → 截图 → 点击 → 稳定 → 截图 → **恢复** → 记录

```
DOM
 ↓ element-detector
候选元素（button / a[href] / [role=button] / [role=tab] / [aria-expanded] / summary / select）
 ↓ interaction-policy
风险分级（SAFE / CAUTION / BLOCKED），BLOCKED 直接丢弃
 ↓ click-explorer
  ├─ 截图 before
  ├─ 采集 before 快照（state-diff 用）
  ├─ 点击
  ├─ 等待稳定（防动画中途采样）
  ├─ 截图 after + 采集 after 快照
  ├─ state-diff → ChangeRecord[]
  └─ 恢复页面（★ 关键）
 ↓ interaction-recorder
interaction.json
```

### 为什么「恢复页面」是必须的

不恢复的话，第一个点击把菜单展开后，后续候选元素都在「已展开」的错误状态下
被点击，采到的第二、第三个交互全是**脏数据**。

恢复策略按序尝试，记录实际生效的那一种：

| 方法 | 适用 | 说明 |
|---|---|---|
| `re-click` | toggle 类（菜单/手风琴） | 再点一次收起，最快 |
| `escape` | modal / 浮层 | 按 ESC |
| `history-back` | 导航类（真的跳走了） | 后退 |
| `reload` | 兜底 | 最慢但一定有效 |

---

## 2. element-detector

候选 selector（按优先级）：

```
button, a[href], [role=button], [role=tab], [aria-expanded], summary, select
```

输出 `DetectedElement`：

```ts
{
  id: 'element-001',
  type: 'menu',                    // nav|tab|menu|dropdown|accordion|modal-trigger|button|link|select|unknown
  text: 'Products',
  selector: 'header button.menu',
  position: { x: 1200, y: 40 },
  visible: true,
  ariaExpanded: false,
  risk: 'SAFE',
  riskReason: 'nav-allowlist'
}
```

`type` 推断优先级：`aria-expanded` → menu/accordion；`role=tab` → tab；
`aria-haspopup` → dropdown；`summary` → accordion；`select` → select；
在 `header nav` 内 → nav；其余 → button/link。

**DOM 查询在浏览器里执行，筛选与分级在 Node 侧**——这样分级逻辑可单测。

---

## 3. interaction-policy — 风险分级

```ts
type RiskLevel = 'SAFE' | 'CAUTION' | 'BLOCKED';
```

> 用字符串联合而非 TS `enum`：InteractionPackage 必须可 JSON 序列化，
> enum 编译后是数字，写进 `interaction.json` 会变成无意义的 `2`。
> 常量对象 `RISK` 提供等价书写便利。

| 元素 | 等级 | 依据 |
|---|---|---|
| 导航 | SAFE | 位于 `header nav` / 白名单 |
| Tab | SAFE | `[role=tab]` |
| 菜单 | SAFE | `aria-expanded` + 白名单 |
| 搜索 | CAUTION | 可能跳转，需 history-back 恢复 |
| 登录 / 注册 | BLOCKED | 文本黑名单 |
| 支付 / 购买 / 删除 / 提交 / 退出 | BLOCKED | 文本黑名单 |

**判定顺序（先严后宽）**：
1. 文本黑名单命中 → `BLOCKED`
2. selector 黑名单命中（footer / 外链 / 表单 submit / 社交 / cookie）→ `BLOCKED`
3. 白名单命中 + 类型为 nav/tab/menu → `SAFE`
4. 会跳走的链接（`href` 指向外域） → `CAUTION`
5. 其余 → `CAUTION`（宁可不点）

只有 `SAFE` 与 `CAUTION` 会被点击；`BLOCKED` 记录 `blocked` 原因后跳过。

---

## 4. state-diff

不只截图，要**判断点击产生了什么变化**。`StateSnapshot` 采集一批元素的
`visible / opacity / display / transform / rect`，前后比对得出 `ChangeRecord[]`：

| 变化 | 判定 | 输出示例 |
|---|---|---|
| `dom-added` | after 有、before 无 | `{ type:'dom-added', target:'.dropdown' }` |
| `visibility` | `visible` false→true | `change: 'hidden→visible'` |
| `opacity` | opacity 值变化 | `detail: { opacity: '0→1' }` |
| `transform` | transform 变化 | `detail: { transform: 'translateY(-8px)→none' }` |
| `position` | rect 位移超过阈值 | `change: 'y 40→72'` |
| `dom-removed` | before 有、after 无 | — |

**阈值**：opacity 差 < 0.05 忽略；位移 < 4px 忽略——避免把亚像素抖动也记成动画。

这份输出是 Sprint 3 给 GSAP Agent 的直接输入：`properties` 决定该用
transform（GPU 友好）还是 layout 属性（昂贵）。

---

## 5. interaction.json 最终结构

```json
{
  "url": "",
  "capturedAt": "",
  "states": [ { "stateId": "state-001", "screenshot": {...} } ],
  "events": [
    {
      "id": "click-001",
      "type": "click",
      "target": { "text": "Products", "selector": ".nav a", "kind": "nav" },
      "before": "state-001",
      "after": "state-002",
      "changes": ["menu-visible"]
    }
  ],
  "meta": { "screenshotCount": 8, "degraded": null }
}
```

### 与 WebsitePackage 内部契约的关系（重要）

有两套结构不是重复设计：

- **`InteractionPackage`**（写入 `WebsitePackage.interaction`）——内部契约，
  字段齐全、含完整截图对象，供 Agent 直接消费；
- **`InteractionExport`**（落盘 `interaction.json`）——交付格式，
  用 **stateId 引用**替代内联截图，避免文件体积爆炸。

由 `interaction-recorder` 做一次转换，下游 Agent 只需理解一套。

---

## 6. 验收标准

| 站点 | 测什么 |
|---|---|
| apple.com | 导航展开 / 产品菜单 |
| linear.app | dropdown / hover |
| stripe.com | tab 切换 |

成功标准：输入 `https://apple.com`，输出 `screenshots/` + `states/` +
`interaction.json`，其中**至少 3-5 个有效交互**
（有效 = 有 after 截图 `changed: true` 且 `changes` 非空）。

复现方式（真机脚本，产物落在 `.verify/<host>/`）：

```bash
npm run verify:interaction -- https://apple.com https://linear.app https://stripe.com
```

### 6.1 实测结果

| 站点 | 候选 | 拦截 | 点击 | 有效交互 | 动画 | 状态 | 耗时 |
|---|---|---|---|---|---|---|---|
| apple.com | 101 | 40 | 6 | **6** | 6 | 20 | 20.8s |
| linear.app | 109 | 27 | 6 | **3** | 3 | 20 | 27.2s |
| stripe.com | 78 | 14 | 6 | **6** | 6 | 20 | 31.7s |

三个站点全部达标（要求 ≥3）。`linear.app` 只有 3/6 有效是**真实数据**而非缺陷：
它的导航菜单由 hover 触发（Base UI navigation menu），点击不产生状态变化，
如实记录为 `changed: false` —— 这正是「宁可少采也不造数据」的取舍。

采到的交互示例：

```
apple.com   #globalnav-menubutton-link-store  "Store menu"   element-added,menu-visible,slide
stripe.com  button.hds-button.hds-navigation-menu__trigger  "解决方案"  slide,menu-visible
linear.app  button.m-yS4G_trigger.S36ykG_root  "Linear"      slide
```

### 6.2 真机才发现、单测无法暴露的四个坑

单测里的 `PageController` 是假实现，以下四类问题只有连真实浏览器访问真实站点才
会暴露（Sprint 1 的 sticky header 已经是第一次教训）：

| # | 现象 | 根因 | 修法 |
|---|---|---|---|
| 1 | 101 个候选只拦下 1 个 | `excludeSelectors` 里的 `footer a` 永远匹配不到 —— detector 生成的 selector 优先用 `#id` / `tag.class`，不含祖先信息 | `DetectedElement` 增加 `region` 字段，由扫描时的 `closest('footer')` 判定，policy 里优先于 selector 黑名单 |
| 2 | 6 个有效交互只产出 1 条 animation | Apple 的 mega-menu 只报 `dom-added/removed`，而 `extractAnimatedProperties` 只映射 opacity/transform/visibility | `dom-added/removed` 映射为 `visibility` |
| 3 | `before: state-001` 是悬空引用 | 只把「产生了变化」的 after 状态注册进 `states[]` | before / after 一律注册 |
| 4 | linear.app 采到 `#base-ui-_R_3apaki1lqiplei_` | React `useId` / Base UI 每次渲染生成新 id，写进 interaction.json 后无法复现 | 生成态 id 跳过，退化到 `tag.class` |

另：`Apple` 的菜单按钮没有 `textContent`（文案在 `aria-label` 里），扫描脚本已
增加 `aria-label` 回退，否则 `target.text` 全为空串。

### 6.3 两个会挂死 / 静默失效的引擎层缺陷

| # | 现象 | 根因 | 修法 |
|---|---|---|---|
| 5 | linear.app 采集挂死 20 分钟 | 点击触发导航会销毁执行上下文，此时 `evaluate` 既不返回也不报错 | 单个元素的「点击 + 恢复」加 20s 超时，超时走降级分支并强制恢复 |
| 6 | 回源逻辑从来没生效过 | `adaptPuppeteerPage` 把 `url` 当成构造时捕获的常量，页面导航后 `page.url` 永不更新 → `sameOrigin()` 恒为真 → 跳走后不会 `goto` 回源 | `url` 改成 getter，活读 `page.url()` |

第 6 条最危险：**它不报错、不挂死，只是让后续点击全部跑在错误的页面上**，
产出的数据看起来正常但全是脏的。

---

## 7. 完成后各 Agent 得到什么

| Agent | 之前 | 之后 |
|---|---|---|
| Vision | 截图 | 截图 + DOM + 交互状态 |
| Planning | — | `{ component: 'Navbar', states: ['default','open'], interaction: 'click menu' }` |
| Code | 静态 `<button>` | `<button onClick={() => setOpen(true)}>` |
| Animation | CSS 猜测 | `menu-open → GSAP timeline (opacity, translateY)` |

---

## 8. 明确不做

- **hover**：Sprint 2 只做 click。hover 需要额外的 mouse 模拟与移出恢复，留到后续。
- **像素级 diff**：用 DOM/样式快照比对，不引入像素 diff 依赖。
- **表单输入**：不填任何输入框，避免副作用。
- **跨页面导航**：只在 `history-back` 能恢复的前提下允许，且标记为 CAUTION。
