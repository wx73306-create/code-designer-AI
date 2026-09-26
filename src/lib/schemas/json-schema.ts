/**
 * 极简 JSON Schema 校验器（draft 2020-12 子集）
 * ===================================================================
 * 为什么不引 ajv / zod：
 *
 * 1. 本机 `npm install` 官方源极慢且常卡死（>15min 不退出），为一个校验器
 *    引入依赖树性价比为负；
 * 2. 我们需要的是**契约校验**，不是通用校验引擎 —— 支持的关关键词就这几个，
 *    显式列出来反而让「契约到底约束了什么」一目了然；
 * 3. 错误信息要精确到 JSON 路径，通用库的报错格式反而要额外适配。
 *
 * 支持的关关键词（与 website-package.schema.json 实际用到的严格一致）：
 *   $ref（仅本地 `#/$defs/...`）、type、required、properties、
 *   additionalProperties（false | schema）、items、enum、
 *   minLength、minimum、maximum、minItems
 *
 * 刻意**不支持**的能力（用到了就报 unsupported，而不是静默放过 —— 静默放过的
 * 校验器比没有校验器更危险）：
 *   allOf / anyOf / oneOf / not / pattern / format / $dynamicRef / 远程 $ref
 *
 * 设计原则：**宁可报错，不可漏判**。任何不认识的关关键词都会产出一条
 * `unsupported-keyword` 错误，避免 schema 作者以为自己写了一条约束、
 * 实际从未生效。
 */

export interface SchemaError {
  /** JSON 路径，如 `$.styles.spacing.base`；根节点为 `$`。 */
  path: string;
  message: string;
}

type JsonSchema = Record<string, unknown>;

const KEYWORD_WHITELIST = new Set([
  '$schema',
  '$id',
  '$defs',
  'title',
  'description',
  'default',
  'examples',
  '$ref',
  'type',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'enum',
  'minLength',
  'minimum',
  'maximum',
  'minItems',
]);

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesType(value: unknown, expected: string): boolean {
  switch (expected) {
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      // 未知 type 值：报错而非放过
      return false;
  }
}

function resolveRef(ref: string, root: JsonSchema): JsonSchema | null {
  if (!ref.startsWith('#/')) return null;
  let cursor: unknown = root;
  for (const rawSegment of ref.slice(2).split('/')) {
    // JSON Pointer 转义：~1 → '/'，~0 → '~'
    const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (typeof cursor !== 'object' || cursor === null) return null;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === 'object' && cursor !== null ? (cursor as JsonSchema) : null;
}

function validateNode(
  value: unknown,
  schema: JsonSchema,
  root: JsonSchema,
  path: string,
  errors: SchemaError[],
): void {
  // 未知关键词：显式报错，防止「写了但没生效」的静默失效
  for (const key of Object.keys(schema)) {
    if (!KEYWORD_WHITELIST.has(key)) {
      errors.push({ path, message: `unsupported-keyword: "${key}" 未被校验器实现，该约束不会生效` });
      return;
    }
  }

  if (typeof schema.$ref === 'string') {
    const target = resolveRef(schema.$ref, root);
    if (!target) {
      errors.push({ path, message: `unresolvable-$ref: ${schema.$ref}` });
      return;
    }
    validateNode(value, target, root, path, errors);
    return;
  }

  if (typeof schema.type === 'string' && !matchesType(value, schema.type)) {
    errors.push({ path, message: `type: 期望 ${schema.type}，实际 ${typeOf(value)}` });
    return; // 类型都不对，后续子约束无意义
  }

  if (Array.isArray(schema.enum)) {
    const allowed = schema.enum as unknown[];
    if (!allowed.some((a) => a === value)) {
      errors.push({
        path,
        message: `enum: 期望 ${allowed.map((a) => JSON.stringify(a)).join(' | ')} 之一，实际 ${JSON.stringify(value)}`,
      });
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push({ path, message: `minLength: 至少 ${schema.minLength} 字符，实际 ${value.length}` });
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push({ path, message: `minimum: 不小于 ${schema.minimum}，实际 ${value}` });
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push({ path, message: `maximum: 不大于 ${schema.maximum}，实际 ${value}` });
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push({ path, message: `minItems: 至少 ${schema.minItems} 项，实际 ${value.length}` });
    }
    if (schema.items && typeof schema.items === 'object') {
      value.forEach((item, i) => validateNode(item, schema.items as JsonSchema, root, `${path}[${i}]`, errors));
    }
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;

    if (Array.isArray(schema.required)) {
      for (const key of schema.required as string[]) {
        if (!(key in obj)) errors.push({ path, message: `required: 缺少必填字段 "${key}"` });
      }
    }

    const props = (schema.properties ?? {}) as Record<string, JsonSchema>;
    for (const [key, subSchema] of Object.entries(props)) {
      if (key in obj) validateNode(obj[key], subSchema, root, `${path}.${key}`, errors);
    }

    const declared = new Set(Object.keys(props));
    const extras = Object.keys(obj).filter((k) => !declared.has(k));
    if (schema.additionalProperties === false && extras.length > 0) {
      errors.push({
        path,
        message: `additionalProperties: 出现未声明字段 ${extras.map((e) => `"${e}"`).join(', ')}`,
      });
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const key of extras) {
        validateNode(obj[key], schema.additionalProperties as JsonSchema, root, `${path}.${key}`, errors);
      }
    }
  }
}

/**
 * 用给定 schema 校验一个 JSON 值。
 *
 * @returns 错误列表（空数组 = 通过）。**不抛异常** —— 调用方决定是警告还是拒绝。
 */
export function validateAgainstSchema(value: unknown, schema: JsonSchema): SchemaError[] {
  const errors: SchemaError[] = [];
  validateNode(value, schema, schema, '$', errors);
  return errors;
}
