import { describe, expect, it } from 'vitest';

import { requiresAuthenticatedSession } from './track-policy';

describe('requiresAuthenticatedSession — 哪些埋点必须有会话', () => {
  it('生成生命周期事件一律要求会话（它们会写账本与看板）', () => {
    for (const type of [
      'generation_start',
      'generation_stage',
      'generation_complete',
      'generation_error',
      'generation_cancelled',
      'generation_quality',
    ]) {
      expect(requiresAuthenticatedSession(type)).toBe(true);
    }
  });

  it('纯分析埋点不要求会话（未登录访客也会产生）', () => {
    for (const type of ['page_visit', 'heartbeat', 'user_login', 'user_logout', 'search']) {
      expect(requiresAuthenticatedSession(type)).toBe(false);
    }
  });

  it('规则是严格前缀匹配（调用方别先做归一化，否则与本判定不一致）', () => {
    // 真实事件名都是小写 generation_*；大小写不同的变体不匹配
    expect(requiresAuthenticatedSession('Generation_start')).toBe(false);
    // 只有前缀、没有下划线的事件名不是本约定的事件
    expect(requiresAuthenticatedSession('generation')).toBe(false);
    expect(requiresAuthenticatedSession('')).toBe(false);
  });
});
