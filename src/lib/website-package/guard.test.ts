/**
 * 数据包闸门测试（C2 / P1-16 / P1-18）
 * ===================================================================
 * 锁死的核心区分：
 *   · **违约包 ⇒ 拒绝执行**（ok:false）—— 这是代码缺陷，不能带着坏输入继续生成；
 *   · **空壳包 ⇒ 放行但显著告警**（ok:true + emptyParts）—— 采不到是合理现实；
 *   · **正常包 ⇒ 记录注入了哪些块** —— 这是 P1-18「日志显示使用了
 *     dom/layout/design_tokens、无截图-only 路径」的取证依据。
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

import { createEmptyPackage } from '@/types/website-package';
import { gatePackageForStep, packageForPrompt } from './guard';
import substantiveFixture from '@/lib/schemas/__fixtures__/substantive-package.json';

afterEach(() => {
  vi.restoreAllMocks();
});

function fixture(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(substantiveFixture)) as Record<string, unknown>;
}

describe('gatePackageForStep —— 违约包必须被拒', () => {
  it('缺少顶层必填字段 ⇒ ok:false，理由含「契约」且带路径', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = fixture();
    delete bad.styles;

    const gate = gatePackageForStep(bad, 'code');
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('契约');
    expect(gate.reason).toContain('styles');
    expect(gate.health.ok).toBe(false);
  });

  it('传 null / 字符串 / 数组等非对象 ⇒ ok:false（不能崩溃）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const bad of [null, undefined, 'not-a-package', 42, []]) {
      const gate = gatePackageForStep(bad, 'code');
      expect(gate.ok).toBe(false);
      expect(typeof gate.reason).toBe('string');
    }
  });

  it('契约违约时 packageForPrompt 返回 null（调用方据此走拒绝分支）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { text, gate } = packageForPrompt({ url: 'https://x.com' }, 'code');
    expect(text).toBeNull();
    expect(gate.ok).toBe(false);
  });
});

describe('gatePackageForStep —— 空壳包放行但必须告警', () => {
  it('createEmptyPackage() ⇒ ok:true / substantive:false / injectedBlocks 为空', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const gate = gatePackageForStep(createEmptyPackage('https://example.com'), 'planning');

    expect(gate.ok).toBe(true);
    expect(gate.health.substantive).toBe(false);
    expect(gate.injectedBlocks).toEqual([]);
    expect(gate.reason).toContain('空壳包');
    // 告警必须真的打出来 —— 静默放行正是本模块要消灭的行为
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('dom.sections');
  });

  it('空壳包不得被当成违约（否则会逼上游填假数据）', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const gate = gatePackageForStep(createEmptyPackage('https://example.com'), 'animation');
    expect(gate.ok).toBe(true);
    expect(gate.health.errors).toEqual([]);
  });
});

describe('gatePackageForStep —— 正常包记录注入证据（P1-18）', () => {
  it('有料包 ⇒ ok:true 且 injectedBlocks 覆盖 dom / design_tokens / layout', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const gate = gatePackageForStep(fixture(), 'code');

    expect(gate.ok).toBe(true);
    expect(gate.health.substantive).toBe(true);
    expect(gate.injectedBlocks).toContain('dom');
    expect(gate.injectedBlocks).toContain('design_tokens.colors');
    expect(gate.injectedBlocks).toContain('layout');
    expect(gate.injectedBlocks).toContain('screenshots');

    // 日志必须写明「用了哪些块」，这条日志就是 P1-18 的验收证据
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('已注入数据包块');
    expect(String(log.mock.calls[0][0])).toContain('design_tokens.colors');
  });

  it('「无截图-only 路径」：只在有 dom 时才算有料，纯截图不算', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onlyScreenshot = createEmptyPackage('https://example.com');
    onlyScreenshot.screenshots.push({ viewport: 'desktop', width: 1440, height: 900 });

    const gate = gatePackageForStep(onlyScreenshot, 'code');
    expect(gate.ok).toBe(true);
    // 只有截图、没有 dom.sections / styles.colors ⇒ 不是有料包
    expect(gate.health.substantive).toBe(false);
  });
});

describe('packageForPrompt', () => {
  it('正常包原样返回，便于直接喂给 formatter', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const pkg = fixture();
    const { text } = packageForPrompt(pkg, 'code');
    expect(text).toBe(pkg);
  });
});

describe('运维逃生阀 PACKAGE_GATE=warn（2026-09-26 假违约事故的教训）', () => {
  // 事故：校验器把显式 undefined 当成「存在」，对真实生产者的输出报出 11 处假违约；
  // 而 code 步骤是硬拒绝 —— 结果**每一次生成都 422**，产品变成 0 可用，
  // 现场没有任何解锁手段。所以保留 fail-closed 默认值，另给一个要打错字才能开的降级档。
  afterEach(() => {
    delete process.env.PACKAGE_GATE;
  });

  it('默认（未设 PACKAGE_GATE）时违约仍然被拒 —— 默认必须是 fail-closed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = fixture();
    delete bad.layout;
    expect(gatePackageForStep(bad, 'code').ok).toBe(false);
  });

  it('PACKAGE_GATE=enforce 与未设置等价', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.PACKAGE_GATE = 'enforce';
    const bad = fixture();
    delete bad.layout;
    expect(gatePackageForStep(bad, 'code').ok).toBe(false);
  });

  it('PACKAGE_GATE=warn 时放行，但日志必须是 error 级且写明「本该拒绝」（刺眼是设计目标）', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.PACKAGE_GATE = 'warn';
    const bad = fixture();
    delete bad.layout;

    const gate = gatePackageForStep(bad, 'code');
    expect(gate.ok).toBe(true);          // 放行
    expect(gate.reason).toContain('拒绝'); // 判定结果本身没有被改写
    const logged = spy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('PACKAGE_GATE=warn');
    expect(logged).toContain('本该拒绝但已放行');
  });

  it('warn 档不影响「空壳包放行」与「正常包」的行为', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.PACKAGE_GATE = 'warn';
    expect(gatePackageForStep(createEmptyPackage('https://e.com'), 'code').ok).toBe(true);
    expect(gatePackageForStep(fixture(), 'code').ok).toBe(true);
  });
});

describe('「undefined 等价于缺失」—— 假违约的直接回归', () => {
  it('真实生产者风格的显式 undefined 不得被判成违约（否则 code 步骤全量 422）', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const pkg = fixture();
    type A = Record<string, unknown>;
    (pkg.metadata as A).favicon = undefined;
    (pkg.metadata as A).canonical = undefined;
    (pkg.metadata as A).openGraph = undefined;
    (pkg.animations as A[]).forEach((a) => {
      a.properties = undefined;
      a.delay = undefined;
    });

    const gate = gatePackageForStep(pkg, 'code');
    expect(gate.ok).toBe(true);
    expect(gate.health.errors).toEqual([]);
  });

  it('反向：必填字段被显式置 undefined 仍要拒（不能把「缺字段」也一起放过）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const pkg = fixture();
    pkg.layout = undefined;
    expect(gatePackageForStep(pkg, 'code').ok).toBe(false);
  });
});
