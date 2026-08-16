'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Palette,
  Type,
  Ruler,
  Square,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAgentStore } from '@/store/agent-store';
import { mockDesignAnalysis } from '@/lib/mock-data';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import type {
  ColorToken,
  TypographyToken,
  ShadowToken,
  AnimationToken,
} from '@/types/agent';

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

type CategoryId = 'colors' | 'typography' | 'spacing' | 'radii' | 'animations';

interface Category {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
}

const CATEGORIES: Category[] = [
  { id: 'colors',     label: '色彩分析', icon: Palette  },
  { id: 'typography', label: '字体分析', icon: Type     },
  { id: 'spacing',    label: '间距布局', icon: Ruler    },
  { id: 'radii',      label: '圆角阴影', icon: Square   },
  { id: 'animations', label: '动效分析', icon: Sparkles },
];

// ---------------------------------------------------------------------------
// DesignAnalysisSection
// ---------------------------------------------------------------------------

export function DesignAnalysisSection() {
  const [active, setActive] = useState<CategoryId>('colors');
  const visionStatus = useAgentStore((s) => s.task.agents.vision.status);
  const analysis = useAgentStore((s) => s.task.designAnalysis) ?? mockDesignAnalysis;

  const visionCompleted = visionStatus === 'completed';

  // Only render when the vision agent has finished
  if (!visionCompleted) return null;

  return (
    <section className="relative w-full py-20 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight bg-gradient-to-r from-[#1d1d1f] to-black/70 bg-clip-text text-transparent">
            设计分析报告
          </h2>
          <p className="mt-2 text-sm text-[#86868b]">
            Vision Agent 从截图中提取的完整设计令牌
          </p>
        </motion.div>

        {/* Two-column layout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex flex-col md:flex-row gap-6"
        >

          {/* Left column: category tabs */}
          <aside className="w-full md:w-56 shrink-0">
            <nav className="flex md:flex-col gap-1 overflow-x-auto hide-scrollbar">
              {CATEGORIES.map(({ id, label, icon: Icon }) => {
                const isActive = id === active;
                return (
                  <button
                    key={id}
                    onClick={() => setActive(id)}
                    className={cn(
                      'flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[14px] whitespace-nowrap',
                      'transition-all duration-200',
                      isActive
                        ? 'bg-black/[0.06] text-[#1d1d1f] border border-black/[0.10] border-l-2 border-l-[#0071E3]'
                        : 'text-[#86868b] hover:text-black/60 hover:bg-black/[0.03] border border-transparent',
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right column: content area */}
          <div className="flex-1 min-w-0">
            <GlassCard className="p-6">
              <motion.div
                key={active}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {active === 'colors'     && <ColorsPanel     data={analysis.colors ?? []}             />}
                {active === 'typography' && <TypographyPanel data={analysis.typography ?? []}         />}
                {active === 'spacing'    && <SpacingPanel    data={analysis.spacing ?? []}            />}
                {active === 'radii'      && <RadiiPanel      radii={analysis.borderRadius ?? []} shadows={analysis.shadows ?? []} />}
                {active === 'animations' && <AnimationsPanel data={analysis.animations ?? []}         />}
              </motion.div>
            </GlassCard>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ===========================================================================
// Sub-panels
// ===========================================================================

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

function ColorsPanel({ data }: { data: ColorToken[] }) {
  return (
    <div>
      <h3 className="text-base font-medium text-[#1d1d1f] mb-5">色彩分析</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {data.map((c, i) => (
          <div
            key={`${c.name}-${c.hex}-${i}`}
            className={cn(
              'rounded-lg border border-black/[0.06] overflow-hidden',
              'bg-black/[0.02] transition-all hover:bg-black/[0.04] hover:-translate-y-0.5 hover:shadow-lg',
            )}
          >
            {/* Swatch */}
            <div
              className="h-20 w-full"
              style={{ backgroundColor: c.hex }}
            />
            {/* Info */}
            <div className="px-3 py-2.5">
              <p className="text-xs font-medium text-black/80 truncate">{c.name}</p>
              <p className="text-xs text-black/40 font-mono mt-0.5">{c.hex}</p>
              <p className="text-[11px] text-[#aeaeb2] mt-1 leading-snug truncate-2-lines">
                {c.usage}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

function TypographyPanel({ data }: { data: TypographyToken[] }) {
  return (
    <div>
      <h3 className="text-base font-medium text-[#1d1d1f] mb-5">字体分析</h3>
      <div className="space-y-5">
        {data.map((t) => (
          <div
            key={t.name}
            className={cn(
              'rounded-lg border border-black/[0.06] p-4',
              'bg-black/[0.02] hover:bg-black/[0.04] transition-colors',
            )}
          >
            {/* Specimen */}
            <p
              className="text-black/85 leading-tight mb-3 min-h-[3rem] flex items-center"
              style={{
                fontFamily: `"${t.family}", system-ui, sans-serif`,
                fontWeight: t.weight,
                fontSize: t.size,
              }}
            >
              The quick brown fox jumps over the lazy dog
            </p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#86868b]">
              <span className="font-medium text-black/50">{t.name}</span>
              <span>{t.family}</span>
              <span>Weight {t.weight}</span>
              <span>{t.size}</span>
              <span className="text-[#aeaeb2]">{t.usage}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

function SpacingPanel({ data }: { data: number[] }) {
  const maxVal = useMemo(() => Math.max(...data), [data]);

  return (
    <div>
      <h3 className="text-base font-medium text-[#1d1d1f] mb-5">间距布局</h3>
      <div className="space-y-2.5">
        {data.map((val, i) => {
          const pct = (val / maxVal) * 100;
          return (
            <div key={`${val}-${i}`} className="flex items-center gap-3">
              {/* Label */}
              <span className="w-10 text-right text-xs font-mono text-[#86868b] tabular-nums">
                {val}px
              </span>
              {/* Bar */}
              <div className="flex-1 h-5 rounded bg-black/[0.03] overflow-hidden">
                <motion.div
                  className="h-full rounded bg-[#0071E3]/60"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-xs text-[#aeaeb2]">
        共 {data.length} 个间距级别，范围 {data[0]}px – {data[data.length - 1]}px
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Border Radius & Shadows
// ---------------------------------------------------------------------------

function RadiiPanel({
  radii,
  shadows,
}: {
  radii: number[];
  shadows: ShadowToken[];
}) {
  return (
    <div className="space-y-8">
      {/* Border radius */}
      <div>
        <h3 className="text-base font-medium text-[#1d1d1f] mb-4">圆角</h3>
        <div className="flex flex-wrap gap-4">
          {radii.map((r, i) => (
            <div key={`${r}-${i}`} className="flex flex-col items-center gap-2">
              <div
                className="w-16 h-16 bg-black/[0.06] border border-black/[0.10]"
                style={{ borderRadius: `${r}px` }}
              />
              <span className="text-[11px] font-mono text-[#86868b]">{r}px</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shadows */}
      <div>
        <h3 className="text-base font-medium text-[#1d1d1f] mb-4">阴影</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {shadows.map((s) => (
            <div
              key={s.name}
              className={cn(
                'rounded-lg border border-black/[0.06] p-4',
                'bg-black/[0.02] hover:bg-black/[0.04] transition-colors',
              )}
            >
              {/* Preview box with shadow */}
              <div
                className="w-full h-14 rounded-lg bg-black/[0.06] mb-3"
                style={{ boxShadow: s.value }}
              />
              <p className="text-xs font-medium text-black/70">{s.name}</p>
              <p className="text-[11px] text-[#aeaeb2] font-mono mt-1 leading-snug break-all">
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

function AnimationsPanel({ data }: { data: AnimationToken[] }) {
  return (
    <div>
      <h3 className="text-base font-medium text-[#1d1d1f] mb-5">动效分析</h3>
      <div className="space-y-3">
        {data.map((a) => (
          <div
            key={a.name}
            className={cn(
              'rounded-lg border border-black/[0.06] p-4',
              'bg-black/[0.02] hover:bg-black/[0.04] transition-colors',
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              {/* Name */}
              <p className="text-sm font-medium text-black/80 w-36 shrink-0">{a.name}</p>

              {/* Details */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#86868b]">
                <span>
                  <span className="text-[#aeaeb2]">Property</span>{' '}
                  <span className="font-mono text-black/40">{a.property}</span>
                </span>
                <span>
                  <span className="text-[#aeaeb2]">Duration</span>{' '}
                  <span className="font-mono text-[#0071E3]/80">{a.duration}</span>
                </span>
                <span>
                  <span className="text-[#aeaeb2]">Easing</span>{' '}
                  <span className="font-mono text-black/40">{a.easing}</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Content version for workspace tab
export function DesignAnalysisContent() {
  const analysis = useAgentStore((s) => s.task.designAnalysis) ?? mockDesignAnalysis;
  const goal = useAgentStore((s) => s.task.goal);
  const [active, setActive] = useState<CategoryId>('colors');

  const GOAL_INFO: Record<string, { label: string; color: string; desc: string }> = {
    colors:   { label: '学习配色', color: '#AF52DE', desc: '色彩体系提取与配色推荐' },
    layout:   { label: '学习排版', color: '#FF9500', desc: '布局结构与响应式策略分析' },
    style:    { label: '学习风格', color: '#0071E3', desc: '设计风格与视觉语言解读' },
    features: { label: '学习特色', color: '#34C759', desc: '亮点功能与交互设计挖掘' },
    template: { label: '构建模板', color: '#FF3B30', desc: '完整项目结构与组件规划' },
  };

  // Access extra goal-specific data from the analysis
  const extraData = analysis as unknown as Record<string, unknown>;

  return (
    <div className="space-y-5">
      {/* Goal banner */}
      {goal && GOAL_INFO[goal] && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-black/[0.06] bg-white/60 backdrop-blur-xl"
        >
          <span
            className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white"
            style={{ backgroundColor: GOAL_INFO[goal].color }}
          >
            {GOAL_INFO[goal].label}
          </span>
          <span className="text-[12px] text-black/50">{GOAL_INFO[goal].desc}</span>
        </motion.div>
      )}

      {/* Main analysis layout */}
      <div className="flex flex-col md:flex-row gap-5">
        <aside className="w-full md:w-48 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto hide-scrollbar">
            {CATEGORIES.map(({ id, label, icon: Icon }) => {
              const isActive = id === active;
              return (
                <button key={id} onClick={() => setActive(id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] whitespace-nowrap transition-all duration-200',
                    isActive ? 'bg-black/[0.06] text-[#1d1d1f] border border-black/[0.10] border-l-2 border-l-[#AF52DE]' : 'text-[#86868b] hover:text-black/60 hover:bg-black/[0.03] border border-transparent',
                  )}>
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </button>
              );
            })}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-black/[0.06] bg-white/75 p-5 backdrop-blur-xl">
            <motion.div key={active} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              {active === 'colors' && <ColorsPanel data={analysis.colors} />}
              {active === 'typography' && <TypographyPanel data={analysis.typography} />}
              {active === 'spacing' && <SpacingPanel data={analysis.spacing} />}
              {active === 'radii' && <RadiiPanel radii={analysis.borderRadius} shadows={analysis.shadows} />}
              {active === 'animations' && <AnimationsPanel data={analysis.animations} />}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Goal-specific result panels */}
      {goal === 'colors' && !!extraData.colorRecommendations && (
        <ColorRecommendations data={extraData.colorRecommendations as unknown as Array<{ name?: string; primary?: string; secondary?: string; accent?: string; background?: string; foreground?: string }>} />
      )}
      {goal === 'layout' && !!extraData.layoutAnalysis && (
        <GoalTextPanel title="布局分析" data={extraData.layoutAnalysis} />
      )}
      {goal === 'style' && !!extraData.designStyle && (
        <GoalTextPanel title="设计风格分析" data={extraData.designStyle} />
      )}
      {goal === 'features' && !!extraData.featureHighlights && (
        <FeatureHighlights data={extraData.featureHighlights as unknown as Array<{ name?: string; description?: string; category?: string }>} />
      )}
      {goal === 'template' && !!extraData.projectTemplate && (
        <GoalTextPanel title="项目模板规划" data={extraData.projectTemplate} />
      )}

      {/* Raw AI insight for any goal */}
      {!!extraData.raw && typeof extraData.raw === 'string' && extraData.raw.length > 50 && (
        <details className="rounded-xl border border-black/[0.06] bg-white/60 backdrop-blur-xl">
          <summary className="px-4 py-3 cursor-pointer text-[12px] text-black/40 hover:text-black/60 transition-colors">
            查看 AI 原始分析文本
          </summary>
          <pre className="px-4 pb-4 text-[11px] text-black/50 whitespace-pre-wrap max-h-60 overflow-y-auto">
            {extraData.raw}
          </pre>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal-specific sub-panels
// ---------------------------------------------------------------------------

function ColorRecommendations({ data }: { data: Array<{ name?: string; primary?: string; secondary?: string; accent?: string; background?: string; foreground?: string }> }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="rounded-xl border border-black/[0.06] bg-white/75 p-5 backdrop-blur-xl">
      <h3 className="text-[14px] font-medium text-[#1d1d1f] mb-4 flex items-center gap-2">
        <Palette className="w-4 h-4 text-[#AF52DE]" />
        推荐配色方案
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((scheme, i) => (
          <div key={i} className="rounded-lg border border-black/[0.06] p-3 bg-black/[0.01]">
            <p className="text-[11px] text-black/40 mb-2">{scheme.name || `方案 ${i + 1}`}</p>
            <div className="flex gap-1 mb-2">
              {[scheme.primary, scheme.secondary, scheme.accent, scheme.background, scheme.foreground].filter(Boolean).map((c, j) => (
                <div key={j} className="flex-1 h-8 rounded-md border border-black/[0.06]" style={{ backgroundColor: c as string }} title={c as string} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                { label: '主色', val: scheme.primary },
                { label: '辅色', val: scheme.secondary },
                { label: '强调', val: scheme.accent },
                { label: '背景', val: scheme.background },
                { label: '前景', val: scheme.foreground },
              ].filter(x => x.val).map(({ label, val }) => (
                <span key={label} className="text-[10px] text-black/40">{label}: <code className="text-black/60">{val}</code></span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function GoalTextPanel({ title, data }: { title: string; data: unknown }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="rounded-xl border border-black/[0.06] bg-white/75 p-5 backdrop-blur-xl">
      <h3 className="text-[14px] font-medium text-[#1d1d1f] mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#0071E3]" />
        {title}
      </h3>
      {typeof data === 'string' ? (
        <p className="text-[12px] text-black/60 leading-relaxed whitespace-pre-wrap">{data}</p>
      ) : typeof data === 'object' && data !== null ? (
        <div className="space-y-2">
          {Object.entries(data as Record<string, unknown>).map(([key, val]) => (
            <div key={key} className="text-[12px]">
              <span className="text-black/40 font-medium">{key}: </span>
              {typeof val === 'string' ? (
                <span className="text-black/60">{val}</span>
              ) : Array.isArray(val) ? (
                <ul className="list-disc list-inside text-black/60 ml-1">
                  {val.map((item, i) => (
                    <li key={i} className="text-[11px]">{typeof item === 'string' ? item : JSON.stringify(item)}</li>
                  ))}
                </ul>
              ) : (
                <code className="text-[11px] text-black/50">{JSON.stringify(val)}</code>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}

function FeatureHighlights({ data }: { data: Array<{ name?: string; description?: string; category?: string }> }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="rounded-xl border border-black/[0.06] bg-white/75 p-5 backdrop-blur-xl">
      <h3 className="text-[14px] font-medium text-[#1d1d1f] mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#34C759]" />
        特色功能亮点
      </h3>
      <div className="space-y-2">
        {data.map((feat, i) => (
          <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-black/[0.02] border border-black/[0.04]">
            <span className="shrink-0 w-5 h-5 rounded-full bg-[#34C759]/10 text-[#34C759] text-[10px] flex items-center justify-center font-medium mt-0.5">{i + 1}</span>
            <div>
              <p className="text-[12px] font-medium text-[#1d1d1f]">{feat.name || `特色 ${i + 1}`}</p>
              {feat.category && <span className="text-[10px] text-[#86868b]">{feat.category}</span>}
              {feat.description && <p className="text-[11px] text-black/50 mt-0.5">{feat.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
