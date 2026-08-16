'use client';

import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Sparkles,
  Check,
  X,
  TrendingUp,
  Target,
  Layers,
  ArrowRight,
  RefreshCw,
  Compass,
  Wand2,
} from 'lucide-react';
import { useAgentStore } from '@/store/agent-store';
import { mockDesignDecision } from '@/lib/mock-data';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import type { DesignDecision } from '@/types/agent';

// ---------------------------------------------------------------------------
// Score dimension meta
// ---------------------------------------------------------------------------

const DIMENSION_META: { key: keyof DesignDecision['score']; label: string; color: string }[] = [
  { key: 'layout',     label: '布局',   color: '#0071E3' },
  { key: 'typography', label: '字体',   color: '#AF52DE' },
  { key: 'color',      label: '颜色',   color: '#FF9500' },
  { key: 'image',      label: '图片',   color: '#34C759' },
  { key: 'premium',    label: '高级感', color: '#FFD60A' },
];

const EASE_OUT = [0.25, 0.46, 0.45, 0.94] as const;

// ---------------------------------------------------------------------------
// Animated number counter
// ---------------------------------------------------------------------------

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  return <motion.span>{display}</motion.span>;
}

// ---------------------------------------------------------------------------
// DesignDecisionContent — 中央画布「设计决策」面板
// ---------------------------------------------------------------------------

export function DesignDecisionContent() {
  const decision = useAgentStore((s) => s.task.designDecision) ?? mockDesignDecision;
  const criticStatus = useAgentStore((s) => s.task.agents.critic.status);
  const enhancementPlan = useAgentStore((s) => s.task.enhancementPlan);
  const mode = useAgentStore((s) => s.task.mode);

  const isOptimizationRound = (decision.round ?? 1) > 1;

  return (
    <div className="space-y-5">
      {/* ── Header: Critic 身份 + 风格方向 ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-black/[0.06] bg-white/60 backdrop-blur-xl"
      >
        <span className="shrink-0 w-8 h-8 rounded-lg bg-[#FFD60A]/15 border border-[#FFD60A]/30 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-[#b8960a]" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1d1d1f]">Design Critic Agent 设计决策</p>
          <p className="text-[11px] text-[#86868b] truncate">
            理解原网页设计逻辑 → 判断保留 / 优化 / 重构
          </p>
        </div>

        {/* 风格方向 & 调性 */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0071E3]/[0.08] border border-[#0071E3]/20 text-[11px] font-medium text-[#0071E3]">
          <Compass className="w-3 h-3" />
          {decision.style.direction}
        </span>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-black/[0.05] border border-black/[0.08] text-[11px] font-medium text-[#1d1d1f]">
          {decision.style.tone}
        </span>

        {/* 优化轮次标记 */}
        {isOptimizationRound && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FF9500]/10 border border-[#FF9500]/25 text-[11px] font-medium text-[#c77400]">
            <RefreshCw className="w-3 h-3" />
            第 {decision.round} 轮优化
          </span>
        )}

        {/* Critic 状态 */}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium',
            criticStatus === 'completed'
              ? 'bg-[#34C759]/10 text-[#248a3d]'
              : 'bg-[#FF9500]/10 text-[#c77400]',
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              criticStatus === 'completed' ? 'bg-[#34C759]' : 'bg-[#FF9500] animate-pulse',
            )}
          />
          {criticStatus === 'completed' ? '评审完成' : '评审中'}
        </span>
      </motion.div>

      {/* ── 第一行: 页面定位 + 高级感评分 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* 页面定位分析 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: EASE_OUT }}
          className="lg:col-span-3"
        >
          <GlassCard className="p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-[#0071E3]" />
              <h3 className="text-[13px] font-semibold text-[#1d1d1f]">页面定位分析</h3>
            </div>

            <p className="text-xl font-semibold tracking-tight text-[#1d1d1f] capitalize">
              {decision.brandPosition}
            </p>
            <p className="mt-1.5 text-[13px] text-[#86868b] leading-relaxed">
              设计目标: {decision.designGoal}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {decision.userFeeling.map((feeling, i) => (
                <motion.span
                  key={`${feeling}-${i}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.3, ease: EASE_OUT }}
                  className="px-3 py-1 rounded-full bg-[#AF52DE]/[0.08] border border-[#AF52DE]/20 text-[12px] font-medium text-[#8944ab] transition-transform duration-150 hover:scale-105 cursor-default"
                >
                  {feeling}
                </motion.span>
              ))}
            </div>

            {/* 视觉层级 */}
            <div className="mt-5 pt-4 border-t border-black/[0.05]">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-3.5 h-3.5 text-[#AF52DE]" />
                <h4 className="text-[12px] font-semibold text-[#1d1d1f]">视觉层级</h4>
              </div>
              <div className="space-y-2">
                {decision.visualHierarchy.slice(0, 5).map((item, i) => (
                  <div key={`${item.element}-${i}`} className="group flex items-center gap-3">
                    <span className="w-28 shrink-0 text-[11px] text-[#86868b] truncate transition-colors duration-150 group-hover:text-[#1d1d1f]">
                      {item.element}
                    </span>
                    <div className="flex-1 h-[6px] rounded-full bg-black/[0.04] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.score ?? 0)}%` }}
                        transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: EASE_OUT }}
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, #AF52DE ${100 - (item.score ?? 0)}%, #0071E3)`,
                          opacity: 0.4 + ((item.score ?? 0) / 100) * 0.6,
                        }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[11px] font-medium text-[#1d1d1f]/70 tabular-nums">
                      {item.score ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* 高级感评分 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
          className="lg:col-span-2"
        >
          <GlassCard className="p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#b8960a]" />
                <h3 className="text-[13px] font-semibold text-[#1d1d1f]">高级感评分</h3>
              </div>
              <span className="text-[11px] text-[#86868b]">满分 100</span>
            </div>

            {/* 总分 */}
            <div className="flex items-baseline gap-2 mb-5">
              <span
                className={cn(
                  'text-5xl font-bold tracking-tight tabular-nums',
                  decision.totalScore >= 80
                    ? 'text-[#1d1d1f]'
                    : decision.totalScore >= 60
                      ? 'text-[#FF9500]'
                      : 'text-[#FF3B30]',
                )}
              >
                <AnimatedNumber value={decision.totalScore} />
              </span>
              <span className="text-[13px] text-[#86868b]">/ 100</span>
            </div>

            {/* 五维评分条 */}
            <div className="space-y-3">
              {DIMENSION_META.map((dim, i) => {
                const val = decision.score[dim.key] ?? 0;
                return (
                  <div key={dim.key} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-[#86868b] transition-colors duration-150 group-hover:text-[#1d1d1f]">
                        {dim.label}
                      </span>
                      <span className="text-[11px] font-medium text-[#1d1d1f]/70 tabular-nums">
                        {val ?? 0}/20
                      </span>
                    </div>
                    <div className="h-[6px] rounded-full bg-black/[0.04] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${((val ?? 0) / 20) * 100}%` }}
                        transition={{ delay: 0.25 + i * 0.07, duration: 0.6, ease: EASE_OUT }}
                        className="h-full rounded-full transition-opacity duration-150 group-hover:opacity-80"
                        style={{ backgroundColor: dim.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* ── 结构审查 ── */}
      {decision.structureIssues.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: EASE_OUT }}
        >
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-[#FF9500]" />
              <h3 className="text-[13px] font-semibold text-[#1d1d1f]">页面结构审查</h3>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-[#FF9500]/10 text-[11px] font-medium text-[#c77400]">
                {decision.structureIssues.length} 项待优化
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {decision.structureIssues.map((issue, i) => (
                <motion.div
                  key={`${issue.problem}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.08, duration: 0.35, ease: EASE_OUT }}
                  className="flex items-start gap-3 p-3.5 rounded-xl border border-black/[0.05] bg-[#fafafa]/80 transition-all duration-200 hover:border-[#FF9500]/30 hover:bg-[#FF9500]/[0.03]"
                >
                  <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#FF3B30]/10 flex items-center justify-center">
                    <X className="w-3 h-3 text-[#FF3B30]" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#1d1d1f] leading-snug">{issue.problem}</p>
                    <div className="mt-1.5 flex items-start gap-1.5">
                      <ArrowRight className="shrink-0 w-3 h-3 mt-0.5 text-[#34C759]" />
                      <p className="text-[12px] text-[#248a3d] leading-snug">{issue.solution}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ── 设计决策三列表: Keep / Remove / Improve ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Keep */}
        <DecisionList
          title="保留"
          subtitle="核心视觉资产"
          icon={<Check className="w-3.5 h-3.5 text-[#34C759]" />}
          accent="#34C759"
          items={decision.keep}
          delay={0.2}
        />
        {/* Remove */}
        <DecisionList
          title="移除"
          subtitle="违反设计规则"
          icon={<X className="w-3.5 h-3.5 text-[#FF3B30]" />}
          accent="#FF3B30"
          items={decision.remove}
          delay={0.28}
        />
        {/* Improve */}
        <DecisionList
          title="优化"
          subtitle="提升高级感"
          icon={<TrendingUp className="w-3.5 h-3.5 text-[#0071E3]" />}
          accent="#0071E3"
          items={decision.improve}
          delay={0.36}
        />
      </div>

      {/* ── Enhancement Plan（设计升级模式）── */}
      {mode === 'enhancement' && enhancementPlan && (
        <GlassCard className="p-5" animate delay={0.4}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#6B5CE7]/10 flex items-center justify-center">
              <Wand2 className="w-3.5 h-3.5 text-[#6B5CE7]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">设计升级方案</h3>
              <p className="text-[10px] text-black/35">保留 80% 设计 DNA · AI 优化 20%</p>
            </div>
          </div>

          {/* Preserve DNA */}
          <div className="rounded-lg bg-[#34C759]/[0.05] border border-[#34C759]/15 p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Check className="w-3 h-3 text-[#34C759]" />
              <span className="text-[11px] font-medium text-[#34C759]">保留的设计 DNA</span>
            </div>
            <div className="text-[11px] text-black/55 space-y-0.5">
              <div>布局：{enhancementPlan.preserve.layout}</div>
              <div>风格：{enhancementPlan.preserve.style}</div>
            </div>
          </div>

          {/* Improve items */}
          {enhancementPlan.improve.length > 0 && (
            <div className="space-y-2">
              {enhancementPlan.improve.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[11px]">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-[#6B5CE7]/10 text-[#6B5CE7] text-[9px] font-medium">
                    {item.category}
                  </span>
                  <span className="text-black/40 line-through decoration-black/20">{item.before}</span>
                  <ArrowRight className="w-3 h-3 text-black/25 shrink-0" />
                  <span className="text-black/70 font-medium">{item.after}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DecisionList — keep/remove/improve 通用列表卡片
// ---------------------------------------------------------------------------

function DecisionList({
  title,
  subtitle,
  icon,
  accent,
  items,
  delay,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  items: string[];
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT }}
    >
      <GlassCard className="p-5 h-full" style={{ borderTop: `2px solid ${accent}33` }}>
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${accent}14` }}
          >
            {icon}
          </span>
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">{title}</h3>
          <span
            className="ml-auto px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums"
            style={{ backgroundColor: `${accent}14`, color: accent }}
          >
            {items.length}
          </span>
        </div>
        <p className="text-[11px] text-[#86868b] mb-3">{subtitle}</p>

        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <motion.li
              key={`${item}-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.1 + i * 0.05, duration: 0.3, ease: EASE_OUT }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-[#1d1d1f]/80 bg-black/[0.02] border border-transparent transition-all duration-150 hover:border-black/[0.06] hover:bg-white hover:translate-x-0.5 cursor-default"
            >
              <span
                className="shrink-0 w-1 h-1 rounded-full"
                style={{ backgroundColor: accent }}
              />
              {item}
            </motion.li>
          ))}
          {items.length === 0 && (
            <li className="px-2.5 py-3 text-[12px] text-[#86868b]/60 text-center">无</li>
          )}
        </ul>
      </GlassCard>
    </motion.div>
  );
}
