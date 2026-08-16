'use client';

import { motion } from 'framer-motion';
import { Palette, Check, X, AlertTriangle } from 'lucide-react';
import { useAgentStore } from '@/store/agent-store';
import { GlassCard } from '@/components/ui/glass-card';
import { mockStyleMatch, mockDesignSystem } from '@/lib/mock-data';
import type { StyleMatch, GeneratedDesignSystem } from '@/types/agent';

// ---------------------------------------------------------------------------
// Score Bar Component
// ---------------------------------------------------------------------------

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-black/50 w-8 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-black/[0.04] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
        />
      </div>
      <span className="text-xs font-medium text-black/60 w-10 text-right">{value}/{max}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence Ring
// ---------------------------------------------------------------------------

function ConfidenceRing({ confidence, styleName }: { confidence: number; styleName: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - confidence / 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="8" />
          <motion.circle
            cx="60" cy="60" r={radius} fill="none"
            stroke="#FF6482" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold text-[#1d1d1f]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            {confidence}%
          </motion.span>
          <span className="text-[10px] text-black/35">置信度</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-[#1d1d1f]">{styleName}</p>
        <p className="text-xs text-black/35">匹配设计体系</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Content
// ---------------------------------------------------------------------------

export function StyleMatchContent() {
  const styleMatch = useAgentStore((s) => s.task.styleMatch) ?? mockStyleMatch;
  const designSystem = useAgentStore((s) => s.task.designSystem) ?? mockDesignSystem;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#FF6482]/10 flex items-center justify-center">
          <Palette className="w-4.5 h-4.5 text-[#FF6482]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[#1d1d1f]">设计体系匹配</h3>
          <p className="text-xs text-black/35">Style Matcher Agent · Web Design Knowledge Base</p>
        </div>
      </div>

      {/* Top: Confidence + Score Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard className="p-6 flex items-center justify-center">
          <ConfidenceRing confidence={styleMatch.confidence} styleName={styleMatch.matchedStyle} />
        </GlassCard>

        <GlassCard className="p-6">
          <h4 className="text-sm font-medium text-[#1d1d1f] mb-4">四维评分</h4>
          <div className="space-y-3">
            <ScoreBar label="布局" value={styleMatch.breakdown.layout} max={30} color="#0071E3" />
            <ScoreBar label="色彩" value={styleMatch.breakdown.color} max={25} color="#AF52DE" />
            <ScoreBar label="组件" value={styleMatch.breakdown.components} max={25} color="#FF9500" />
            <ScoreBar label="字体" value={styleMatch.breakdown.typography} max={20} color="#34C759" />
          </div>
          <div className="mt-4 pt-3 border-t border-black/[0.04]">
            <div className="flex justify-between text-xs">
              <span className="text-black/40">总分</span>
              <span className="font-semibold text-[#1d1d1f]">{styleMatch.breakdown.total}/100</span>
            </div>
            {styleMatch.secondaryStyle && (
              <div className="flex justify-between text-xs mt-1">
                <span className="text-black/40">次要匹配</span>
                <span className="text-black/60">{styleMatch.secondaryStyle}</span>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* All Scores */}
      <GlassCard className="p-6">
        <h4 className="text-sm font-medium text-[#1d1d1f] mb-3">全部风格评分</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(styleMatch.scores)
            .sort(([, a], [, b]) => b - a)
            .map(([name, score]) => {
              const isBest = name === styleMatch.matchedStyle;
              return (
                <div
                  key={name}
                  className={`px-3 py-2 rounded-lg text-center transition-colors ${
                    isBest ? 'bg-[#FF6482]/10 border border-[#FF6482]/20' : 'bg-black/[0.02]'
                  }`}
                >
                  <p className={`text-lg font-bold ${isBest ? 'text-[#FF6482]' : 'text-black/60'}`}>{score}</p>
                  <p className="text-[10px] text-black/40 truncate">{name}</p>
                </div>
              );
            })}
        </div>
      </GlassCard>

      {/* Design System Tokens */}
      <GlassCard className="p-6">
        <h4 className="text-sm font-medium text-[#1d1d1f] mb-4">Generated Design System</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <TokenCard label="间距 (S/M/L)" value={`${designSystem.tokens.spacing.small} / ${designSystem.tokens.spacing.medium} / ${designSystem.tokens.spacing.large}px`} />
          <TokenCard label="圆角" value={`${designSystem.tokens.radius}px`} />
          <TokenCard label="阴影" value={designSystem.tokens.shadow} />
          <TokenCard label="字体" value={designSystem.tokens.typography.font} />
        </div>

        {/* Colors */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-black/40">色彩:</span>
          <div className="flex gap-2">
            {designSystem.tokens.colors.background.map((c) => (
              <div key={c} className="flex items-center gap-1">
                <div className="w-5 h-5 rounded-md border border-black/[0.08]" style={{ backgroundColor: c }} />
                <span className="text-[10px] text-black/40">{c}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-md border border-black/[0.08]" style={{ backgroundColor: designSystem.tokens.colors.accent }} />
              <span className="text-[10px] text-black/40">{designSystem.tokens.colors.accent}</span>
            </div>
          </div>
        </div>

        {/* Philosophy */}
        <div className="mt-4 flex flex-wrap gap-2">
          {designSystem.philosophy.map((p) => (
            <span key={p} className="px-2.5 py-1 rounded-full bg-[#FF6482]/[0.06] text-[11px] text-[#FF6482] font-medium">
              {p}
            </span>
          ))}
        </div>
      </GlassCard>

      {/* Rules + Avoid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard className="p-6">
          <h4 className="text-sm font-medium text-[#1d1d1f] mb-3 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-[#34C759]" />
            设计规则 (MUST)
          </h4>
          <ul className="space-y-2">
            {designSystem.rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-black/60">
                <span className="text-[#34C759] mt-0.5 shrink-0">•</span>
                {rule}
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard className="p-6">
          <h4 className="text-sm font-medium text-[#1d1d1f] mb-3 flex items-center gap-2">
            <X className="w-3.5 h-3.5 text-[#FF3B30]" />
            禁止事项 (MUST NOT)
          </h4>
          <ul className="space-y-2">
            {designSystem.avoid.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-black/60">
                <span className="text-[#FF3B30] mt-0.5 shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t border-black/[0.04]">
            <h5 className="text-xs font-medium text-black/40 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              组件避免
            </h5>
            <div className="flex flex-wrap gap-1.5">
              {designSystem.components.avoid.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded bg-[#FF3B30]/[0.05] text-[10px] text-[#FF3B30]/70">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Reasoning */}
      <GlassCard className="p-6">
        <h4 className="text-sm font-medium text-[#1d1d1f] mb-2">匹配推理</h4>
        <p className="text-xs text-black/50 leading-relaxed">{styleMatch.reasoning}</p>
      </GlassCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Token Card
// ---------------------------------------------------------------------------

function TokenCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-black/[0.02]">
      <p className="text-[10px] text-black/35 mb-0.5">{label}</p>
      <p className="text-xs font-medium text-[#1d1d1f]">{value}</p>
    </div>
  );
}
