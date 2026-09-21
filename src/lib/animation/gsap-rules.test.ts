/**
 * GSAP Animation Agent — 测试
 *
 * 覆盖两件事：
 *   1. 模型输出的后处理（去 markdown 围栏）—— 这是产物能否直接内联的关键
 *   2. 动效上下文的格式化（含「未检测到动画」与「布局属性动画」两条分支）
 */

import { describe, it, expect } from 'vitest';
import {
  extractAnimationScript,
  formatAnimationContext,
  ANIMATION_SYSTEM_PROMPT,
} from './gsap-rules';
import type { WebsitePackage } from '@/types/website-package';

describe('extractAnimationScript', () => {
  it('strips a JavaScript markdown fence', () => {
    const raw = 'Sure! Here you go:\n```javascript\ngsap.to(".hero", { opacity: 1 });\n```\nLet me know.';

    expect(extractAnimationScript(raw)).toBe('gsap.to(".hero", { opacity: 1 });');
  });

  it('strips a fence with no language tag', () => {
    const raw = '```\ngsap.registerPlugin(ScrollTrigger);\n```';

    expect(extractAnimationScript(raw)).toBe('gsap.registerPlugin(ScrollTrigger);');
  });

  it('returns the raw input when no fence is present', () => {
    const raw = 'gsap.to(".a", { x: 10 });';

    expect(extractAnimationScript(raw)).toBe('gsap.to(".a", { x: 10 });');
  });

  it('returns an empty string for empty input', () => {
    expect(extractAnimationScript('')).toBe('');
  });
});

describe('formatAnimationContext', () => {
  const emptyPkg = { animations: [] } as Partial<WebsitePackage>;

  it('tells the agent to stay conservative when nothing was detected', () => {
    const text = formatAnimationContext(emptyPkg);

    expect(text).toContain('未检测到动画');
    expect(text).toContain('不要臆造');
  });

  it('handles a missing package without throwing', () => {
    expect(formatAnimationContext(null)).toContain('未检测到动画');
    expect(formatAnimationContext(undefined)).toContain('未检测到动画');
  });

  it('lists detected animations with their properties', () => {
    const pkg = {
      animations: [
        {
          name: 'fadeUp',
          type: 'entrance',
          duration: '0.8s',
          easing: 'ease-out',
          target: '.hero-title',
          properties: ['opacity', 'transform'],
        },
      ],
    } as Partial<WebsitePackage>;

    const text = formatAnimationContext(pkg);

    expect(text).toContain('fadeUp');
    expect(text).toContain('opacity, transform');
    expect(text).toContain('.hero-title');
  });

  it('warns when an animation moves layout properties', () => {
    const pkg = {
      animations: [
        { name: 'grow', type: 'keyframe', duration: '0.5s', easing: 'linear', target: '.bar', properties: ['width'] },
      ],
    } as Partial<WebsitePackage>;

    expect(formatAnimationContext(pkg)).toContain('布局属性');
  });

  it('adds a caution note when most animations are uncertain', () => {
    const pkg = {
      animations: [
        { name: 'a', type: 'transition', duration: '0.3s', easing: 'ease', target: '.a', uncertain: true },
        { name: 'b', type: 'transition', duration: '0.3s', easing: 'ease', target: '.b', uncertain: true },
      ],
    } as Partial<WebsitePackage>;

    expect(formatAnimationContext(pkg)).toContain('uncertain');
  });
});

describe('ANIMATION_SYSTEM_PROMPT', () => {
  it('embeds the two project-specific GSAP pitfalls', () => {
    // 踩坑 1：inline 残留覆盖 hover
    expect(ANIMATION_SYSTEM_PROMPT).toContain('clearProps');
    // 踩坑 2：内部滚动容器必须传 scroller
    expect(ANIMATION_SYSTEM_PROMPT).toContain('scroller');
  });

  it('restricts animation to transform and opacity', () => {
    expect(ANIMATION_SYSTEM_PROMPT).toContain('transform and opacity');
  });

  it('excludes plugins that are useless for website cloning', () => {
    for (const plugin of ['Draggable', 'Inertia', 'SplitText', 'MorphSVG']) {
      expect(ANIMATION_SYSTEM_PROMPT).toContain(plugin);
    }
  });
});
