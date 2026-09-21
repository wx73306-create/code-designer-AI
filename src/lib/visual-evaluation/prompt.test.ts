/**
 * Visual Evaluation Prompt 单测 —— Sprint B 的输入口径变更
 *
 * QA 的输入从「12000 字符 HTML 源码」升级为「两张截图 + Diff 报告」，
 * HTML 降级为 4KB 辅助参考。没有 diff 报告时退回旧口径（行为不退化）。
 */

import { describe, expect, it } from 'vitest';

import { buildVisualEvaluationUserMessage } from './prompt';

const HTML = 'x'.repeat(5000) + '<div id="tail-marker">TAIL</div>';
const DIFF = JSON.stringify({
  dimensions: { roleSequence: 80, heightProfile: 60 },
  notes: ['hero height -67%', '+rounded'],
});

describe('有 Diff 报告（新口径）', () => {
  const msg = buildVisualEvaluationUserMessage(HTML, '', '', 1, DIFF);

  it('以截图为主输入，明确告知注入了两张图', () => {
    expect(msg).toContain('两张截图');
    expect(msg).toContain('主要依据');
  });

  it('包含还原度 Diff 报告与人话标签', () => {
    expect(msg).toContain('还原度 Diff 报告');
    expect(msg).toContain('hero height -67%');
  });

  it('HTML 降级为 4KB 辅助 —— 尾部内容被截断', () => {
    expect(msg).toContain('辅助参考');
    expect(msg).not.toContain('id="tail-marker"');
  });
});

describe('无 Diff 报告（旧口径，行为不退化）', () => {
  const msg = buildVisualEvaluationUserMessage(HTML, '', '', 1);

  it('HTML 仍是主要输入（12000 字符窗口）', () => {
    expect(msg).toContain('网页渲染结果（HTML 结构）');
    expect(msg).toContain('id="tail-marker"');
  });

  it('不出现还原度报告段落', () => {
    expect(msg).not.toContain('还原度 Diff 报告');
  });
});
