/**
 * QA 报告编排器测试（P3-11 落地点）
 * ===================================================================
 * 锁死三件事：
 *   1. **开关默认关闭** —— 不改变任何现有部署的磁盘行为；
 *   2. **写盘失败不影响主流程** —— 报告是旁路产物，绝不能把成功的生成变成失败；
 *   3. **无论写不写盘都打一行 `QA-REPORT` 日志** —— 「当时为什么给这个分」
 *      必须在容器日志里可取证，否则回溯只能靠猜。
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emitQaReport } from './qa-report';

/** 与线上模型完全一致的真实输出形状。 */
function realModelOutput() {
  return {
    scores: {
      visualFidelity: 78,
      layout: 70,
      hierarchy: 75,
      typography: 68,
      color: 78,
      spacing: 72,
      interaction: 80,
      premium: 65,
    },
    totalScore: 71,
    problems: [
      {
        category: 'typography',
        severity: 'critical',
        priority: 'P0',
        problem: '使用 Inter 替代标志性字体',
        reason: '品牌识别度丢失',
        solution: '引入 @font-face',
      },
      {
        category: 'interaction',
        severity: 'minor',
        priority: 'P2',
        problem: '滚动动效过于生硬',
        reason: '缺少缓动',
        solution: '加 cubic-bezier',
      },
    ],
  };
}

let root = '';
let logs: string[] = [];

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'qa-report-'));
  logs = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.RUN_ARTIFACTS;
  delete process.env.PACKAGE_ARCHIVE;
  if (root) await rm(root, { recursive: true, force: true });
});

function reportLines(): string[] {
  return logs.filter((l) => l.includes('[QA-REPORT]'));
}

describe('emitQaReport · 开关', () => {
  it('未开开关时不落盘，但依然组装报告并打日志', async () => {
    const res = await emitQaReport({
      generationId: 'gen_switch_off',
      sourceUrl: 'https://stripe.com',
      raw: realModelOutput(),
      enabled: false,
      root,
    });

    expect(res.disposition).toBe('skipped-disabled');
    expect(res.written).toBeNull();
    expect(res.report.overallScore).toBe(71);
    expect(reportLines()).toHaveLength(1);
  });

  it('开关默认取自 RUN_ARTIFACTS —— 未设置时为关闭', async () => {
    const res = await emitQaReport({
      generationId: 'gen_default_off',
      sourceUrl: 'https://stripe.com',
      raw: realModelOutput(),
      root,
    });
    expect(res.disposition).toBe('skipped-disabled');
  });

  it('RUN_ARTIFACTS=on 时落盘（json + markdown 两个文件）', async () => {
    process.env.RUN_ARTIFACTS = 'on';
    const res = await emitQaReport({
      generationId: 'gen_on_1',
      sourceUrl: 'https://stripe.com',
      raw: realModelOutput(),
      enabled: true,
      root,
    });

    expect(res.disposition).toBe('written');
    expect(res.written?.json.ok).toBe(true);
    expect(res.written?.markdown.ok).toBe(true);

    const json = JSON.parse(await readFile(path.join(root, 'gen_on_1', 'qa-report.json'), 'utf8'));
    expect(json.overallScore).toBe(71);
    expect(json.trustworthy).toBe(true);

    const md = await readFile(path.join(root, 'gen_on_1', 'qa-report.md'), 'utf8');
    expect(md).toContain('# QA 报告 · gen_on_1');
    expect(md).toContain('**总分 71 / 100**');
  });
});

describe('emitQaReport · 日志取证', () => {
  it('日志是单行合法 JSON，含复算所需的关键字段', async () => {
    await emitQaReport({
      generationId: 'gen_log_1',
      sourceUrl: 'https://linear.app',
      raw: realModelOutput(),
      enabled: false,
      root,
    });

    const lines = reportLines();
    expect(lines).toHaveLength(1);
    const payload = JSON.parse(lines[0].replace('[QA-REPORT] ', ''));
    expect(payload.generationId).toBe('gen_log_1');
    expect(payload.overallScore).toBe(71);
    expect(payload.overallSource).toBe('model');
    expect(payload.trustworthy).toBe(true);
    expect(payload.problems).toBe(2);
    expect(payload.unmatchedCategories).toContain('interaction');
  });

  it('契约盲区分类出现在日志里（不被静默改写）', async () => {
    await emitQaReport({
      generationId: 'gen_log_blind',
      sourceUrl: 'https://apple.com',
      raw: {
        scores: { layout: 70, spacing: 70, color: 70, typography: 70, premium: 70 },
        totalScore: 70,
        problems: [
          { category: 'visualFidelity', problem: '主视觉差距大' },
          { category: 'hierarchy', problem: '层级不清' },
        ],
      },
      enabled: false,
      root,
    });

    const payload = JSON.parse(reportLines()[0].replace('[QA-REPORT] ', ''));
    expect(payload.unmatchedCategories.sort()).toEqual(['hierarchy', 'visualFidelity']);
  });
});

describe('emitQaReport · 永不抛错', () => {
  it('jobId 非法（路径穿越）时报告仍然产出，只是不落盘', async () => {
    const res = await emitQaReport({
      generationId: '../escape',
      sourceUrl: 'https://stripe.com',
      raw: realModelOutput(),
      enabled: true,
      root,
    });

    expect(res.report.overallScore).toBe(71);
    expect(res.disposition).toBe('write-failed');
    expect(res.writeErrors?.length).toBe(2); // json + md 都被拒绝
    expect(reportLines()).toHaveLength(1);
  });

  it('兜底污染样本：六维全回落时 trustworthy=false，日志同样标明', async () => {
    const res = await emitQaReport({
      generationId: 'gen_fallback',
      sourceUrl: 'https://stripe.com',
      // 模型没给任何可识别维度 —— 归一化后六维全部回落常量
      raw: { notes: '模型这一步输出的是散文', verdict: '还行' },
      enabled: false,
      root,
    });

    expect(res.report.trustworthy).toBe(false);
    expect(res.report.overallSource).toBe('default');
    expect(res.report.defaultedDimensions).toHaveLength(6);

    const payload = JSON.parse(reportLines()[0].replace('[QA-REPORT] ', ''));
    expect(payload.trustworthy).toBe(false);
    expect(payload.defaultedDimensions).toHaveLength(6);
  });

  it('raw 为 null / 字符串 / 数组都不炸', async () => {
    for (const raw of [null, 'plain text', [1, 2, 3], 42, undefined]) {
      const res = await emitQaReport({
        generationId: 'gen_weird',
        sourceUrl: 'https://stripe.com',
        raw,
        enabled: false,
        root,
      });
      expect(res.report.problems).toEqual([]);
      expect(res.disposition).toBe('skipped-disabled');
    }
  });
});
