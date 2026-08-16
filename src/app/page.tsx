'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Sparkles, Eye, Wand2, Bug, Rocket, CheckCircle2, RotateCcw, Loader2, Globe, Home, Check, Layout,
  Globe2, Palette, Code2, ShieldCheck, Download, MessageSquare,
  Zap, Brain, Layers, ArrowDown, Monitor, Cpu, ChevronRight, ArrowUpRight, ExternalLink, Square, Mail, Lock,
  User, Settings, LogOut, Heart, AlertTriangle, ChevronDown, Clock, FileText, Paintbrush,
  FolderOpen, X, Key,
} from "lucide-react";
import { useAgentStore } from "@/store/agent-store";
import { useWorkflow, cancelWorkflow } from "@/store/use-workflow";
import { useModelSettings } from "@/store/model-settings";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { track } from "@/lib/track";
import LiquidBackground from "@/components/liquid/LiquidBackground";
import LiquidParticles from "@/components/liquid/LiquidParticles";
import OpenAIShowcase from "@/components/showcase/OpenAIShowcase";

// ---- Data ----
const FEATURE_TAGS = [
  { label: "学习配色", icon: Palette, hint: "提取色彩体系", goal: "colors" as const,
    details: ["主色/辅色提取", "渐变方案分析", "色彩心理学应用", "暗色/亮色模式"], output: "配色 Token 文件" },
  { label: "学习排版", icon: Layers, hint: "解析布局结构", goal: "layout" as const,
    details: ["栅格系统识别", "间距韵律分析", "响应式断点", "组件层次结构"], output: "布局结构文档" },
  { label: "学习风格", icon: Sparkles, hint: "分析设计语言", goal: "style" as const,
    details: ["字体搭配方案", "圆角/阴影风格", "图标设计语言", "品牌视觉调性"], output: "风格指南报告" },
  { label: "学习特色", icon: Zap, hint: "挖掘亮点功能", goal: "features" as const,
    details: ["交互动效识别", "用户体验亮点", "独特功能拆解", "性能优化点"], output: "特色功能清单" },
  { label: "构建模板", icon: Code2, hint: "生成完整项目", goal: "template" as const,
    details: ["完整项目脚手架", "组件库生成", "路由/状态管理", "部署配置"], output: "可运行项目包" },
];

const PIPELINE_STEPS = [
  { id: 1, icon: Globe2, title: "网页读取", desc: "自动读取目标网站内容，解析页面结构与视觉信息", color: "#0071E3", duration: "~13s",
    tags: ["HTML 解析", "DOM 树", "资源加载", "CSSOM"] },
  { id: 2, icon: Eye, title: "视觉识别", desc: "AI 视觉模型截图分析页面布局、配色方案与设计语言", color: "#AF52DE", duration: "~13s",
    tags: ["截图分析", "布局检测", "配色提取", "字体识别"] },
  { id: 3, icon: Palette, title: "体系匹配", desc: "基于设计知识库四维评分，匹配最佳设计体系并生成 Design System", color: "#FF6482", duration: "~2s",
    tags: ["7 种风格", "四维评分", "Design Tokens", "设计规则"] },
  { id: 4, icon: Sparkles, title: "设计评审", desc: "理解原网页背后的设计逻辑，判断哪些保留、优化、重构，输出设计决策与高级感评分", color: "#FFD60A", duration: "~8s",
    tags: ["品牌定位", "视觉层级", "结构审查", "高级感评分"] },
  { id: 5, icon: Brain, title: "架构规划", desc: "智能拆分组件树、规划文件结构与数据流方案", color: "#FF9500", duration: "~9s",
    tags: ["组件拆分", "文件结构", "数据流", "依赖分析"] },
  { id: 6, icon: Code2, title: "代码生成", desc: "自动生成 React + TypeScript + TailwindCSS 项目代码", color: "#34C759", duration: "~22s",
    tags: ["React 19", "TypeScript", "TailwindCSS", "组件化"] },
  { id: 7, icon: ShieldCheck, title: "质量检测", desc: "自动运行代码检查、兼容性测试与性能优化建议", color: "#FF3B30", duration: "~27s",
    tags: ["代码审查", "兼容性", "性能测试", "可访问性"] },
  { id: 8, icon: Download, title: "信息导出", desc: "将分析结果与生成代码打包导出，支持多种格式下载", color: "#0A84FF", duration: "~16s",
    tags: ["JSON 导出", "Markdown", "压缩包", "一键部署"] },
];

const CORE_FEATURES = [
  { icon: Globe2, title: "逆向工程", anchor: "pipeline", desc: "从任意线上网站反推完整的前端工程结构，包括组件拆分、样式还原和交互逻辑。无需访问源代码，AI 通过视觉和 DOM 分析自动重建。", color: "#0071E3" },
  { icon: Code2, title: "代码生成", anchor: "features", desc: "基于现代技术栈（React 19 + TypeScript + TailwindCSS v4）生成高质量、可维护的生产级代码，遵循最佳实践与组件化设计。", color: "#34C759" },
  { icon: ShieldCheck, title: "质量保障", anchor: "features", desc: "内置自动化 QA 流程：代码规范检查、跨浏览器兼容性验证、性能基准测试和可访问性审计，确保输出代码开箱即用。", color: "#FF3B30" },
  { icon: Download, title: "一键导出", anchor: "features", desc: "支持多种导出格式：完整项目压缩包、独立组件代码片段、设计系统 Token 文件，以及一键部署到 Vercel 等主流托管平台。", color: "#0A84FF" },
];

const PRINCIPLES = [
  { icon: Zap, title: "极速", subtitle: "Speed First", desc: "从输入 URL 到获得完整项目，平均耗时不到 2 分钟。八个 AI Agent 流水线并行协作，最大化效率。" },
  { icon: Monitor, title: "精准", subtitle: "Pixel Perfect", desc: "视觉 AI 逐像素比对还原，组件级精确匹配。生成的代码与原始设计高度一致，减少人工调整。" },
  { icon: Brain, title: "智能", subtitle: "AI Native", desc: "不是简单的模板套用，而是真正理解设计意图。自动推断组件语义、状态管理和最佳文件组织方式。" },
];

const STATS = [
  { value: 8, label: "AI Agent 协作", suffix: "个" },
  { value: 2, label: "平均完成时间", suffix: "分钟", prefix: "< " },
  { value: 95, label: "视觉还原度", suffix: "%" },
  { value: 100, label: "支持组件类型", suffix: "+" },
];

const SHOWCASE = [
  { id: "nexusmind", img: "/showcase/nexusmind.jpg", title: "NexusMind", category: "AI 协作平台", color: "#1a1a2e",
    subtitle: "AI 重新构建人机协作统一工作区", similarity: 97,
    designDNA: { style: "Dark Cosmic", color: "Deep Space Blue", typography: "Geometric Sans", layout: "Dashboard Grid" } },
  { id: "adventure", img: "/showcase/adventure.jpg", title: "Adventure", category: "旅游探索", color: "#2d5016",
    subtitle: "AI 重现自然山脉全景沉浸式体验", similarity: 96,
    designDNA: { style: "Immersive Nature", color: "Forest Green", typography: "Editorial Serif", layout: "Full Bleed Hero" } },
  { id: "dune", img: "/showcase/netflix-dune.jpg", title: "Netflix · Dune", category: "影视娱乐", color: "#0a1628",
    subtitle: "AI 重构流媒体电影视觉叙事", similarity: 95,
    designDNA: { style: "Cinematic Dark", color: "Midnight Blue", typography: "Condensed Bold", layout: "Card Carousel" } },
  { id: "joker", img: "/showcase/joker.jpg", title: "Joker", category: "电影宣传", color: "#1a0a0a",
    subtitle: "AI 还原暗色电影高对比视觉冲击", similarity: 98,
    designDNA: { style: "High Contrast", color: "Crimson Black", typography: "Dramatic Display", layout: "Single Focus" } },
  { id: "vsolar", img: "/showcase/vsolar.jpg", title: "V Solar", category: "新能源科技", color: "#1a3a2a",
    subtitle: "AI 构建未来风太阳能科技美学", similarity: 94,
    designDNA: { style: "Futuristic Clean", color: "Solar Green", typography: "Tech Sans", layout: "Split Section" } },
  { id: "polaris", img: "/showcase/polaris.jpg", title: "Polaris AI", category: "数据智能", color: "#3d2b1a",
    subtitle: "AI 重塑沙漠主题数据分析平台", similarity: 93,
    designDNA: { style: "Data Desert", color: "Sand Brown", typography: "Mono Hybrid", layout: "Analytics Grid" } },
  { id: "forests", img: "/showcase/forests.jpg", title: "Forests", category: "环境教育", color: "#0d2818",
    subtitle: "AI 再现森林生态交互式叙事", similarity: 96,
    designDNA: { style: "Organic Green", color: "Emerald", typography: "Rounded Sans", layout: "Scroll Story" } },
  { id: "astra", img: "/showcase/astra.jpg", title: "Astra Odyssey", category: "太空探索", color: "#0d0d1a",
    subtitle: "AI 重建深空数据可视化仪表盘", similarity: 92,
    designDNA: { style: "Space Dark", color: "Nebula Purple", typography: "Sci-Fi Mono", layout: "Mission Control" } },
  { id: "desert", img: "/showcase/desert-adventure.jpg", title: "Desert Explorer", category: "旅行冒险", color: "#2a1f14",
    subtitle: "AI 还原沙漠探险沉浸式排版", similarity: 96,
    designDNA: { style: "Minimal Warm", color: "Desert Sand", typography: "Oversized Sans", layout: "Editorial" } },
  { id: "zrobim", img: "/showcase/zrobim-terra.jpg", title: "ZROBIM · Terra", category: "建筑作品集", color: "#1a1d21",
    subtitle: "AI 重构暗色建筑作品集美学", similarity: 95,
    designDNA: { style: "Architectural Dark", color: "Charcoal", typography: "Bold Grotesk", layout: "Gallery Grid" } },
];

// ====================================================================
// Glass Particle System — Apple Liquid Glass Edition
// ====================================================================

// useMouseParallax removed — mouse tracking now uses refs + DOM manipulation for 0 re-renders

interface GlassParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  blur: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
  layer: "bg" | "mid" | "fg";
  rotate: boolean;
}

/**
 * Deterministic seeded PRNG (mulberry32).
 *
 * Why: particles were previously positioned with Math.random() during render,
 * so the server (SSR) and the client (hydration) each produced a *different*
 * set of coordinates -> React hydration mismatch error + full client re-render.
 * Using a fixed seed makes server and client output byte-for-byte identical,
 * which both fixes the hydration error and avoids any "pop-in" of particles.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useGlassParticles(count: number, opts?: { theme?: "light" | "dark"; seed?: number }): GlassParticle[] {
  const lightColors = useMemo(() => [
    "rgba(0, 113, 227, 0.22)",
    "rgba(175, 82, 222, 0.16)",
    "rgba(255, 149, 0, 0.12)",
    "rgba(52, 199, 89, 0.14)",
    "rgba(10, 132, 255, 0.18)",
    "rgba(255, 59, 48, 0.10)",
    "rgba(0, 199, 190, 0.12)",
    "rgba(255, 214, 10, 0.08)",
  ], []);
  const darkColors = useMemo(() => [
    "rgba(255, 255, 255, 0.25)",
    "rgba(120, 180, 255, 0.20)",
    "rgba(200, 160, 255, 0.15)",
    "rgba(130, 255, 200, 0.12)",
    "rgba(255, 200, 120, 0.10)",
  ], []);
  const theme = opts?.theme || "light";
  // Derive a stable default seed from count + theme so that different instances
  // get different (but deterministic) layouts, while SSR === client hydration.
  const seed = opts?.seed ?? ((count * 2654435761 + (theme === "dark" ? 7919 : 104729)) >>> 0);

  return useMemo(() => {
    const rand = mulberry32(seed);
    const colors = theme === "dark" ? darkColors : lightColors;
    return Array.from({ length: count }, (_, i) => {
      const r = rand();
      let layer: "bg" | "mid" | "fg";
      let size: number;
      let blur: number;
      let opacity: number;

      if (r < 0.35) {
        // Background: large, blurry, dim
        layer = "bg";
        size = 120 + rand() * 260;
        blur = 35 + rand() * 65;
        opacity = 0.25 + rand() * 0.25;
      } else if (r < 0.72) {
        // Mid: medium, moderate blur
        layer = "mid";
        size = 20 + rand() * 70;
        blur = 4 + rand() * 18;
        opacity = 0.45 + rand() * 0.45;
      } else {
        // Foreground: small sparkles, sharp
        layer = "fg";
        size = 2 + rand() * 10;
        blur = 0;
        opacity = 0.5 + rand() * 0.5;
      }

      return {
        id: i,
        x: rand() * 100,
        y: rand() * 100,
        size,
        color: colors[i % colors.length],
        blur,
        duration: 14 + rand() * 28,
        delay: -rand() * 25,
        drift: 20 + rand() * 80,
        opacity,
        layer,
        rotate: rand() > 0.7,
      };
    });
  }, [count, lightColors, darkColors, theme, seed]);
}

/** Multi-layer glass particles — memoized, no mouse dependency for performance */
const GlassParticles = React.memo(function GlassParticles({ particles, lightRays = false }: {
  particles: GlassParticle[];
  lightRays?: boolean;
}) {
  const bgParticles = useMemo(() => particles.filter((p) => p.layer === "bg"), [particles]);
  const midParticles = useMemo(() => particles.filter((p) => p.layer === "mid"), [particles]);
  const fgParticles = useMemo(() => particles.filter((p) => p.layer === "fg"), [particles]);

  const renderParticle = (p: GlassParticle) => {
    const isSparkle = p.layer === "fg";
    return (
      <motion.div
        key={p.id}
        className="absolute"
        style={{
          left: `${p.x}%`,
          top: `${p.y}%`,
          width: p.size,
          height: p.size,
          borderRadius: "50%",
          background: isSparkle
            ? `radial-gradient(circle, ${p.color} 0%, transparent 60%)`
            : `radial-gradient(circle at 30% 30%, ${p.color}, transparent 70%)`,
          opacity: p.opacity,
          willChange: "transform",
        }}
        animate={{
          x: [0, p.drift * 0.4, -p.drift * 0.25, 0],
          y: [0, -p.drift * 0.35, p.drift * 0.2, 0],
          opacity: isSparkle
            ? [0, p.opacity, p.opacity * 0.6, 0]
            : [p.opacity, p.opacity * 0.9, p.opacity, p.opacity],
        }}
        transition={{
          duration: p.duration * 0.7,
          repeat: Infinity,
          ease: "linear",
          delay: p.delay,
        }}
      />
    );
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ isolation: "isolate" }}>
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        {bgParticles.map(renderParticle)}
      </div>
      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        {midParticles.map(renderParticle)}
      </div>
      <div className="absolute inset-0" style={{ zIndex: 3 }}>
        {fgParticles.map(renderParticle)}
      </div>
      {lightRays && (
        <>
          <div className="light-ray light-ray-1" />
          <div className="light-ray light-ray-2" />
          <div className="light-ray light-ray-3" />
        </>
      )}
      <div className="grain-overlay" />
    </div>
  );
});

// ====================================================================
// Interactive Components
// ====================================================================

/** Apple Liquid Glass card with specular highlights + mouse spotlight */
function LiquidGlassCard({ children, className = "", glowColor = "rgba(0,113,227,0.25)", interactive = true }: {
  children: React.ReactNode; className?: string; glowColor?: string; interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouse = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`glass-liquid relative overflow-hidden ${className}`}
    >
      {/* Mouse spotlight border */}
      {interactive && (
        <div
          className="pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: hovered ? 1 : 0,
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
            WebkitMaskComposite: "xor",
            padding: "1.5px",
            background: `radial-gradient(250px circle at ${pos.x}px ${pos.y}px, ${glowColor}, transparent 60%)`,
          }}
        />
      )}
      {/* Specular highlight following mouse */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-500"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(350px circle at ${pos.x}px ${pos.y}px, rgba(255,255,255,0.12), transparent 50%)`,
        }}
      />
      {/* Top specular line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** 3D tilt card */
function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [3, -3]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-3, 3]), { stiffness: 300, damping: 30 });

  function handleMouse(e: React.MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleLeave() { x.set(0); y.set(0); }

  return (
    <motion.div ref={ref} onMouseMove={handleMouse} onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000 }} className={className}>
      {children}
    </motion.div>
  );
}

/** Animated counter */
function AnimatedCounter({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, { stiffness: 50, damping: 25 });
  const [display, setDisplay] = useState("0");
  useEffect(() => { if (isInView) motionVal.set(value); }, [isInView, value, motionVal]);
  useEffect(() => { const u = springVal.on("change", (v) => setDisplay(Math.round(v).toString())); return u; }, [springVal]);
  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

/** Agent step card — vertical glass card matching screenshot */
function PipelineStep({ step, index }: { step: typeof PIPELINE_STEPS[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.07, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.08)", transition: { duration: 0.3 } }}
      className="group relative rounded-[20px] p-6 cursor-pointer flex flex-col"
      style={{
        background: "rgba(255,255,255,0.75)",
        border: "1px solid rgba(255,255,255,0.8)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
      }}
    >
      {/* Number badge — top left */}
      <div
        className="inline-flex items-center justify-center rounded-xl text-[12px] font-bold text-white mb-5"
        style={{ width: 45, height: 30, background: `linear-gradient(135deg, ${step.color}, ${step.color}cc)` }}
      >
        {String(step.id).padStart(2, '0')}
      </div>

      {/* Circular icon area — center */}
      <div className="flex justify-center mb-5">
        <motion.div
          whileHover={{ rotate: 8, transition: { duration: 0.3 } }}
          className="rounded-full flex items-center justify-center"
          style={{ width: 80, height: 80, background: `${step.color}12` }}
        >
          <step.icon className="w-10 h-10" style={{ color: step.color }} />
        </motion.div>
      </div>

      {/* Title */}
      <h3 className="text-[20px] font-bold text-[#1a1a2e] text-center mb-2">{step.title}</h3>

      {/* Description */}
      <p className="text-[13px] text-[#64748B] leading-[1.8] text-center mb-5 line-clamp-3 flex-1">{step.desc}</p>

      {/* Bottom: time + arrow */}
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-1.5 text-[12px] text-[#94A3B8] font-mono">
          <Clock className="w-3.5 h-3.5" />
          <span>{step.duration}</span>
        </div>
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: `${step.color}12` }}
        >
          <ChevronRight className="w-4 h-4" style={{ color: step.color }} />
        </motion.div>
      </div>
    </motion.div>
  );
}

/** Fade-in */
function FadeIn({ children, delay = 0, className = "", direction = "up" }: {
  children: React.ReactNode; delay?: number; className?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const d = { up: { y: 40, x: 0 }, down: { y: -40, x: 0 }, left: { x: 40, y: 0 }, right: { x: -40, y: 0 }, none: { x: 0, y: 0 } };
  return (
    <motion.div ref={ref} initial={{ opacity: 0, ...d[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ delay, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }} className={className}>
      {children}
    </motion.div>
  );
}

// ====================================================================
// Interactive Title — mouse-following color gradient
// ====================================================================

function InteractiveTitle() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 200, damping: 20, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 200, damping: 20, mass: 0.4 });

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    let hovering = false;
    const onEnter = () => { hovering = true; };
    const onLeave = () => { hovering = false; mx.set(0.5); my.set(0.5); };
    const onMove = (e: MouseEvent) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      mx.set(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
      my.set(Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
    };
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('mousemove', onMove);
    const u = sx.on('change', v => {
      if (!el) return;
      const yv = sy.get();
      if (hovering) {
        el.style.backgroundImage = [
          `radial-gradient(500px circle at ${v * 100}% ${yv * 100}%, rgba(0,113,227,0.5), transparent 45%)`,
          `radial-gradient(350px circle at ${v * 100}% ${yv * 100}%, rgba(175,82,222,0.28), transparent 45%)`,
          'linear-gradient(180deg, #1d1d1f 0%, #1d1d1f 40%, #0071E3 100%)',
        ].join(', ');
      } else {
        el.style.backgroundImage = 'linear-gradient(180deg, #1d1d1f 0%, #1d1d1f 40%, #0071E3 100%)';
      }
    });
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('mousemove', onMove);
      u();
    };
  }, [mx, my, sx, sy]);

  return (
    <div className="relative">
      <motion.h1
        ref={titleRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7 }}
        className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.08] bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(0,113,227,0.12)] cursor-default select-none"
        style={{
          fontFamily: "var(--font-display)",
          letterSpacing: "-0.03em",
          backgroundImage: 'linear-gradient(180deg, #1d1d1f 0%, #1d1d1f 40%, #0071E3 100%)',
        }}
      >
        Code Designer AI
      </motion.h1>
      {/* Aura-inspired: periodic shimmer sweep across title */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(105deg, transparent 30%, rgba(0,113,227,0.10) 43%, rgba(0,210,255,0.14) 50%, rgba(0,113,227,0.10) 57%, transparent 70%)',
            backgroundSize: '300% 100%',
            animation: 'shiny-sweep 5s ease-in-out infinite',
            mixBlendMode: 'screen' as const,
          }}
        />
      </div>
    </div>
  );
}

// ====================================================================
// ====================================================================
// Showcase Components — AI Design Showcase (OpenAI-style)
// ====================================================================

/** Large featured showcase (left 70%) — full bleed image + bottom text overlay */
function ShowcaseFeatured({ item, onReplicate }: {
  item: typeof SHOWCASE[0];
  onReplicate?: (url: string) => void;
}) {
  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="group relative rounded-3xl overflow-hidden cursor-pointer"
      style={{ height: 520 }}
      onClick={() => onReplicate?.(`https://${item.id}.com`)}
    >
      {/* Full bleed image */}
      <img
        src={item.img}
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        loading="lazy"
      />
      {/* Gradient overlay — bottom heavy for text */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Bottom content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-8">
        {/* Category + Similarity */}
        <div className="flex items-center gap-3 mb-3">
          <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-medium text-white/90 border border-white/10">
            {item.category}
          </span>
          <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-bold text-white border border-white/10">
            {item.similarity}% Visual Match
          </span>
        </div>

        {/* Title — large, bold */}
        <h3 className="text-[32px] sm:text-[40px] font-bold text-white leading-tight tracking-tight mb-2">
          {item.title}
        </h3>

        {/* Subtitle — product story */}
        <p className="text-[15px] text-white/70 mb-4 max-w-[400px]">
          {item.subtitle}
        </p>

        {/* Design DNA tags */}
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(item.designDNA).map(([key, val]) => (
            <span key={key} className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-sm text-[10px] text-white/60 border border-white/[0.08]">
              {val}
            </span>
          ))}
        </div>

        {/* CTA */}
        <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          查看案例
          <span className="text-[16px]">→</span>
        </span>
      </div>
    </motion.div>
  );
}

/** Small showcase card (right 30%) — image + product story */
function ShowcaseCard({ item, index, isActive, onSelect, className }: {
  item: typeof SHOWCASE[0]; index: number; isActive?: boolean; onSelect: () => void; className?: string;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      onClick={onSelect}
      className={`w-full text-left rounded-2xl overflow-hidden border bg-white transition-all duration-300 cursor-pointer group ${
        isActive
          ? "border-[#6B5CE7]/40 shadow-[0_4px_20px_rgba(107,92,231,0.1)] ring-1 ring-[#6B5CE7]/20"
          : "border-[#e5e5e5] hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:border-[#d5d5d5]"
      } ${className || ''}`}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[#f0f0f0]">
        <img
          src={item.img}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
        {/* Similarity badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] font-bold text-white">
            {item.similarity}%
          </span>
        </div>
      </div>
      {/* Product story */}
      <div className="p-4">
        <h4 className="text-[15px] font-bold text-[#0d0d0d] mb-1">{item.title}</h4>
        <p className="text-[12px] text-[#888] leading-relaxed line-clamp-2">{item.subtitle}</p>
      </div>
    </motion.button>
  );
}

// ====================================================================
// Page
// ====================================================================

// ====================================================================
// Page
// ====================================================================

export default function HomePage() {
  useWorkflow();
  const isRunning = useAgentStore((s) => s.isRunning);
  const taskStatus = useAgentStore((s) => s.task.status);
  const taskUrl = useAgentStore((s) => s.task.url);
  const taskMode = useAgentStore((s) => s.task.mode);
  const startTask = useAgentStore((s) => s.startTask);
  const resetTask = useAgentStore((s) => s.resetTask);
  const cancelTask = useAgentStore((s) => s.cancelTask);

  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<number | null>(null);
  const [selectedMode, setSelectedMode] = useState<"clone" | "enhancement">("enhancement");
  const [showcaseFilter, setShowcaseFilter] = useState<string>("全部");
  const [showcaseFeatured, setShowcaseFeatured] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; email: string; avatar: string } | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [activeModal, setActiveModal] = useState<'profile' | 'preferences' | 'account' | null>(null);
  const [projectHistory, setProjectHistory] = useState<Array<{ id: string; url: string; date: string; status: string }>>([]);
  const [genEnabled, setGenEnabled] = useState(true);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const modelProviders = useModelSettings((s) => s.providers);
  // 自动选择第一个已启用的模型
  const firstEnabledProvider = modelProviders.find((p) => p.enabled) ?? modelProviders[0];
  const [selectedProvider, setSelectedProvider] = useState(firstEnabledProvider?.id ?? "");
  const activeProvider = modelProviders.find((p) => p.id === selectedProvider) ?? firstEnabledProvider;
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number; allowed: boolean } | null>(null);
  const SHOWCASE_CATEGORIES = ["全部", "AI 协作", "影视娱乐", "科技", "教育", "旅行冒险", "建筑作品集"];
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  const showcaseParticles = useGlassParticles(20);
  const sectionParticles = useGlassParticles(12);

  // ---- 实时埋点：页面访问 + 登录态恢复 + 心跳 ----
  useEffect(() => {
    track({ type: "page_visit", path: "/" });
    try {
      const raw = sessionStorage.getItem("cd_user");
      if (raw) {
        const u = JSON.parse(raw) as { name: string; email: string };
        // 先乐观恢复前端状态
        setIsLoggedIn(true);
        setUserInfo({ name: u.name, email: u.email, avatar: u.name.charAt(0).toUpperCase() });
        // 再向服务端验证 session cookie 是否仍有效
        fetch("/api/user/me", { credentials: "include" })
          .then((r) => {
            if (!r.ok) {
              // Cookie 过期或无效，清除登录态
              setIsLoggedIn(false);
              setUserInfo(null);
              sessionStorage.removeItem("cd_user");
            }
          })
          .catch(() => {});
      }
    } catch { /* ignore */ }
    const heartbeat = setInterval(() => {
      try {
        const raw = sessionStorage.getItem("cd_user");
        if (raw) track({ type: "heartbeat", email: (JSON.parse(raw) as { email: string }).email });
      } catch { /* ignore */ }
    }, 60000);
    return () => clearInterval(heartbeat);
  }, []);

  // ---- 轮询系统总开关状态（管理员可实时关停生成服务） ----
  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/system-status", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => { if (alive) setGenEnabled(d.generationEnabled ?? true); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // ---- 轮询当前用户生成配额（与后台配额设置实时联动） ----
  useEffect(() => {
    if (!userInfo?.email) { setQuota(null); return; }
    let alive = true;
    const load = () => {
      fetch(`/api/quota-status?email=${encodeURIComponent(userInfo.email)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (alive && typeof d.used === "number") {
            setQuota({ used: d.used, limit: d.limit, remaining: d.remaining, allowed: d.allowed });
          }
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 8000);
    return () => { alive = false; clearInterval(id); };
  }, [userInfo?.email, isRunning]);

  // ---- 登录弹窗：Escape 键关闭（可访问性） ----
  useEffect(() => {
    if (!showLoginModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLoginModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showLoginModal]);

  const isIdle = taskStatus === "idle";
  const isCompleted = !isRunning && taskStatus === "completed";
  const isFailed = !isRunning && taskStatus === "error";
  const failedTask = useAgentStore((s) => s.task);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || isRunning) return;
    // 总开关关闭时禁止生成
    if (!genEnabled) return;
    // Require login before generating
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    // 配额用完时禁止生成
    if (quota && !quota.allowed) return;
    const goal = selectedGoal !== null ? FEATURE_TAGS[selectedGoal]?.goal : null;
    startTask(trimmed, goal, prompt.trim(), selectedMode, selectedProvider);
  }

  async function handleLogin(email: string, password: string) {
    // 先尝试管理员登录：由服务端校验凭据并写入 httpOnly 会话 Cookie
    // （前端不再硬编码管理员账号密码）
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        sessionStorage.setItem("cd_user", JSON.stringify({ name: "Admin", email }));
        track({ type: "user_login", name: "Admin", email, isAdmin: true });
        window.location.href = "/admin/dashboard";
        return;
      }
    } catch {
      // 管理员登录接口不可用时，回落到普通用户登录
    }
    // Regular user login — 建立服务端会话（httpOnly Cookie，用于配额等服务端鉴权）
    try {
      const res = await fetch("/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const name = data.name || email.split("@")[0];
        const initial = name.charAt(0).toUpperCase();
        setIsLoggedIn(true);
        setUserInfo({ name, email, avatar: initial });
        setShowLoginModal(false);
        sessionStorage.setItem("cd_user", JSON.stringify({ name, email }));
        track({ type: "user_login", name, email });
        return;
      }
      // 服务端返回了具体错误（如邮箱格式无效、密码错误、限流等）
      alert(data.message || `登录失败 (${res.status})`);
      return;
    } catch {
      // 网络错误等服务端不可用情况
      alert("登录失败：无法连接到服务器，请检查网络连接。");
    }
  }

  function handleLogout() {
    setIsLoggedIn(false);
    setUserInfo(null);
    setShowProfileMenu(false);
    sessionStorage.removeItem("cd_user");
    fetch("/api/user/logout", { method: "POST" }).catch(() => {});
  }
  function handleRerun() {
    const savedPrompt = useAgentStore.getState().task.prompt;
    const savedMode = useAgentStore.getState().task.mode;
    const savedModel = useAgentStore.getState().task.model;
    resetTask();
    setTimeout(() => { if (taskUrl) startTask(taskUrl, undefined, savedPrompt, savedMode, savedModel || selectedProvider); }, 300);
  }
  function handleCancel() {
    cancelWorkflow();
    cancelTask();
    setTimeout(() => { resetTask(); }, 100);
  }
  function scrollTo(id: string) {
    const c = scrollRef.current; const el = document.getElementById(id);
    if (c && el) smoothScrollTo(c, el.offsetTop - c.offsetTop, 600);
  }

  /** Custom rAF smooth scroll — pauses heavy animations during scroll to prevent jank */
  function smoothScrollTo(container: HTMLElement, targetTop: number, duration: number) {
    // Add scrolling class to disable animations/compositing during scroll
    container.classList.add('is-scrolling');

    const startTop = container.scrollTop;
    const distance = targetTop - startTop;
    const startTime = performance.now();

    function step(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for natural deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      container.scrollTop = startTop + distance * eased;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        // Scroll complete — remove class to re-enable animations
        requestAnimationFrame(() => {
          container.classList.remove('is-scrolling');
        });
      }
    }

    requestAnimationFrame(step);
  }

  function scrollToTop() {
    const el = scrollRef.current;
    if (el) {
      smoothScrollTo(el, 0, 700);
      setTimeout(() => inputRef.current?.focus(), 800);
    }
  }

  return (
    <div className="relative bg-[#fafafa]">
      {/* Aura-inspired: fixed SVG grain texture overlay (subtle paper-like feel) */}
      <div className="grain-overlay-fixed" />
      {/* Vertical guide lines at container edges — premium structural element */}
      <div className="hidden md:block guide-line guide-line-left" />
      <div className="hidden md:block guide-line guide-line-right" />

      <AnimatePresence mode="wait">
        {isIdle ? (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }} ref={scrollRef} className="h-screen overflow-y-auto">

            {/* ===== TOP NAVIGATION BAR ===== */}
            <nav className="sticky top-0 z-50 border-b border-black/[0.04]" style={{ background: "rgba(245,245,247,0.85)", backdropFilter: "blur(20px) saturate(1.8)", WebkitBackdropFilter: "blur(20px) saturate(1.8)" }}>
              <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#0071E3] flex items-center justify-center">
                      <Code2 className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-[#1d1d1f]">Code Designer AI</span>
                  </div>
                  <div className="hidden md:flex items-center gap-6">
                    {[
                      { label: "功能", target: "features", hint: "逆向工程 · 代码生成 · 质量保障 · 一键导出" },
                      { label: "特点", target: "features", hint: "四大核心功能模块" },
                      { label: "如何使用", target: "intro-section", hint: "八步 AI 流水线，从读取到导出全自动" },
                      { label: "案例", target: "showcase-section", hint: "逆向工程成功案例展示" },
                      { label: "定价", target: "cta-section", hint: "免费体验，输入 URL 即可生成" },
                    ].map(({ label, target, hint }) => (
                      <div key={label} className="relative group/nav">
                        <button onClick={() => scrollTo(target)}
                          className="text-sm text-black/50 hover:text-[#1d1d1f] transition-colors cursor-pointer">{label}</button>
                        {/* Hover tooltip */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 opacity-0 group-hover/nav:opacity-100 translate-y-1 group-hover/nav:translate-y-0 transition-all duration-200 pointer-events-none">
                          <div className="whitespace-nowrap text-[11px] text-black/60 bg-white/95 border border-black/[0.06] rounded-lg px-3 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
                            style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
                            {hint}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isLoggedIn && userInfo ? (
                    /* Logged in: avatar + dropdown */
                    <div className="relative">
                      <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0071E3] to-[#6B5CE7] flex items-center justify-center text-white text-xs font-bold cursor-pointer shadow-[0_2px_8px_rgba(0,113,227,0.25)]"
                      >
                        {userInfo.avatar}
                      </motion.button>

                      {/* Profile dropdown */}
                      <AnimatePresence>
                        {showProfileMenu && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                              className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl overflow-hidden"
                              style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.03)" }}
                            >
                              {/* User info header */}
                              <div className="px-4 py-3.5 border-b border-black/[0.04]">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0071E3] to-[#6B5CE7] flex items-center justify-center text-white text-sm font-bold shrink-0">
                                    {userInfo.avatar}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[#1d1d1f] truncate">{userInfo.name}</p>
                                    <p className="text-[11px] text-black/35 truncate">{userInfo.email}</p>
                                  </div>
                                </div>
                                <div className="mt-2.5 flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/15">免费版</span>
                                  <span className="text-[10px] text-black/25">{quota ? `${quota.remaining} / ${quota.limit} 次/天` : '— 次/天'}</span>
                                </div>
                              </div>

                              {/* 我的项目 */}
                              <div className="px-4 py-2.5 border-b border-black/[0.04]">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-semibold text-black/30 uppercase tracking-wider">我的项目</p>
                                  <span className="text-[9px] text-black/20">{projectHistory.length} 个</span>
                                </div>
                                {projectHistory.length > 0 ? (
                                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                    {projectHistory.slice(0, 5).map((proj) => (
                                      <div key={proj.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-black/[0.03] transition-colors cursor-pointer group">
                                        <div className="w-6 h-6 rounded-md bg-[#0071E3]/8 flex items-center justify-center shrink-0">
                                          <Globe className="w-3 h-3 text-[#0071E3]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[11px] font-medium text-[#1d1d1f] truncate">{proj.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</p>
                                          <p className="text-[9px] text-black/25">{proj.date}</p>
                                        </div>
                                        <Download className="w-3 h-3 text-black/20 group-hover:text-[#0071E3] transition-colors shrink-0" />
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-3">
                                    <FolderOpen className="w-5 h-5 text-black/15 mx-auto mb-1.5" />
                                    <p className="text-[10px] text-black/25">暂无项目，开始生成你的第一个复刻</p>
                                  </div>
                                )}
                              </div>

                              {/* Menu items */}
                              <div className="py-1.5">
                                {[
                                  { icon: User, label: "个人资料", desc: "查看和编辑个人信息", action: 'profile' as const },
                                  { icon: Heart, label: "偏好设置", desc: "主题、语言、通知", action: 'preferences' as const },
                                  { icon: Settings, label: "账号设置", desc: "密码、安全、订阅", action: 'account' as const },
                                ].map(({ icon: Icon, label, desc, action }) => (
                                  <button
                                    key={label}
                                    onClick={() => { setShowProfileMenu(false); setActiveModal(action); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.03] transition-colors cursor-pointer text-left"
                                  >
                                    <div className="w-7 h-7 rounded-lg bg-black/[0.04] flex items-center justify-center shrink-0">
                                      <Icon className="w-3.5 h-3.5 text-black/40" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-xs font-medium text-[#1d1d1f]">{label}</p>
                                      <p className="text-[10px] text-black/30">{desc}</p>
                                    </div>
                                    <ChevronRight className="w-3 h-3 text-black/15" />
                                  </button>
                                ))}
                              </div>

                              {/* Logout */}
                              <div className="border-t border-black/[0.04] py-1.5">
                                <button
                                  onClick={handleLogout}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors cursor-pointer text-left"
                                >
                                  <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                                    <LogOut className="w-3.5 h-3.5 text-[#FF3B30]" />
                                  </div>
                                  <p className="text-xs font-medium text-[#FF3B30]">退出登录</p>
                                </button>
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    /* Not logged in: login button */
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setShowLoginModal(true)}
                      className="liquid-glass-btn px-4 py-1.5 rounded-full text-sm font-medium text-white cursor-pointer"
                      style={{ background: "linear-gradient(135deg, #6B5CE7 0%, #AF52DE 100%)" }}>
                      登录 / 注册
                    </motion.button>
                  )}
                </div>
              </div>
            </nav>

            {/* ===== HERO — Two-Column Layout ===== */}
            <section id="hero-section" ref={heroRef}
              className="relative min-h-[calc(100vh-3.5rem)] flex items-center overflow-hidden">

              {/* Background: clean white gradient */}
              <div className="absolute inset-0" style={{
                background: "linear-gradient(180deg, #ffffff 0%, #fafafa 50%, #f5f5f7 100%)"
              }} />

              {/* Dynamic Liquid Glass background — morphing blobs + mouse parallax */}
              <LiquidBackground />

              {/* AI Intelligence particles — mouse-attracted light points */}
              <LiquidParticles />

              {/* Decorative: static translucent circles (no animation for performance) */}
              <div className="pointer-events-none absolute w-[500px] h-[500px] rounded-full opacity-[0.06] left-[-5%] top-[10%] will-change-transform"
                style={{ background: "radial-gradient(circle, #AF52DE, transparent 65%)" }} />
              <div className="pointer-events-none absolute w-[350px] h-[350px] rounded-full opacity-[0.04] right-[5%] bottom-[5%] will-change-transform"
                style={{ background: "radial-gradient(circle, #0071E3, transparent 65%)" }} />

              {/* Decorative: large semi-transparent </> code brackets on the left */}
              <div className="pointer-events-none absolute left-[-2%] top-[15%] text-[14rem] font-bold leading-none opacity-[0.04] select-none" style={{ color: "#6B5CE7", fontFamily: "monospace" }}>
                {"</>"}
              </div>
              <div className="pointer-events-none absolute left-[8%] bottom-[8%] text-[8rem] font-bold leading-none opacity-[0.03] select-none rotate-12" style={{ color: "#6B5CE7", fontFamily: "monospace" }}>
                {"</>"}
              </div>

              {/* Section grain */}
              <div className="section-grain" />

              <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-16 lg:py-20">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

                  {/* ── LEFT COLUMN: Text + Input + Tags ── */}
                  <div className="flex flex-col items-start">
                    {/* Badge pill */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }} className="mb-6">
                      <motion.span whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium text-[#6B5CE7] bg-[#6B5CE7]/8 border border-[#6B5CE7]/15 tracking-wide cursor-default">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI 驱动的网页逆向工程
                      </motion.span>
                    </motion.div>

                    {/* Title */}
                    <motion.h1
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.7 }}
                      className="text-4xl sm:text-5xl md:text-6xl lg:text-[52px] xl:text-7xl font-extrabold tracking-tight leading-[1.04] whitespace-nowrap cursor-default select-none"
                      style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
                    >
                      <span className="text-[#1d1d1f]">Code </span>
                      <span style={{
                        backgroundImage: "linear-gradient(135deg, #0071E3 0%, #6B5CE7 55%, #AF52DE 100%)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                        WebkitTextFillColor: "transparent",
                      }}>Designer AI</span>
                    </motion.h1>

                    {/* Subtitle */}
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
                      className="mt-5 text-base sm:text-lg text-black/45 max-w-[480px] leading-relaxed">
                      输入任意网站 URL，AI 自动理解设计、分析语言、拆分组件、生成 React 项目
                    </motion.p>

                    {/* URL Input */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }} className="mt-8 w-full max-w-xl relative">
                      <div className="glass-liquid rounded-[32px] overflow-hidden">
                        <form onSubmit={handleSubmit} className="flex items-center w-full focus-within:shadow-[0_0_30px_rgba(107,92,231,0.1)] transition-all duration-300">
                          <Globe className="ml-5 mr-3 w-4.5 h-4.5 text-[#86868b] shrink-0" />
                          <input ref={inputRef} type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                            placeholder="粘贴任意网站 URL（如：https://www.apple.com）"
                            className="flex-1 min-w-0 bg-transparent py-4 text-sm text-[#1d1d1f] placeholder:text-[#aeaeb2] outline-none border-none" />
                          {/* 模型选择器触发按钮 */}
                          <button type="button" onClick={() => setShowModelMenu((v) => !v)}
                            className="liquid-glass-btn-soft shrink-0 flex items-center gap-1.5 px-2.5 py-2 mr-1.5 rounded-xl text-xs font-medium text-[#1d1d1f] cursor-pointer"
                            title="选择 AI 模型">
                            <span className="text-sm leading-none">{activeProvider?.icon}</span>
                            <span className="hidden sm:inline whitespace-nowrap">{activeProvider?.name.replace(" API", "")}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-[#86868b] transition-transform ${showModelMenu ? "rotate-180" : ""}`} />
                          </button>
                          <motion.button type="submit" disabled={!url.trim() || !genEnabled || (quota !== null && !quota.allowed)}
                            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                            className="liquid-glass-btn shrink-0 mr-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{ background: "linear-gradient(135deg, #6B5CE7 0%, #AF52DE 100%)" }}>
                            {!genEnabled ? "服务维护中" : quota !== null && !quota.allowed ? "配额已用完" : "开始生成 →"}
                          </motion.button>
                        </form>
                      </div>

                      {/* 模型选择下拉菜单 */}
                      {showModelMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowModelMenu(false)} />
                          <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl bg-white/95 border border-black/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.12)] overflow-hidden"
                            style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
                            <div className="px-4 py-3 border-b border-black/[0.05]">
                              <p className="text-xs font-semibold text-[#1d1d1f]">选择 AI 模型</p>
                              <p className="text-[10px] text-[#86868b] mt-0.5">选择生成使用的 AI 模型，需在后台配置 API Key 后启用</p>
                            </div>
                            <div className="p-1.5 max-h-72 overflow-y-auto">
                              {modelProviders.map((p) => {
                                const isSelected = p.id === selectedProvider;
                                const isAvailable = p.enabled;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    disabled={!isAvailable}
                                    onClick={() => { setSelectedProvider(p.id); setShowModelMenu(false); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                                      ${isAvailable ? "cursor-pointer hover:bg-black/[0.04]" : "cursor-not-allowed opacity-50"}
                                      ${isSelected ? "bg-[#0071E3]/[0.07]" : ""}`}
                                  >
                                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                                      style={{ backgroundColor: `${p.color}14` }}>
                                      {p.icon}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`text-xs font-semibold truncate ${isSelected ? "text-[#0071E3]" : "text-[#1d1d1f]"}`}>{p.name}</span>
                                        {p.id === firstEnabledProvider?.id && (
                                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] font-medium shrink-0">默认</span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-[#86868b] truncate block mt-0.5">
                                        {isAvailable ? p.models[0] : "模型正在开发中"}
                                      </span>
                                    </div>
                                    {isAvailable ? (
                                      isSelected && <CheckCircle2 className="w-4 h-4 text-[#0071E3] shrink-0" />
                                    ) : (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/[0.05] text-[#86868b] font-medium shrink-0">开发中</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}

                      {/* 总开关关闭时的维护提示 */}
                      {!genEnabled && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 px-4 py-2.5">
                          <AlertTriangle className="w-4 h-4 text-[#FF9F0A] shrink-0" />
                          <span className="text-xs text-[#b25e00] leading-relaxed">
                            网页生成服务正在维护中，暂时无法使用，请稍后再试。
                          </span>
                        </div>
                      )}

                      {/* 配额剩余指示器（登录后显示） */}
                      {genEnabled && isLoggedIn && quota && quota.allowed && (
                        <div className="mt-3 flex items-center gap-2 px-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${quota.remaining > 0 && quota.limit !== -1 ? "bg-[#34C759]" : "bg-[#0071E3]"}`} />
                          <span className="text-[11px] text-[#86868b]">
                            {quota.limit === -1
                              ? "无限次生成（管理员）"
                              : `今日剩余 ${quota.remaining} / ${quota.limit} 次生成`}
                          </span>
                        </div>
                      )}

                      {/* 配额用完提示 */}
                      {genEnabled && quota && !quota.allowed && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 px-4 py-2.5">
                          <AlertTriangle className="w-4 h-4 text-[#FF9F0A] shrink-0" />
                          <span className="text-xs text-[#b25e00] leading-relaxed">
                            今日生成配额已用完（{quota.used} / {quota.limit} 次），明日 0 点自动重置。升级 Pro 可获得更多额度。
                          </span>
                        </div>
                      )}
                    </motion.div>

                    {/* Design Mode selector */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.6 }} className="mt-4 w-full max-w-xl">
                      <div className="rounded-2xl bg-white/60 border border-black/[0.06] shadow-[0_2px_16px_rgba(0,0,0,0.04)] p-1.5"
                        style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
                        <div className="flex items-center gap-1.5">
                          {([
                            { mode: "clone" as const, icon: FileText, title: "精准复刻", desc: "保持 95% 一致 · 适合学习研究" },
                            { mode: "enhancement" as const, icon: Paintbrush, title: "设计升级", desc: "保留 80% · 优化 20% · 适合商业发布", recommended: true },
                          ]).map(({ mode, icon: Icon, title, desc, recommended }) => {
                            const isActive = selectedMode === mode;
                            return (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setSelectedMode(mode)}
                                className={`flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer border
                                  ${isActive
                                    ? "bg-white border-[#6B5CE7]/25 shadow-[0_2px_12px_rgba(107,92,231,0.12)]"
                                    : "bg-transparent border-transparent hover:bg-white/50"
                                  }`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors
                                  ${isActive ? "bg-[#6B5CE7]/10" : "bg-black/[0.04]"}`}>
                                  <Icon className={`w-4 h-4 ${isActive ? "text-[#6B5CE7]" : "text-[#86868b]"}`} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-xs font-semibold ${isActive ? "text-[#1d1d1f]" : "text-[#86868b]"}`}>{title}</span>
                                    {recommended && (
                                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#6B5CE7]/10 text-[#6B5CE7] font-medium">推荐</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-black/35 truncate mt-0.5">{desc}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>

                    {/* Prompt Input — optional user requirements */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6 }} className="mt-4 w-full max-w-xl">
                      <div className="rounded-2xl bg-white/60 border border-black/[0.06] shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden"
                        style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.04]">
                          <MessageSquare className="w-3.5 h-3.5 text-[#6B5CE7]/60" />
                          <span className="text-[11px] text-black/35 font-medium">描述你的复刻需求（可选）</span>
                        </div>
                        <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder={"告诉 AI 你想如何复刻这个网页，例如：\n• 使用黑色背景 + 玻璃拟态风格\n• 保留原始动画效果，增加响应式适配\n• 重点还原 Hero 区域的视差滚动效果"}
                          rows={3}
                          className="w-full bg-transparent px-4 py-3 text-sm text-[#1d1d1f] placeholder:text-[#aeaeb2]/70 outline-none border-none resize-none leading-relaxed"
                        />
                      </div>
                    </motion.div>

                    {/* Goal selector tags */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
                      className="mt-7 flex flex-col items-start gap-3">
                      <span className="text-[11px] text-black/30 tracking-wide">选择分析目标</span>
                      <div className="flex flex-wrap items-center gap-2.5">
                        {FEATURE_TAGS.map(({ label, icon: Icon, hint, details, output }, i) => {
                          const isActive = selectedGoal === i;
                          return (
                            <motion.div key={label} className="relative">
                              <motion.button
                                whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.95 }}
                                onClick={() => setSelectedGoal(isActive ? null : i)}
                                className={`group/goal relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-all duration-200 cursor-pointer border
                                  ${isActive
                                    ? "bg-[#6B5CE7]/10 border-[#6B5CE7]/30 text-[#6B5CE7] shadow-sm"
                                    : "bg-white/60 border-black/[0.06] text-[#86868b] hover:text-[#6B5CE7] hover:border-[#6B5CE7]/20"
                                  }`}>
                                <Icon className={`w-3 h-3 transition-colors ${isActive ? "text-[#6B5CE7]" : "text-[#86868b] group-hover/goal:text-[#6B5CE7]"}`} />
                                {label}
                                {isActive && (
                                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] px-2 py-0.5 rounded-md bg-black/70 text-white pointer-events-none">
                                    {hint}
                                  </span>
                                )}
                              </motion.button>
                              {/* Hover detail panel */}
                              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 opacity-0 group-hover/goal:opacity-100 translate-y-1 group-hover/goal:translate-y-0 transition-all duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] pointer-events-none">
                                <div className="w-48 rounded-xl p-3 border border-black/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
                                  style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(24px) saturate(1.8)", WebkitBackdropFilter: "blur(24px) saturate(1.8)" }}>
                                  <div className="text-[10px] font-semibold text-[#1d1d1f] mb-2">{hint}</div>
                                  <div className="space-y-1 mb-2.5">
                                    {details.map((d) => (
                                      <div key={d} className="flex items-center gap-1.5 text-[9px] text-black/40">
                                        <div className="w-1 h-1 rounded-full bg-[#6B5CE7]/40" />{d}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="pt-2 border-t border-black/[0.06]">
                                    <div className="flex items-center gap-1 text-[9px] text-[#6B5CE7] font-medium">
                                      <Download className="w-2.5 h-2.5" />输出: {output}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>

                    {/* Scroll hint */}
                    <motion.button onClick={() => scrollTo("showcase-section")}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.8 }}
                      className="mt-10 flex items-center gap-2 text-black/20 hover:text-black/40 transition-colors cursor-pointer">
                      <span className="text-[10px] tracking-widest uppercase">查看案例</span>
                      <motion.div animate={{ y: [0, 4, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </motion.div>
                    </motion.button>
                  </div>

                  {/* ── RIGHT COLUMN: Browser Mockup + AI Analysis Panel ── */}
                  <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="hidden lg:flex flex-col gap-4"
                  >
                    {/* Browser mockup */}
                    <motion.div
                      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7, duration: 0.5 }}
                      className="rounded-xl overflow-hidden border border-black/[0.06] bg-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
                    >
                      {/* Browser chrome */}
                      <div className="px-3 py-2 border-b border-black/[0.04] bg-black/[0.02] flex items-center gap-2">
                        <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-[#ff5f57]" /><div className="w-2 h-2 rounded-full bg-[#febc2e]" /><div className="w-2 h-2 rounded-full bg-[#28c840]" /></div>
                        <div className="flex-1 mx-2 px-3 py-1 rounded-md bg-black/[0.04] text-[9px] text-black/30 font-mono truncate">https://adventure.co</div>
                      </div>
                      {/* Website preview */}
                      <div className="relative h-[200px] overflow-hidden">
                        <img src="/showcase/adventure.jpg" alt="Adventure website" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                          <p className="text-[10px] text-white/70 font-medium tracking-wide">Adventure — 探索多彩世界</p>
                          <p className="text-lg font-bold text-white leading-tight mt-0.5">Explore The Colorful World</p>
                          <p className="text-2xl font-extrabold text-white/90 tracking-tight mt-1">A WONDERFUL GIFT</p>
                        </div>
                      </div>
                    </motion.div>

                    {/* AI Analysis panel */}
                    <motion.div
                      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.0, duration: 0.5 }}
                      className="rounded-xl border border-black/[0.06] bg-white/80 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                      style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-[#6B5CE7]/10 flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-[#6B5CE7]" />
                        </div>
                        <span className="text-xs font-semibold text-[#1d1d1f]">AI 分析中...</span>
                      </div>
                      {/* Analysis steps */}
                      <div className="space-y-2.5">
                        {[
                          { icon: Globe2, label: "解析页面结构" },
                          { icon: Eye, label: "识别设计风格" },
                          { icon: Brain, label: "分析组件" },
                          { icon: Code2, label: "生成 React 代码" },
                        ].map((step, i) => (
                          <motion.div key={step.label}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1.2 + i * 0.15, duration: 0.4 }}
                            className="flex items-center gap-2.5"
                          >
                            <div className="w-5 h-5 rounded-full bg-[#0071E3]/10 flex items-center justify-center shrink-0">
                              <step.icon className="w-2.5 h-2.5 text-[#0071E3]" />
                            </div>
                            <span className="text-[11px] text-black/50">{step.label}</span>
                            <CheckCircle2 className="w-3 h-3 text-[#34C759] ml-auto" />
                          </motion.div>
                        ))}
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3 pt-3 border-t border-black/[0.04]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] text-black/30">进度</span>
                          <span className="text-[9px] font-medium text-[#34C759]">100% 完成</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: "100%" }}
                            transition={{ delay: 1.8, duration: 1.2, ease: "easeOut" }}
                            className="h-full rounded-full bg-[#0071E3]" />
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>

                </div>
              </div>
            </section>

            {/* ===== AI DESIGN SHOWCASE — OpenAI-style ===== */}
            <div id="showcase-section">
              <OpenAIShowcase />
            </div>
            {/* ===== HOW IT WORKS — Agent Pipeline ===== */}
            <section id="intro-section" className="relative py-24 overflow-hidden" style={{ background: "#fafafa" }}>
              {/* Background glow — top right */}
              <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 50%, transparent 70%)" }} />
              <div className="absolute top-[10%] right-[5%] w-[400px] h-[400px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.06) 50%, transparent 70%)" }} />

              {/* 3D stacked code blocks decoration — top right */}
              <div className="absolute top-16 right-12 pointer-events-none hidden lg:block">
                <div className="relative w-40 h-48">
                  {/* Layer 1 — light blue */}
                  <div className="absolute top-0 left-0 w-32 h-24 rounded-xl rotate-[-6deg]"
                    style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.12)", backdropFilter: "blur(8px)", boxShadow: "0 8px 32px rgba(59,130,246,0.06)" }} />
                  {/* Layer 2 — purple */}
                  <div className="absolute top-6 left-4 w-32 h-24 rounded-xl rotate-[-2deg]"
                    style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.12)", backdropFilter: "blur(8px)", boxShadow: "0 8px 32px rgba(139,92,246,0.06)" }} />
                  {/* Layer 3 — white */}
                  <div className="absolute top-12 left-8 w-32 h-24 rounded-xl rotate-[2deg] flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", boxShadow: "0 12px 40px rgba(0,0,0,0.06)" }}>
                    <span className="text-[#6B5CE7]/40 text-2xl font-mono font-bold">&lt;/&gt;</span>
                  </div>
                  {/* Floating particles */}
                  <motion.div className="absolute top-4 right-2 w-2 h-2 rounded-full bg-[#6B5CE7]/20"
                    animate={{ y: [0, -8, 0], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 3, repeat: Infinity }} />
                  <motion.div className="absolute bottom-8 left-2 w-1.5 h-1.5 rounded-full bg-[#3B82F6]/25"
                    animate={{ y: [0, -6, 0], opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }} />
                  <motion.div className="absolute top-20 right-8 w-1 h-1 rounded-full bg-[#8B5CF6]/30"
                    animate={{ y: [0, -5, 0], opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }} />
                </div>
              </div>

              <div className="max-w-[1280px] mx-auto px-6 lg:px-20">
                {/* Title — left aligned */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="mb-14"
                >
                  <h2 className="text-[36px] sm:text-[48px] font-extrabold tracking-tight mb-3 leading-tight">
                    <span className="text-[#1a1a2e]">八大 </span>
                    <span className="bg-gradient-to-r from-[#6B5CE7] via-[#8B5CF6] to-[#3B82F6] bg-clip-text text-transparent">AI Agent</span>
                    <span className="text-[#1a1a2e]"> 协作</span>
                  </h2>
                  <p className="text-[16px] text-[#64748B] max-w-[520px] leading-relaxed">
                    从网页读取到代码部署，八个专业 AI Agent 流水线协作，每一步都可视化追踪
                  </p>
                </motion.div>

                {/* Steps grid — 4 columns × 2 rows, 24px gap */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {PIPELINE_STEPS.map((step, i) => (
                    <PipelineStep key={step.id} step={step} index={i} />
                  ))}
                </div>

                {/* Bottom tagline */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="mt-14 flex items-center justify-center gap-3"
                >
                  <Sparkles className="w-4 h-4 text-[#AF52DE]/40" />
                  <span className="text-[14px] text-[#94A3B8]">八大 AI Agent 互相协作，打造高质量网页复刻体验</span>
                  <Sparkles className="w-4 h-4 text-[#AF52DE]/40" />
                </motion.div>
              </div>
            </section>

            {/* ===== STATS ===== */}
            <section className="py-16 px-6">
              <div className="max-w-4xl mx-auto">
                <FadeIn>
                  <LiquidGlassCard className="rounded-3xl">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 p-8">
                      {STATS.map((stat, i) => (
                        <motion.div key={i} className="text-center cursor-default" whileHover={{ scale: 1.06, y: -4 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                          <div className="text-3xl sm:text-4xl font-semibold text-[#1d1d1f] tabular-nums tracking-tight">
                            <AnimatedCounter value={stat.value} suffix={stat.suffix} prefix={stat.prefix || ""} />
                          </div>
                          <div className="mt-1.5 text-xs text-black/30">{stat.label}</div>
                        </motion.div>
                      ))}
                    </div>
                  </LiquidGlassCard>
                </FadeIn>
              </div>
            </section>

            <div className="section-divider" />

            {/* ===== CORE FEATURES ===== */}
            <section id="features" className="relative py-28 overflow-hidden" style={{ background: "#fafafa" }}>
              {/* Background glow — top right */}
              <div className="absolute top-[-15%] right-[-10%] w-[700px] h-[700px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(120,150,255,0.18) 0%, rgba(139,92,246,0.08) 50%, transparent 70%)" }} />
              {/* Left light blue fog */}
              <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none"
                style={{ background: "rgba(120,180,255,0.06)", filter: "blur(100px)" }} />

              <div className="max-w-[1280px] mx-auto px-6 lg:px-20">
                {/* Pill tag + Title + Subtitle — centered */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="text-center mb-[70px]"
                >
                  {/* Pill tag */}
                  <span className="inline-flex items-center gap-2 px-4 h-9 rounded-full text-[12px] font-semibold text-[#7C3AED] mb-6"
                    style={{ background: "rgba(255,255,255,0.7)", border: "1px solid #eee" }}>
                    <Layers className="w-3.5 h-3.5" />
                    核心能力
                  </span>
                  {/* Title */}
                  <h2 className="text-[40px] sm:text-[52px] lg:text-[64px] font-extrabold tracking-tight leading-tight mb-4">
                    <span className="text-[#111827]">全方位</span>
                    <span className="bg-gradient-to-r from-[#7C3AED] to-[#2563EB] bg-clip-text text-transparent">前端工程</span>
                    <span className="text-[#111827]">能力</span>
                  </h2>
                  {/* Subtitle */}
                  <p className="text-[18px] sm:text-[20px] text-[#64748B] max-w-[560px] mx-auto leading-relaxed">
                    覆盖从设计分析到代码部署的完整链路，输出生产级可用的工程产物
                  </p>
                </motion.div>

                {/* 2×2 Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1200px] mx-auto">
                  {CORE_FEATURES.map((feat, i) => (
                    <motion.div
                      key={feat.title}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.15, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                      whileHover={{ y: -8, boxShadow: "0 24px 60px rgba(0,0,0,0.08)", transition: { duration: 0.3 } }}
                      className="group relative rounded-3xl p-8 cursor-pointer min-h-[280px] flex flex-col"
                      style={{
                        background: "rgba(255,255,255,0.72)",
                        border: "1px solid rgba(255,255,255,0.8)",
                        backdropFilter: "blur(30px)",
                        WebkitBackdropFilter: "blur(30px)",
                        boxShadow: "0 20px 50px rgba(0,0,0,0.06)",
                      }}
                    >
                      {/* Top: Icon + illustration area */}
                      <div className="flex items-start justify-between mb-6">
                        {/* Circular icon */}
                        <motion.div
                          whileHover={{ rotate: -8, transition: { duration: 0.3 } }}
                          className="rounded-full flex items-center justify-center shrink-0"
                          style={{ width: 70, height: 70, background: `${feat.color}10` }}
                        >
                          <feat.icon className="w-10 h-10" style={{ color: feat.color }} />
                        </motion.div>
                        {/* Illustration placeholder — low opacity */}
                        <div className="w-24 h-16 rounded-lg opacity-[0.12] blur-[1px]"
                          style={{ background: `linear-gradient(135deg, ${feat.color}30, ${feat.color}10)` }} />
                      </div>

                      {/* Title */}
                      <h3 className="text-[24px] sm:text-[26px] font-bold text-[#111827] mb-3">{feat.title}</h3>

                      {/* Description */}
                      <p className="text-[15px] sm:text-[17px] text-[#64748B] leading-[1.8] flex-1">{feat.desc}</p>

                      {/* Learn more link */}
                      <button
                        onClick={() => scrollTo(feat.anchor)}
                        className="mt-5 flex items-center gap-1.5 text-[15px] sm:text-[16px] font-semibold transition-all duration-200 hover:gap-3 cursor-pointer"
                        style={{ color: feat.color }}
                      >
                        <span>了解详情</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>

                {/* Bottom banner — capsule */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="mt-16 flex justify-center"
                >
                  <div className="flex items-center gap-3 px-8 h-[50px] rounded-full max-w-[700px] w-full justify-center"
                    style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(200,200,255,0.5)" }}>
                    <Sparkles className="w-4 h-4 text-[#6366F1]/60 shrink-0" />
                    <span className="text-[14px] text-[#6366F1] text-center">
                      强大的 AI 能力，流畅的工程体验，助力每一个创意快速落地
                    </span>
                    <Sparkles className="w-4 h-4 text-[#6366F1]/60 shrink-0" />
                  </div>
                </motion.div>
              </div>
            </section>

            <div className="section-divider" />

            {/* ===== TECH ABILITY — 4 compact cards ===== */}
            <section className="py-20 px-6 relative overflow-hidden" style={{ background: "#fafafa" }}>
              <div className="max-w-[1200px] mx-auto">
                {/* Header */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="text-center mb-12"
                >
                  <span className="inline-flex items-center gap-1.5 px-3 h-6 rounded-full text-[11px] font-semibold text-[#2563EB] mb-4"
                    style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(200,220,255,0.5)" }}>
                    <Code2 className="w-3 h-3" />
                    技术能力
                  </span>
                  <h2 className="text-[28px] sm:text-[32px] font-extrabold text-[#111827] tracking-tight mb-2">全方位前端工程能力</h2>
                  <p className="text-[14px] text-[#64748B]">不仅能生成代码，更能生成生产级的工程项目</p>
                </motion.div>

                {/* 4 compact cards — horizontal row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[18px]">
                  {[
                    { icon: Layout, title: "高精度还原", desc: "像素级还原布局、视觉与交互逻辑" },
                    { icon: Monitor, title: "响应式支持", desc: "自动适配移动端、平板、桌面" },
                    { icon: Code2, title: "组件化代码", desc: "生成完整 React 组件结构" },
                    { icon: Rocket, title: "工程化输出", desc: "完整项目结构，可直接部署" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1, duration: 0.4 }}
                      whileHover={{ y: -5, transition: { duration: 0.2 } }}
                      className="flex items-center gap-4 px-5 h-[90px] rounded-2xl cursor-default"
                      style={{
                        background: "rgba(255,255,255,0.75)",
                        border: "1px solid rgba(255,255,255,0.9)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
                      }}
                    >
                      {/* Icon */}
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "rgba(37,99,235,0.08)" }}>
                        <item.icon className="w-6 h-6 text-[#2563EB]" />
                      </div>
                      {/* Text */}
                      <div>
                        <h3 className="text-[16px] font-bold text-[#111827] mb-0.5">{item.title}</h3>
                        <p className="text-[12px] text-[#64748B]">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* ===== TECH STACK — horizontal tags ===== */}
            <section className="py-16 px-6">
              <div className="max-w-[1200px] mx-auto text-center">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="mb-10"
                >
                  <h2 className="text-[24px] sm:text-[26px] font-extrabold text-[#111827] tracking-tight mb-2">现代化技术栈</h2>
                  <p className="text-[14px] text-[#64748B]">基于最新技术构建，确保输出代码的质量与可靠性</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                  className="flex flex-wrap items-center justify-center gap-3"
                >
                  {["React 19", "TypeScript", "Tailwind CSS", "Next.js 15", "Zustand", "Framer Motion", "Vercel", "ESLint", "Prettier"].map((tech, i) => (
                    <motion.span
                      key={tech}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                      whileHover={{ scale: 1.05 }}
                      className="inline-flex items-center gap-2 h-[38px] px-5 rounded-xl text-[13px] font-medium text-[#333] cursor-default transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                      style={{
                        background: "rgba(255,255,255,0.8)",
                        border: "1px solid rgba(255,255,255,0.9)",
                        backdropFilter: "blur(12px)",
                        boxShadow: "0 5px 20px rgba(0,0,0,0.04)",
                      }}
                    >
                      {tech}
                    </motion.span>
                  ))}
                </motion.div>
              </div>
            </section>

            {/* ===== CTA BANNER — gradient purple-to-blue ===== */}
            <section id="cta-section" className="py-20 px-6">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="max-w-[1200px] mx-auto relative rounded-3xl overflow-hidden px-8 sm:px-16 py-16 text-center"
                style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}
              >
                {/* Background glow effects */}
                <div className="absolute top-[-30%] left-[-10%] w-[400px] h-[400px] rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 60%)" }} />
                <div className="absolute bottom-[-20%] right-[-5%] w-[300px] h-[300px] rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%)" }} />

                {/* Left illustration — webpage wireframe */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 w-32 h-24 rounded-lg opacity-[0.12] blur-[1px] hidden lg:block"
                  style={{ background: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.2)" }} />
                {/* Right illustration — code window */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 w-32 h-24 rounded-lg opacity-[0.12] blur-[1px] hidden lg:block"
                  style={{ background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <div className="p-2 font-mono text-[8px] text-white/30 leading-relaxed">
                    {"<div>\n  <h1>Hello</h1>\n  <p>World</p>\n</div>"}
                  </div>
                </div>

                {/* Content */}
                <div className="relative z-10">
                  <h2 className="text-[28px] sm:text-[32px] font-extrabold text-white tracking-tight mb-3">
                    准备好让 AI 重建你的下一个网页了吗？
                  </h2>
                  <p className="text-[15px] text-white/80 mb-8 max-w-[480px] mx-auto">
                    免费体验每天 2 次生成机会，无需信用卡
                  </p>

                  {/* Buttons */}
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={scrollToTop}
                      className="inline-flex items-center gap-2 h-11 px-7 rounded-[22px] text-[14px] font-semibold bg-white text-[#6366F1] shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.2)] transition-shadow duration-200 cursor-pointer"
                    >
                      开始免费体验
                      <ArrowUpRight className="w-4 h-4" />
                    </motion.button>
                    <Link
                      href="/docs"
                      className="inline-flex items-center gap-2 h-11 px-7 rounded-[22px] text-[14px] font-semibold text-white cursor-pointer transition-all duration-200 hover:bg-white/10"
                      style={{ border: "1px solid rgba(255,255,255,0.4)" }}
                    >
                      查看使用文档
                    </Link>
                  </div>

                  {/* Bottom info */}
                  <div className="flex items-center justify-center gap-6 mt-8">
                    {["无需安装", "支持所有网站", "代码可商用"].map(text => (
                      <span key={text} className="text-[13px] text-white/60">{text}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </section>

            {/* Footer */}
            <footer className="py-10 px-6 border-t border-black/[0.06]">
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#0071E3]" />
                  <span className="text-xs font-semibold text-black/40">Code Designer AI</span>
                </div>
                <p className="text-[11px] text-black/20">AI 驱动的网页逆向工程工具 · 从 URL 到 React 项目</p>
              </div>
            </footer>
          </motion.div>
        ) : (
          <motion.div key="workspace" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }} className="h-screen flex flex-col overflow-hidden">
            <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-black/[0.06] bg-white/90 backdrop-blur-xl z-30">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-black/80 tracking-tight">Code Designer AI</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF9500]/12 border border-[#FF9500]/25 text-[10px] font-medium text-[#b25e00]" title="当前为演示模式：分析、截图、评分与部署结果均为模拟数据">
                  <Sparkles className="w-2.5 h-2.5" />
                  演示数据
                </span>
                <div className="h-4 w-px bg-black/[0.1]" />
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.04] border border-black/[0.06]">
                  <Globe className="w-3 h-3 text-black/40" />
                  <span className="text-[11px] text-black/50 font-mono max-w-[200px] truncate">{taskUrl}</span>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border
                  ${taskMode === "enhancement" ? "bg-[#6B5CE7]/[0.07] border-[#6B5CE7]/20" : "bg-black/[0.04] border-black/[0.06]"}`}>
                  {taskMode === "enhancement" ? <Paintbrush className="w-3 h-3 text-[#6B5CE7]" /> : <FileText className="w-3 h-3 text-black/40" />}
                  <span className={`text-[11px] font-medium ${taskMode === "enhancement" ? "text-[#6B5CE7]" : "text-black/50"}`}>
                    {taskMode === "enhancement" ? "设计升级" : "精准复刻"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isCompleted && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#34C759]/10 border border-[#34C759]/20">
                      <CheckCircle2 className="w-3 h-3 text-[#34C759]" /><span className="text-[11px] text-[#34C759] font-medium">完成</span>
                    </div>
                    <button onClick={() => resetTask()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0071E3] text-white hover:bg-[#0077ED] transition-colors">
                      <Home className="w-3 h-3" />返回首页
                    </button>
                    <button onClick={handleRerun} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-black/[0.06] text-black/70 hover:bg-black/[0.10] transition-colors">
                      <RotateCcw className="w-3 h-3" />重新运行
                    </button>
                  </div>
                )}
                {isRunning && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0071E3]/10 border border-[#0071E3]/20">
                      <Loader2 className="w-3 h-3 text-[#0071E3] animate-spin" /><span className="text-[11px] text-[#0071E3] font-medium">运行中...</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/[0.04] border border-black/[0.06]">
                      <Clock className="w-3 h-3 text-black/40" />
                      <span className="text-[11px] text-black/45">预计 30-40 秒</span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCancel}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20 hover:bg-[#FF3B30]/20 transition-colors cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-current" />停止
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0"><WorkspaceLayout /></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== LOGIN MODAL ===== */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            key="login-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={() => setShowLoginModal(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="login-modal-title"
              className="relative w-full max-w-[400px] mx-4 rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 24px 80px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)" }}
            >
              {/* Close button */}
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-colors cursor-pointer z-10"
              >
                <span className="text-black/40 text-sm leading-none">✕</span>
              </button>

              {/* Content */}
              <div className="p-8 pt-7">
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#0071E3] flex items-center justify-center mx-auto mb-4">
                    <Code2 className="w-5 h-5 text-white" />
                  </div>
                  <h2 id="login-modal-title" className="text-xl font-semibold text-[#1d1d1f] tracking-tight">登录 Code Designer AI</h2>
                  <p className="mt-1 text-xs text-black/35">输入邮箱和密码登录或注册</p>
                </div>

                {/* Form */}
                <form onSubmit={(e) => { e.preventDefault(); const form = e.target as HTMLFormElement; const fd = new FormData(form); handleLogin(fd.get("email") as string, fd.get("password") as string); }} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-black/50 mb-1.5">邮箱</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/20" />
                      <input
                        name="email"
                        type="text"
                        required
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/[0.03] border border-black/[0.06] text-sm text-[#1d1d1f] placeholder:text-black/20 outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]/30 transition-all"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-medium text-black/50 mb-1.5">密码</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/20" />
                      <input
                        name="password"
                        type="password"
                        required
                        placeholder="••••••••"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/[0.03] border border-black/[0.06] text-sm text-[#1d1d1f] placeholder:text-black/20 outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]/30 transition-all"
                      />
                    </div>
                  </div>

                  {/* Submit */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="w-full py-2.5 rounded-xl text-sm font-medium bg-[#0071E3] text-white shadow-[0_2px_12px_rgba(0,113,227,0.3)] hover:bg-[#0077ED] transition-all cursor-pointer mt-2"
                  >
                    登录 / 注册
                  </motion.button>
                </form>

                {/* Footer */}
                <p className="mt-5 text-center text-[11px] text-black/25">
                  还没有账号？使用邮箱即可注册
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== FAILURE MODAL ===== */}
      <AnimatePresence>
        {isFailed && failedTask.errorMessage && (
          <motion.div
            key="failure-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={() => { /* keep open until user clicks button */ }}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20"
              style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            />

            {/* Modal card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-md mx-4 rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(40px) saturate(1.8)", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)" }}
            >
              <div className="p-8 pt-7 text-center">
                {/* Error icon */}
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>

                {/* Title */}
                <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight mb-2">生成失败</h2>

                {/* Error message */}
                <p className="text-sm text-[#86868b] leading-relaxed mb-6 px-2">
                  {failedTask.errorMessage}
                </p>

                {/* Quota refunded hint */}
                <p className="text-xs text-[#86868b]/70 mb-6">
                  本次消耗的额度已自动退还。
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { resetTask(); }}
                    className="flex-1 h-10 rounded-xl text-sm font-medium text-[#1d1d1f] transition-colors cursor-pointer"
                    style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                  >
                    返回首页
                  </button>
                  <button
                    onClick={() => { resetTask(); setTimeout(() => { const urlInput = document.querySelector('input[placeholder*="URL"]') as HTMLInputElement; if (urlInput) urlInput.focus(); }, 100); }}
                    className="flex-1 h-10 rounded-xl text-sm font-medium text-white transition-colors cursor-pointer"
                    style={{ background: "#0071E3" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#0077ED")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#0071E3")}
                  >
                    重新尝试
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== SETTINGS MODALS ===== */}
      <AnimatePresence>
        {activeModal && (
          <>
            <div className="fixed inset-0 z-[100] bg-black/20" style={{ backdropFilter: "blur(8px)" }} onClick={() => setActiveModal(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none"
            >
              <div className="w-full max-w-md mx-4 rounded-2xl overflow-hidden pointer-events-auto" style={{ background: "rgba(255,255,255,0.98)", backdropFilter: "blur(40px) saturate(1.8)", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
                {/* Close button */}
                <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-colors cursor-pointer z-10">
                  <X className="w-3.5 h-3.5 text-black/40" />
                </button>

                {/* 个人资料 */}
                {activeModal === 'profile' && (
                  <ProfileModalContent userInfo={userInfo} onClose={() => setActiveModal(null)} onUpdateUser={(name) => {
                    if (userInfo) {
                      const updated = { ...userInfo, name, avatar: name.charAt(0).toUpperCase() };
                      setUserInfo(updated);
                      sessionStorage.setItem('cd_user', JSON.stringify({ name, email: userInfo.email }));
                    }
                  }} />
                )}

                {/* 偏好设置 */}
                {activeModal === 'preferences' && (
                  <PreferencesModalContent onClose={() => setActiveModal(null)} />
                )}

                {/* 账号设置 */}
                {activeModal === 'account' && (
                  <AccountModalContent quota={quota} onClose={() => setActiveModal(null)} />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile Modal Content
// ---------------------------------------------------------------------------
function ProfileModalContent({ userInfo, onClose, onUpdateUser }: {
  userInfo: { name: string; email: string; avatar: string } | null;
  onClose: () => void;
  onUpdateUser: (name: string) => void;
}) {
  const [name, setName] = useState(userInfo?.name || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (name.trim()) {
      onUpdateUser(name.trim());
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    }
  };

  return (
    <div className="p-6 pt-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 flex items-center justify-center">
          <User className="w-5 h-5 text-[#0071E3]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#1d1d1f]">个人资料</h2>
          <p className="text-xs text-black/35">查看和编辑你的账户信息</p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-black/50 mb-1.5">用户名</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-black/[0.03] border border-black/[0.06] text-sm text-[#1d1d1f] outline-none focus:border-[#0071E3]/30 focus:ring-2 focus:ring-[#0071E3]/10 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-medium text-black/50 mb-1.5">邮箱</label>
          <input defaultValue={userInfo?.email || ''} disabled className="w-full h-10 px-3 rounded-lg bg-black/[0.02] border border-black/[0.04] text-sm text-black/30 cursor-not-allowed" />
          <p className="mt-1 text-[10px] text-black/20">邮箱不可修改，用于登录识别</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-black/50 mb-1.5">头像</label>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0071E3] to-[#6B5CE7] flex items-center justify-center text-white text-lg font-bold">
              {name ? name.charAt(0).toUpperCase() : userInfo?.avatar}
            </div>
            <button onClick={() => alert('头像上传功能即将推出')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#0071E3] bg-[#0071E3]/8 hover:bg-[#0071E3]/12 transition-colors cursor-pointer">更换头像</button>
          </div>
        </div>
        <button onClick={handleSave} className="w-full h-10 rounded-xl text-sm font-medium text-white cursor-pointer transition-colors" style={{ background: saved ? '#34C759' : '#0071E3' }}>
          {saved ? '✓ 已保存' : '保存修改'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preferences Modal Content
// ---------------------------------------------------------------------------
function PreferencesModalContent({ onClose }: { onClose: () => void }) {
  const [lang, setLang] = useState(() => localStorage.getItem('cd_lang') || '简体中文');
  const [mode, setMode] = useState(() => localStorage.getItem('cd_mode') || '精准复刻');
  const [notifs, setNotifs] = useState(() => {
    try { const s = localStorage.getItem('cd_notifs'); return s ? JSON.parse(s) : { generation: true, quota: true, updates: true }; } catch { return { generation: true, quota: true, updates: true }; }
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('cd_lang', lang);
    localStorage.setItem('cd_mode', mode);
    localStorage.setItem('cd_notifs', JSON.stringify(notifs));
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  };

  const toggleNotif = (key: string) => {
    setNotifs((prev: Record<string, boolean>) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-6 pt-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#AF52DE]/10 flex items-center justify-center">
          <Heart className="w-5 h-5 text-[#AF52DE]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#1d1d1f]">偏好设置</h2>
          <p className="text-xs text-black/35">自定义你的使用体验</p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-black/50 mb-2">界面语言</label>
          <div className="flex gap-2">
            {['简体中文', 'English', '日本語'].map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${lang === l ? 'bg-[#AF52DE] text-white' : 'bg-black/[0.04] text-black/50 hover:bg-black/[0.06]'}`}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-black/50 mb-2">默认生成模式</label>
          <div className="flex gap-2">
            {[{ label: '精准复刻', desc: '95% 一致' }, { label: '设计升级', desc: '80% + 20%' }].map((m) => (
              <button key={m.label} onClick={() => setMode(m.label)} className={`flex-1 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${mode === m.label ? 'bg-[#AF52DE]/10 border border-[#AF52DE]/20' : 'bg-black/[0.03] border border-transparent hover:bg-black/[0.05]'}`}>
                <p className="text-xs font-medium text-[#1d1d1f]">{m.label}</p>
                <p className="text-[10px] text-black/30">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-black/50 mb-2">通知设置</label>
          <div className="space-y-2">
            {[{ key: 'generation', label: '生成完成通知' }, { key: 'quota', label: '配额提醒' }, { key: 'updates', label: '产品更新' }].map((n) => (
              <button key={n.key} onClick={() => toggleNotif(n.key)} className="w-full flex items-center justify-between py-1.5 cursor-pointer">
                <span className="text-xs text-[#1d1d1f]">{n.label}</span>
                <div className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${notifs[n.key] ? 'bg-[#AF52DE]' : 'bg-black/15'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${notifs[n.key] ? 'right-0.5' : 'left-0.5'}`} />
                </div>
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleSave} className="w-full h-10 rounded-xl text-sm font-medium text-white cursor-pointer transition-colors" style={{ background: saved ? '#34C759' : '#AF52DE' }}>
          {saved ? '✓ 已保存' : '保存设置'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Modal Content
// ---------------------------------------------------------------------------
function AccountModalContent({ quota, onClose }: {
  quota: { used: number; limit: number; remaining: number; allowed: boolean } | null;
  onClose: () => void;
}) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');

  const handleChangePassword = async () => {
    setError('');
    if (!currentPw || !newPw || !confirmPw) { setError('请填写所有密码字段'); return; }
    if (newPw.length < 6) { setError('新密码至少 6 位'); return; }
    if (newPw !== confirmPw) { setError('两次输入的新密码不一致'); return; }
    try {
      const res = await fetch('/api/user/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: JSON.parse(sessionStorage.getItem('cd_user') || '{}').email, password: currentPw }) });
      if (!res.ok) { setError('当前密码不正确'); return; }
      setError('密码修改 API 即将推出，当前暂不支持修改');
    } catch { setError('网络错误，请稍后重试'); }
  };

  return (
    <div className="p-6 pt-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#FF9500]/10 flex items-center justify-center">
          <Key className="w-5 h-5 text-[#FF9500]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#1d1d1f]">账号设置</h2>
          <p className="text-xs text-black/35">管理密码、安全和订阅</p>
        </div>
      </div>
      <div className="space-y-4">
        {error && <p className="text-xs text-[#FF3B30] bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div>
          <label className="block text-xs font-medium text-black/50 mb-1.5">当前密码</label>
          <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="输入当前密码" className="w-full h-10 px-3 rounded-lg bg-black/[0.03] border border-black/[0.06] text-sm outline-none focus:border-[#FF9500]/30 focus:ring-2 focus:ring-[#FF9500]/10 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-medium text-black/50 mb-1.5">新密码</label>
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="输入新密码（至少 6 位）" className="w-full h-10 px-3 rounded-lg bg-black/[0.03] border border-black/[0.06] text-sm outline-none focus:border-[#FF9500]/30 focus:ring-2 focus:ring-[#FF9500]/10 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-medium text-black/50 mb-1.5">确认新密码</label>
          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="再次输入新密码" className="w-full h-10 px-3 rounded-lg bg-black/[0.03] border border-black/[0.06] text-sm outline-none focus:border-[#FF9500]/30 focus:ring-2 focus:ring-[#FF9500]/10 transition-all" />
        </div>
        <div className="pt-2 border-t border-black/[0.04]">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-xs font-medium text-[#1d1d1f]">当前套餐</p>
              <p className="text-[10px] text-black/30">免费版 · {quota ? `${quota.limit} 次/天` : '—'}</p>
            </div>
            <button onClick={() => alert('Pro 版本即将推出，敬请期待！')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer" style={{ background: "linear-gradient(135deg, #FF9500, #FF6A00)" }}>升级 Pro</button>
          </div>
        </div>
        <button onClick={handleChangePassword} className="w-full h-10 rounded-xl text-sm font-medium text-white cursor-pointer transition-colors" style={{ background: "#FF9500" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#FF8000")} onMouseLeave={(e) => (e.currentTarget.style.background = "#FF9500")}>
          修改密码
        </button>
      </div>
    </div>
  );
}
