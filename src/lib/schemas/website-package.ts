/**
 * WebsitePackage 契约校验（C1 的执行者）
 * ===================================================================
 * 执行计划书 §执行注意事项 4：「所有模块之间使用 JSON Schema 通信」。
 * 此前这条只是**口头约定** —— 类型系统在编译期约束了 TS 代码，但
 *   1. 采集产物落盘/跨进程传递时是 JSON，编译期类型完全失效；
 *   2. 账本、缓存、埋点里的包可能是老版本或手工拼的；
 *   3. 「空包/半包」在运行时与合法包长得一样，只会静默产出低质量结果。
 * 本模块把那条约定变成**可执行的检查点**。
 *
 * 用法分两档，刻意不合并：
 *   · {@link validateWebsitePackage} —— 只判定，不抛错。用于埋点、落盘、诊断等
 *     「宁可降级也不要阻断」的路径。
 *   · {@link assertValidWebsitePackage} —— 判定失败即抛 {@link PackageValidationError}。
 *     用于 C2 要求的强制入口（代码生成必须拿到合法数据包）。
 */

import type { WebsitePackage } from '@/types/website-package';
import { validateAgainstSchema, type SchemaError } from './json-schema';
import websitePackageSchema from './website-package.schema.json';

/** 契约 schema（draft 2020-12）。导出供落盘归档与外部消费方复用。 */
export const WEBSITE_PACKAGE_SCHEMA = websitePackageSchema as Record<string, unknown>;

/** 契约要求的顶层必填字段 —— 与 schema 的 `required` 同源，供测试断言二者不漂移。 */
export const WEBSITE_PACKAGE_REQUIRED_KEYS: readonly string[] = Object.freeze(
  (websitePackageSchema.required ?? []) as string[],
);

export interface PackageValidationOk {
  ok: true;
  errors: [];
}

export interface PackageValidationFail {
  ok: false;
  errors: SchemaError[];
}

export type PackageValidationResult = PackageValidationOk | PackageValidationFail;

/** 契约校验失败。`errors` 保留结构化路径，`message` 为人读摘要。 */
export class PackageValidationError extends Error {
  readonly errors: SchemaError[];

  constructor(errors: SchemaError[], context = 'WebsitePackage') {
    super(`${context} 未通过契约校验（${errors.length} 处）：\n${describeValidationErrors(errors)}`);
    this.name = 'PackageValidationError';
    this.errors = errors;
  }
}

/** 把结构化错误渲染成多行文本；超过 {@link MAX_REPORTED} 条时截断并注明总数。 */
export const MAX_REPORTED = 12;

export function describeValidationErrors(errors: SchemaError[], max = MAX_REPORTED): string {
  const head = errors.slice(0, max).map((e) => `  - ${e.path}: ${e.message}`);
  if (errors.length > max) head.push(`  … 另有 ${errors.length - max} 处（共 ${errors.length} 处）`);
  return head.join('\n');
}

/**
 * 校验任意值是否为合法的 WebsitePackage。
 *
 * 刻意接受 `unknown` 而不是 `WebsitePackage`：调用点的输入本来就来自
 * JSON.parse / 缓存 / 埋点，把它们断言成 WebsitePackage 正是问题本身。
 */
export function validateWebsitePackage(input: unknown): PackageValidationResult {
  const errors = validateAgainstSchema(input, WEBSITE_PACKAGE_SCHEMA);
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

/**
 * 强制校验：失败即抛。用于 C2「代码生成必须输入 Intelligence Package」的入口。
 *
 * 泛型返回值让调用点拿到收窄后的类型，避免在强制校验后还要再断言一次。
 */
export function assertValidWebsitePackage(input: unknown, context?: string): WebsitePackage {
  const result = validateWebsitePackage(input);
  if (!result.ok) throw new PackageValidationError(result.errors, context);
  return input as WebsitePackage;
}

/**
 * 宽松体检：把「包是否为空壳」与「是否违反契约」分开报告。
 *
 * 空包**不违反** schema（`createEmptyPackage()` 是合法包），但它对下游
 * 毫无价值 —— 这正是 formatter 静默返回空提示词、模型凭空发挥的成因。
 * 所以调用方需要两个独立信号：`ok`（契约）与 `substantive`（有没有料）。
 */
export interface PackageHealth {
  ok: boolean;
  errors: SchemaError[];
  /** 是否含有任何真正可用的采集内容（截图/资源/样式/区块/动效任一非空）。 */
  substantive: boolean;
  /** 为空的维度名，便于日志定位「到底缺哪一块」。 */
  emptyParts: string[];
}

export function inspectWebsitePackage(input: unknown): PackageHealth {
  const result = validateWebsitePackage(input);
  const pkg = (input ?? {}) as Partial<WebsitePackage>;

  const emptyParts: string[] = [];
  if (!pkg.screenshots?.length) emptyParts.push('screenshots');
  if (!pkg.assets?.length) emptyParts.push('assets');
  if (!pkg.dom?.sections?.length) emptyParts.push('dom.sections');
  if (!pkg.styles?.colors?.length) emptyParts.push('styles.colors');
  if (!pkg.styles?.fonts?.length) emptyParts.push('styles.fonts');
  if (!pkg.layout?.flow?.length) emptyParts.push('layout.flow');
  if (!pkg.animations?.length) emptyParts.push('animations');
  if (!pkg.metadata?.title && !pkg.metadata?.brand) emptyParts.push('metadata.title');

  return {
    ok: result.ok,
    errors: result.ok ? [] : result.errors,
    // 「有料」的底线：至少要采到 DOM 区块或样式色值，否则模型只能凭空发挥
    substantive: Boolean(pkg.dom?.sections?.length || pkg.styles?.colors?.length),
    emptyParts,
  };
}
