import { describe, expect, it } from 'vitest';

import { isForcedDemoMode, resolveRunMode, runModeBadge } from './run-mode';

describe('isForcedDemoMode — env 开关只认字符串 true', () => {
  it('只有 "true" 才算开启', () => {
    expect(isForcedDemoMode('true')).toBe(true);
    expect(isForcedDemoMode('false')).toBe(false);
    expect(isForcedDemoMode('1')).toBe(false);
    expect(isForcedDemoMode('TRUE')).toBe(false);
    expect(isForcedDemoMode(undefined)).toBe(false);
    expect(isForcedDemoMode('')).toBe(false);
  });
});

describe('resolveRunMode — 三态判定', () => {
  it('env 强制演示时优先于任务状态', () => {
    expect(resolveRunMode({ forcedDemo: true, taskStatus: 'completed' })).toBe('forced-demo');
    expect(resolveRunMode({ forcedDemo: true, taskStatus: 'idle' })).toBe('forced-demo');
  });

  it('未跑过生成（idle）→ 各区块吃 mock 兜底，标为 sample', () => {
    expect(resolveRunMode({ forcedDemo: false, taskStatus: 'idle' })).toBe('sample');
  });

  it('跑过生成（running / completed / error）→ live', () => {
    for (const status of ['running', 'completed', 'error', 'cancelled']) {
      expect(resolveRunMode({ forcedDemo: false, taskStatus: status })).toBe('live');
    }
  });

  it('未跑过的任务不得被标成「真实执行」（这正是修复前的假标签问题）', () => {
    const badge = runModeBadge(resolveRunMode({ forcedDemo: false, taskStatus: 'idle' }));
    expect(badge.label).not.toBe('AI 分析模式');
    expect(badge.tone).toBe('demo');
  });
});

describe('runModeBadge — 文案与配色', () => {
  it('三种模式的标签与 tone 稳定', () => {
    expect(runModeBadge('live')).toMatchObject({ label: 'AI 分析模式', tone: 'live' });
    expect(runModeBadge('sample')).toMatchObject({ label: '示例数据', tone: 'demo' });
    expect(runModeBadge('forced-demo')).toMatchObject({ label: '演示模式', tone: 'demo' });
  });

  it('prompt 必须如实描述数据来源，不得出现「部署结果」这类未发生的断言', () => {
    const live = runModeBadge('live').title;
    // 真实模式：明确「未做线上部署」，不把导出说成部署
    expect(live).toContain('未做线上部署');
    expect(live).toContain('真实');
    // 示例模式：明确说明当前是内置示例数据
    expect(runModeBadge('sample').title).toContain('示例数据');
    expect(runModeBadge('forced-demo').title).toContain('模拟数据');
  });

  it('每个标签都非空', () => {
    for (const mode of ['forced-demo', 'sample', 'live'] as const) {
      expect(runModeBadge(mode).label.length).toBeGreaterThan(0);
      expect(runModeBadge(mode).title.length).toBeGreaterThan(0);
    }
  });
});
