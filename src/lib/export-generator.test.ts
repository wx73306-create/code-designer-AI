import { describe, expect, it } from 'vitest';

import type { QAResult } from '@/types/agent';
import {
  escapeHtmlText,
  reconstructionMetaHtml,
  reconstructionMetaLines,
} from './export-generator';

/** 这三个函数只触碰 reconstructionMeta，用最小对象即可，避免造完整 QAResult。 */
function qaWith(meta: QAResult['reconstructionMeta']): QAResult {
  return { reconstructionMeta: meta } as QAResult;
}

describe('reconstructionMetaLines — Markdown 明细', () => {
  it('没有 meta（未采集）→ 一行都不输出', () => {
    expect(reconstructionMetaLines(qaWith(undefined))).toEqual([]);
  });

  it('有实测区块 → 输出数量与 role 序列', () => {
    const lines = reconstructionMetaLines(qaWith({ measuredSections: ['hero', 'nav', 'footer'] }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Measured Sections (3)');
    expect(lines[0]).toContain('hero, nav, footer');
  });

  it('有降级原因 → 输出原因，且不谎报区块', () => {
    const lines = reconstructionMetaLines(qaWith({ degradedReason: 'render-failed' }));
    expect(lines).toEqual(['  - Degraded Reason: render-failed']);
  });

  it('空 role 数组等同于没测到任何区块 —— 不输出这一行', () => {
    expect(reconstructionMetaLines(qaWith({ measuredSections: [] }))).toEqual([]);
  });

  it('两者都有 → 两行都出，顺序为「区块在前、原因在后」', () => {
    const lines = reconstructionMetaLines(
      qaWith({ measuredSections: ['hero'], degradedReason: 'no-truth' }),
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Measured Sections (1)');
    expect(lines[1]).toContain('Degraded Reason: no-truth');
  });
});

describe('reconstructionMetaHtml — HTML 报告段落', () => {
  it('没有 meta → 空字符串（不留空标签）', () => {
    expect(reconstructionMetaHtml(qaWith(undefined))).toBe('');
  });

  it('输出区块与原因', () => {
    const html = reconstructionMetaHtml(
      qaWith({ measuredSections: ['hero', 'cta'], degradedReason: 'timeout' }),
    );
    expect(html).toContain('<strong>Measured sections (2):</strong> hero, cta');
    expect(html).toContain('<strong>Degraded reason:</strong> timeout');
  });

  it('role 名 / reason 里的尖括号会被转义，不会打断标签', () => {
    const html = reconstructionMetaHtml(qaWith({ degradedReason: 'a<b>&c' }));
    expect(html).toContain('a&lt;b&gt;&amp;c');
    expect(html).not.toContain('<b>');
  });
});

describe('escapeHtmlText', () => {
  it('转义 & < >', () => {
    expect(escapeHtmlText('a & b')).toBe('a &amp; b');
    expect(escapeHtmlText('<script>')).toBe('&lt;script&gt;');
  });

  it('普通文本原样返回', () => {
    expect(escapeHtmlText('hero, nav')).toBe('hero, nav');
  });
});
