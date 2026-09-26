/**
 * Schema 仓库（S-02）
 * ===================================================================
 * 模块间通信契约的唯一入口。每个产出物在这里有一个 schema + 一个校验函数。
 *
 * 为什么要有这个目录（而不是把 schema 塞进各业务模块）：
 *   「Agent 之间只通过 JSON Schema 通信」（执行计划书 §执行注意事项 4）是一条
 *   **跨模块**约束。散落在各模块里就等于没有约束 —— 谁都可以改自己那半边，
 *   而没人负责两边还能对上。集中放这里，改契约必须动同一个目录，评审看得见。
 */

export {
  WEBSITE_PACKAGE_SCHEMA,
  WEBSITE_PACKAGE_REQUIRED_KEYS,
  PackageValidationError,
  validateWebsitePackage,
  assertValidWebsitePackage,
  inspectWebsitePackage,
  describeValidationErrors,
  MAX_REPORTED,
} from './website-package';

export type {
  PackageValidationResult,
  PackageValidationOk,
  PackageValidationFail,
  PackageHealth,
} from './website-package';

export { validateAgainstSchema } from './json-schema';
export type { SchemaError } from './json-schema';
