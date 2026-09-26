/**
 * WebsitePackage 契约校验测试
 * ===================================================================
 * 锁死三件事：
 *   1. **真实产出物必须通过** —— `createEmptyPackage()` 与带内容的包都要过，
 *      否则校验器会成为流水线的假阳性闸门，被绕过或被删掉。
 *   2. **违约必须被指名道姓地抓住** —— 缺字段/多字段/类型错/枚举错，路径要准。
 *   3. **「未知」不是「非法」** —— `layout.flow: []`、`interaction: undefined`
 *      是架构刻意保留的语义（没测过 = 空数组，不是猜一个值），校验器绝不能把它们
 *      判成错误，否则会逼着上游填假数据。
 */

import { describe, expect, it } from 'vitest';

import { createEmptyPackage, WEBSITE_PACKAGE_VERSION } from '@/types/website-package';
import {
  assertValidWebsitePackage,
  describeValidationErrors,
  inspectWebsitePackage,
  PackageValidationError,
  validateAgainstSchema,
  validateWebsitePackage,
  WEBSITE_PACKAGE_REQUIRED_KEYS,
  WEBSITE_PACKAGE_SCHEMA,
} from './index';
import substantiveFixture from './__fixtures__/substantive-package.json';

/** 深拷贝 fixture，避免用例之间互相污染。 */
function fixture(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(substantiveFixture)) as Record<string, unknown>;
}

describe('validateWebsitePackage — 真实产出物必须通过', () => {
  it('createEmptyPackage() 产出的空包是合法包', () => {
    const result = validateWebsitePackage(createEmptyPackage('https://example.com'));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('带内容的完整包通过校验（fixture）', () => {
    const result = validateWebsitePackage(fixture());
    expect(result.ok).toBe(true);
  });

  it('version 与 WEBSITE_PACKAGE_VERSION 一致（防止契约版本漂移）', () => {
    const pkg = fixture();
    expect(pkg.version).toBe(WEBSITE_PACKAGE_VERSION);
  });

  it('schema 的 required 与导出的常量同源，不漂移', () => {
    expect([...WEBSITE_PACKAGE_REQUIRED_KEYS]).toEqual(
      (WEBSITE_PACKAGE_SCHEMA.required as string[]).slice(),
    );
    // 12 个顶层必填字段；interaction 刻意不在其中
    expect(WEBSITE_PACKAGE_REQUIRED_KEYS).toHaveLength(12);
    expect(WEBSITE_PACKAGE_REQUIRED_KEYS).not.toContain('interaction');
  });
});

describe('validateWebsitePackage — 违约必须被抓住', () => {
  it('缺少顶层必填字段 → required，且路径指向根', () => {
    const pkg = fixture();
    delete pkg.layout;
    const result = validateWebsitePackage(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.some((e) => e.message.includes('required') && e.message.includes('layout'))).toBe(true);
  });

  it('出现未声明的顶层字段 → additionalProperties（闭集契约）', () => {
    const pkg = fixture();
    pkg.temporaryHack = { foo: 'bar' };
    const result = validateWebsitePackage(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors[0].message).toContain('additionalProperties');
    expect(result.errors[0].message).toContain('temporaryHack');
  });

  it('类型错 → type，且路径精确到叶子', () => {
    const pkg = fixture();
    (pkg.styles as Record<string, unknown>).spacing = {
      base: 4,
      scale: [],
      containerMaxWidth: '1080px',
      sectionPadding: '80px',
    };
    const result = validateWebsitePackage(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.some((e) => e.path === '$.styles.spacing.base' && e.message.includes('type'))).toBe(true);
  });

  it('枚举越界 → enum（区块角色必须来自 SectionRole）', () => {
    const pkg = fixture();
    const dom = pkg.dom as { sections: Array<Record<string, unknown>> };
    dom.sections[0].role = 'sidebar';
    const result = validateWebsitePackage(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.some((e) => e.message.includes('enum') && e.path.includes('$.dom.sections[0].role'))).toBe(true);
  });

  it('interaction 存在但结构不全 → required（三数组容器是下限）', () => {
    const pkg = fixture();
    pkg.interaction = { scrolls: [] };
    const result = validateWebsitePackage(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.some((e) => e.path.startsWith('$.interaction') && e.message.includes('required'))).toBe(true);
  });

  it('数组元素类型错 → 报出下标，便于定位第几条', () => {
    const pkg = fixture();
    const assets = pkg.assets as Array<Record<string, unknown>>;
    assets[1].size = 'large';
    const result = validateWebsitePackage(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.some((e) => e.path === '$.assets[1].size')).toBe(true);
  });
});

describe('「未知」不等于「非法」—— 架构刻意保留的语义', () => {
  it('layout.flow 为空数组是合法的（没测过 ≠ 猜一个值）', () => {
    const pkg = fixture();
    (pkg.layout as Record<string, unknown>).flow = [];
    expect(validateWebsitePackage(pkg).ok).toBe(true);
  });

  it('interaction 缺失（undefined）是合法的 —— 但不能填空对象占位以外的非法形态', () => {
    const pkg = fixture();
    delete pkg.interaction;
    expect(validateWebsitePackage(pkg).ok).toBe(true);
  });

  it('layoutBlock.heightPx 缺失合法（未开采集时必须是 undefined，不能填猜测值）', () => {
    const pkg = fixture();
    const flow = (pkg.layout as { flow: Array<Record<string, unknown>> }).flow;
    delete flow[0].heightPx;
    expect(validateWebsitePackage(pkg).ok).toBe(true);
  });

  it('metadata 允许是空对象（老数据反序列化后就是 {}）', () => {
    const pkg = fixture();
    pkg.metadata = {};
    expect(validateWebsitePackage(pkg).ok).toBe(true);
  });
});

describe('assertValidWebsitePackage —— C2 强制入口', () => {
  it('合法包原样返回（并收窄类型）', () => {
    const pkg = fixture();
    expect(assertValidWebsitePackage(pkg)).toBe(pkg);
  });

  it('非法包抛 PackageValidationError，message 含路径与总数', () => {
    // 用一个「结构完整但某处违约」的包：只有嵌套错误才能验证路径是精确到叶子的，
    // 全根层错误（如只传 {url}）路径恒为 `$`，测不出定位能力。
    const bad = createEmptyPackage('https://x.com');
    (bad.styles.spacing as unknown as Record<string, unknown>).base = 4;
    let caught: unknown;
    try {
      assertValidWebsitePackage(bad, 'code 步骤入参');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PackageValidationError);
    const err = caught as PackageValidationError;
    expect(err.name).toBe('PackageValidationError');
    expect(err.errors.length).toBeGreaterThan(0);
    expect(err.message).toContain('code 步骤入参');
    expect(err.message).toContain('$.styles.spacing.base');
  });

  it('只传 {url} 时错误路径落在根 `$`（根层缺字段就是根层的问题）', () => {
    let caught: unknown;
    try {
      assertValidWebsitePackage({ url: 'https://x.com' });
    } catch (e) {
      caught = e;
    }
    const err = caught as PackageValidationError;
    expect(err).toBeInstanceOf(PackageValidationError);
    expect(err.errors.every((e) => e.path === '$')).toBe(true);
    expect(err.message).toContain('缺少必填字段');
  });

  it('describeValidationErrors 在超量时截断并注明总数', () => {
    const errors = Array.from({ length: 20 }, (_, i) => ({ path: `$.k${i}`, message: 'boom' }));
    const text = describeValidationErrors(errors, 5);
    expect(text.split('\n')).toHaveLength(6);
    expect(text).toContain('另有 15 处');
  });
});

describe('inspectWebsitePackage —— 把「空壳」与「违约」分开', () => {
  it('空包：契约通过，但不是有料包，并列出空维度', () => {
    const health = inspectWebsitePackage(createEmptyPackage('https://example.com'));
    expect(health.ok).toBe(true);
    expect(health.substantive).toBe(false);
    expect(health.emptyParts).toContain('dom.sections');
    expect(health.emptyParts).toContain('styles.colors');
    expect(health.emptyParts).toContain('layout.flow');
  });

  it('有内容的包：substantive=true 且空维度显著减少', () => {
    const health = inspectWebsitePackage(fixture());
    expect(health.ok).toBe(true);
    expect(health.substantive).toBe(true);
    expect(health.emptyParts).not.toContain('dom.sections');
    expect(health.emptyParts).not.toContain('styles.colors');
  });

  it('违约包：ok=false 且 errors 透传', () => {
    const health = inspectWebsitePackage({ url: 'x' });
    expect(health.ok).toBe(false);
    expect(health.errors.length).toBeGreaterThan(0);
  });
});

describe('校验器自身的防退化', () => {
  it('未实现的关键词必须报 unsupported，不能静默放过', () => {
    const errors = validateAgainstSchema({ a: 1 }, {
      type: 'object',
      patternProperties: { foo: { type: 'string' } },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('unsupported-keyword');
    expect(errors[0].message).toContain('patternProperties');
  });

  it('无法解析的 $ref 必须报错，不能当作通过', () => {
    const errors = validateAgainstSchema({}, { $ref: '#/$defs/missing' });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('unresolvable-$ref');
  });

  it('递归 $ref（componentNode.children）不会栈溢出且能抓出嵌套错误', () => {
    const pkg = fixture();
    const plan = pkg.components as { tree: Array<Record<string, unknown>> };
    plan.tree[0].children = [{ name: 'Inner', type: 'div', children: [], props: { bad: 1 } }];
    const result = validateWebsitePackage(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.some((e) => e.path === '$.components.tree[0].children[0].props.bad')).toBe(true);
  });
});

describe('「undefined 等价于缺失」（2026-09-26 生产事故回归）', () => {
  // 事故：生产者在构造对象时把取不到的字段显式赋成 undefined。旧校验器用
  // `key in obj` 判存在，于是对**本来就没有**的可选字段做类型检查，报出
  // 「$ .animations[0].properties: type: 期望 array，实际 undefined」这类假违约。
  // 而 code 步骤的契约闸门是硬拒绝 → 每一次生成都 422。
  // 依据：JSON 里不存在 undefined，`JSON.stringify({a:undefined})` 就是 `{}`。
  it('可选字段被显式置 undefined ⇒ 合法（不报 type 错）', () => {
    const pkg = fixture();
    type A = Record<string, unknown>;
    (pkg.metadata as A).favicon = undefined;
    (pkg.assets as A[]).forEach((a) => {
      a.localPath = undefined;
      a.hash = undefined;
      a.width = undefined;
    });
    (pkg.animations as A[]).forEach((a) => {
      a.properties = undefined;
      a.delay = undefined;
    });
    expect(validateWebsitePackage(pkg).ok).toBe(true);
  });

  it('必填字段被显式置 undefined ⇒ 报「缺少必填字段」（不能算存在）', () => {
    const pkg = fixture();
    pkg.layout = undefined;
    const result = validateWebsitePackage(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.some((e) => e.message.includes('缺少必填字段 "layout"'))).toBe(true);
  });

  it('闭集契约：显式 undefined 的未声明字段不算「多出来的字段」', () => {
    const pkg = fixture();
    (pkg as Record<string, unknown>).debugDump = undefined;
    expect(validateWebsitePackage(pkg).ok).toBe(true);
    // 反面：有真值就必须拒
    (pkg as Record<string, unknown>).debugDump = 1;
    expect(validateWebsitePackage(pkg).ok).toBe(false);
  });
});
