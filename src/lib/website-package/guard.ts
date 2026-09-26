/**
 * 步骤级数据包闸门（C2 / P1-16 / P1-18）
 * ===================================================================
 * 解决的具体问题：`formatPackageContext(null)` 直接 `return ''`（formatter.ts:69）。
 * 于是一个**空壳包**或**违约包**在链路上与合法包长得完全一样 —— 提示词悄悄少了
 * 全部设计依据，模型开始凭空发挥，而日志里没有任何异常。用户看到的是「生成质量
 * 不稳定」，而不是「这一步根本没拿到数据」。
 *
 * 本模块把「包好不好」变成一条**可观测、可分级的**判断，并与步骤绑定：
 *
 *   · 契约违约（结构不对）  ⇒ `ok: false`。这是**代码缺陷**，不是数据问题，
 *     必须拒绝执行 —— 否则我们在用坏数据喂模型并把它当正常结果。
 *   · 契约合法但空壳       ⇒ `ok: true` + 显著告警。**不能阻断**：有些站点
 *     确实采不到色值（纯图/纯 canvas），那是合理现实，不是错误。
 *   · 正常                 ⇒ 记录「本轮实际注入了哪些块」，供 P1-18 的
 *     「日志显示使用了 dom/layout/design_tokens」验收取证。
 */

import {
  describeValidationErrors,
  inspectWebsitePackage,
  type PackageHealth,
} from '@/lib/schemas';
import type { WebsitePackage } from '@/types/website-package';

/** 消费数据包的步骤。`code` 是 C2 指定的强制入口。 */
export type PackageGateStep = 'planning' | 'code' | 'animation';

export interface PackageGateResult {
  /** 契约是否合法。false ⇒ 调用方应拒绝执行该步骤。 */
  ok: boolean;
  health: PackageHealth;
  /** 人读原因摘要（用于日志与错误响应）。 */
  reason: string;
  /** 本轮真正注入了提示词的块名（P1-18 取证用）。 */
  injectedBlocks: string[];
}

/**
 * 「空维度 key → 日志里对模型可见的块名」映射。
 *
 * key 必须与 {@link inspectWebsitePackage} 的 `emptyParts` 用词严格一致；
 * value 是**人读的块名**（`design_tokens.colors` 而不是 `styles.colors`，
 * 因为提示词里就是 Design Tokens 段，日志应该用下游看得懂的名字）。
 */
const BLOCK_LABELS: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ['screenshots', 'screenshots'],
  ['assets', 'assets'],
  ['dom.sections', 'dom'],
  ['styles.colors', 'design_tokens.colors'],
  ['styles.fonts', 'design_tokens.fonts'],
  ['layout.flow', 'layout'],
  ['animations', 'animations'],
  ['metadata.title', 'metadata'],
]);

/**
 * 判定某个步骤拿到的包能不能用。
 *
 * @param pkg  待判定的包（`buildWebsitePackage()` 的输出，或来自缓存/JSON 的任意值）
 * @param step 消费步骤，仅用于日志前缀
 */
export function gatePackageForStep(pkg: unknown, step: PackageGateStep): PackageGateResult {
  const health = inspectWebsitePackage(pkg);

  // 标签映射是**唯一来源**：不要为「全非空」另写一份硬编码列表 —— 那会让两条
  // 分支的日志用词悄悄漂移（aria: 曾经一分支写 styles、另一分支写 design_tokens.colors）。
  const injectedBlocks = BLOCK_LABELS
    .filter(([key]) => !health.emptyParts.includes(key))
    .map(([, label]) => label);

  if (!health.ok) {
    const reason =
      `数据包违反 WebsitePackage 契约（${health.errors.length} 处）—— 这是代码缺陷，` +
      `拒绝在损坏的输入上继续生成：\n${describeValidationErrors(health.errors)}`;
    console.error(`[PackageGate:${step}] ${reason}`);
    return { ok: false, health, reason, injectedBlocks };
  }

  if (!health.substantive) {
    // 合法但空壳：必须显著，但不能阻断（有些站点客观采不到色值）
    console.warn(
      `[PackageGate:${step}] ⚠️ 数据包契约合法但**无可用于还原的内容**；` +
        `以下块为空，模型将缺少设计依据：${health.emptyParts.join(', ')}`,
    );
    return {
      ok: true,
      health,
      reason: `空壳包（空块：${health.emptyParts.join(', ')}）`,
      injectedBlocks: [],
    };
  }

  // 正常路径：记录「确实用了哪些块」—— P1-18 的验收证据就是这一行
  console.log(
    `[PackageGate:${step}] ✅ 已注入数据包块：${injectedBlocks.join(', ') || '(none)'}` +
      (health.emptyParts.length ? ` | 空块：${health.emptyParts.join(', ')}` : ''),
  );
  return {
    ok: true,
    health,
    reason: `注入 ${injectedBlocks.length} 个块`,
    injectedBlocks,
  };
}

/**
 * 便捷包装：判定并返回「可安全传给 formatter 的包」或 `null`。
 *
 * 契约违约时返回 `null` 并已在 {@link gatePackageForStep} 内记日志；
 * 调用方可据此走拒绝分支，而不是把坏包喂给 `formatPackageContext`。
 */
export function packageForPrompt(
  pkg: unknown,
  step: PackageGateStep,
): { text: WebsitePackage | null; gate: PackageGateResult } {
  const gate = gatePackageForStep(pkg, step);
  return { text: gate.ok ? (pkg as WebsitePackage) : null, gate };
}
