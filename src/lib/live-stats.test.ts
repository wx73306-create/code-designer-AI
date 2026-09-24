import { describe, expect, it } from 'vitest';

import { liveStats } from './live-stats';

/**
 * B.2.3 — /api/track → live-stats → /api/admin/stats 的往返语义。
 *
 * 只锁**存储层的三态是否被如实保留**：
 * undefined（老客户端/未采集）≠ null（不可得）≠ 0（有效测量值）。
 */
function startGeneration(id: string) {
  const created = liveStats.generationStart({
    id,
    user: 'tester',
    email: 'anonymous',
    // 每个用例一个独立 URL：pushEvent 用 unshift（新事件在最前）且限长 300，
    // 靠唯一 URL 才能从 events 里可靠定位到自己那条日志。
    url: `https://example.com/${id}`,
    goal: 'clone',
    model: 'mimo-v2.5',
  });
  return liveStats.generations.find((g) => g.id === created)!;
}

function logLineFor(id: string): string {
  return (
    liveStats.events
      .map((e) => e.message)
      .find((m) => m.includes('生成完成') && m.includes(`/${id}`)) ?? ''
  );
}

describe('liveStats.generationComplete — 新契约字段往返', () => {
  it('正常上报：qualityScore / reconstructionScore / reconstructionMeta 都落库', () => {
    const gen = startGeneration('b23-full');
    liveStats.generationComplete('b23-full', {
      files: 7,
      similarity: 88,
      qualityScore: 92,
      reconstructionScore: 87,
      reconstructionMeta: { measuredSections: ['hero', 'footer'], degradedReason: undefined },
    });

    expect(gen.qualityScore).toBe(92);
    expect(gen.reconstructionScore).toBe(87);
    expect(gen.reconstructionMeta?.measuredSections).toEqual(['hero', 'footer']);
    // similarity 仍在（迁移期双写，不得丢）
    expect(gen.similarity).toBe(88);
  });

  it('显式 null 必须原样落库：不可得 ≠ 未采集，也不能塌成 0', () => {
    const gen = startGeneration('b23-null');
    liveStats.generationComplete('b23-null', {
      qualityScore: null,
      reconstructionScore: null,
      reconstructionMeta: { degradedReason: 'render-error' },
    });

    expect(gen.qualityScore).toBeNull();
    expect(gen.reconstructionScore).toBeNull();
    expect(gen.qualityScore === 0).toBe(false);
    expect(gen.reconstructionMeta?.degradedReason).toBe('render-error');
  });

  it('0 是有效测量值，不得被当缺失', () => {
    const gen = startGeneration('b23-zero');
    liveStats.generationComplete('b23-zero', { qualityScore: 0, reconstructionScore: 0 });

    expect(gen.qualityScore).toBe(0);
    expect(gen.reconstructionScore).toBe(0);
    expect(gen.qualityScore == null).toBe(false);
  });

  it('老客户端（只发 similarity）→ 新字段保持 absent，不是 null', () => {
    const gen = startGeneration('b23-legacy');
    liveStats.generationComplete('b23-legacy', { files: 3, similarity: 75 });

    expect(gen.similarity).toBe(75);
    expect('qualityScore' in gen).toBe(false);
    expect('reconstructionScore' in gen).toBe(false);
    expect('reconstructionMeta' in gen).toBe(false);
  });

  it('只有 qualityScore（没开还原度）→ reconstructionScore 不出现，而不是 null', () => {
    const gen = startGeneration('b23-qonly');
    liveStats.generationComplete('b23-qonly', { qualityScore: 91 });

    expect(gen.qualityScore).toBe(91);
    expect('reconstructionScore' in gen).toBe(false);
  });

  it('读取优先级 qualityScore > similarity 反映在日志里', () => {
    startGeneration('b23-priority');
    liveStats.generationComplete('b23-priority', { similarity: 60, qualityScore: 95, reconstructionScore: 87 });

    const line = logLineFor('b23-priority');

    // 质量分取 95（不是 similarity 的 60），还原度单独报 87
    expect(line).toContain('95.0%');
    expect(line).not.toContain('60.0%');
    expect(line).toContain('87.0%');
  });

  it('历史数据只有 similarity 时，日志回落到 similarity（不得显示 0）', () => {
    startGeneration('b23-fallback');
    liveStats.generationComplete('b23-fallback', { similarity: 72.5 });

    const line = logLineFor('b23-fallback');

    expect(line).toContain('72.5%');
    // 没有还原度数据 → 显示「—」，而不是 0
    expect(line).toContain('还原度 —');
  });
});
