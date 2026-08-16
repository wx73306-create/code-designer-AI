'use client';

import { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// LiquidParticles — AI Intelligence 空间粒子（Apple Vision Pro 风格）
// ---------------------------------------------------------------------------
// 小型玻璃光点缓慢漂浮，靠近鼠标时被轻柔吸引，形成"AI 智能在场"的氛围。
// Canvas + rAF 实现，零 React 重渲染；尊重 prefers-reduced-motion。
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;      // 色相（蓝紫青区间）
  alpha: number;
  pulse: number;    // 呼吸相位
}

const PARTICLE_COUNT = 25;
const MOUSE_RADIUS = 120;     // 鼠标吸引半径
const MOUSE_FORCE = 0.03;     // 吸引强度
const DRIFT = 0.12;           // 基础漂浮速度
const SPRITE_SIZE = 24;       // 预渲染光晕精灵大小

export default function LiquidParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 尊重系统减弱动效偏好
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999 };
    const particles: Particle[] = [];

    // ── Pre-render glow sprite (draw once, stamp many times) ──
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = SPRITE_SIZE * 2;
    spriteCanvas.height = SPRITE_SIZE * 2;
    const spriteCtx = spriteCanvas.getContext('2d')!;
    const grad = spriteCtx.createRadialGradient(SPRITE_SIZE, SPRITE_SIZE, 0, SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE);
    grad.addColorStop(0, 'hsla(240, 90%, 70%, 1)');
    grad.addColorStop(0.4, 'hsla(240, 90%, 65%, 0.3)');
    grad.addColorStop(1, 'hsla(240, 90%, 65%, 0)');
    spriteCtx.fillStyle = grad;
    spriteCtx.fillRect(0, 0, SPRITE_SIZE * 2, SPRITE_SIZE * 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const init = () => {
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * DRIFT,
          vy: (Math.random() - 0.5) * DRIFT,
          size: 1 + Math.random() * 1.8,
          hue: 200 + Math.random() * 90,
          alpha: 0.2 + Math.random() * 0.35,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    };

    const step = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        // 鼠标吸引
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MOUSE_RADIUS && dist > 0.001) {
          const pull = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
          p.vx += (dx / dist) * pull;
          p.vy += (dy / dist) * pull;
        }

        // 速度阻尼
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += 0.015;

        // 边界回绕
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        // 呼吸式明暗
        const twinkle = 0.7 + 0.3 * Math.sin(p.pulse);
        const a = p.alpha * twinkle;

        // 光晕 — stamp pre-rendered sprite (much faster than createRadialGradient)
        ctx.globalAlpha = a * 0.5;
        ctx.drawImage(spriteCanvas, p.x - SPRITE_SIZE, p.y - SPRITE_SIZE);

        // 核心亮点 — simple filled circle
        ctx.globalAlpha = Math.min(1, a + 0.2);
        ctx.fillStyle = `hsl(${p.hue}, 95%, 78%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(step);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    resize();
    init();
    raf = requestAnimationFrame(step);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
