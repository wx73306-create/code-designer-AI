'use client';

import { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// LiquidBackground — Apple Vision Pro / iOS Liquid Glass 动态液态背景
// ---------------------------------------------------------------------------
// 多层渐变液态 Blob（morph 变形 + float 漂浮）+ 噪点纹理 + 鼠标视差。
// 鼠标移动时通过 rAF 更新各视差层的 --lx/--ly CSS 变量，不触发 React 重渲染。
// ---------------------------------------------------------------------------

const BLOBS = [
  { className: 'liquid-blob-1', depth: 0.025 },
  { className: 'liquid-blob-2', depth: 0.04 },
  { className: 'liquid-blob-3', depth: 0.055 },
];

export default function LiquidBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const targetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // 尊重系统减弱动效偏好
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const layers = Array.from(root.querySelectorAll<HTMLElement>('.liquid-parallax'));

    if (reduce) return;

    const onMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetRef.current = { x: e.clientX - cx, y: e.clientY - cy };
      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(() => {
          const { x, y } = targetRef.current;
          for (const layer of layers) {
            const depth = parseFloat(layer.dataset.depth || '0.03');
            layer.style.setProperty('--lx', `${(x * depth).toFixed(1)}px`);
            layer.style.setProperty('--ly', `${(y * depth).toFixed(1)}px`);
          }
          frameRef.current = 0;
        });
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div ref={rootRef} className="liquid-bg" aria-hidden="true">
      {BLOBS.map((b) => (
        <div key={b.className} className="liquid-parallax" data-depth={b.depth}>
          <div className={`liquid-blob ${b.className}`} />
        </div>
      ))}
      <div className="liquid-noise" />
    </div>
  );
}
