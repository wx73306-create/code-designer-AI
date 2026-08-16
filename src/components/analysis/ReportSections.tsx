'use client';

import { motion } from 'framer-motion';
import { Check, Palette, Type, Layout, Component, Eye, Star, ArrowRight } from 'lucide-react';
import type { DesignReport } from '@/types/design-report';

const ease = [0.25, 0.46, 0.45, 0.94] as const;

// ── Animated section wrapper ──
function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease }}
      className="py-12 border-b border-black/[0.04] last:border-0"
    >
      {children}
    </motion.div>
  );
}

// ── Report Header + Score ──
export function ReportHeader({ report }: { report: DesignReport }) {
  const { score } = report;
  const dims = [
    { label: 'Visual', value: score.visual },
    { label: 'Layout', value: score.layout },
    { label: 'Brand', value: score.brand },
    { label: 'Typography', value: score.typography },
    { label: 'Detail', value: score.detail },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease }}
      className="text-center py-16 px-4"
    >
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0071E3]/8 border border-[#0071E3]/15 mb-6">
        <Eye className="w-3 h-3 text-[#0071E3]" />
        <span className="text-[11px] font-medium text-[#0071E3]">Website Intelligence Report</span>
      </div>

      <h1 className="text-[36px] sm:text-[48px] font-bold tracking-tight text-[#1d1d1f] mb-2">
        {report.website.name}
      </h1>
      <p className="text-[14px] text-black/30 mb-10">{report.website.url} · Analyzed by Code Designer AI</p>

      {/* Score */}
      <div className="inline-flex flex-col items-center">
        <div className="text-[64px] font-bold text-[#1d1d1f] leading-none mb-1">
          {score.total}
          <span className="text-[20px] text-black/20 font-normal">/100</span>
        </div>
        <span className="text-[12px] text-black/30 mb-6">AI Design Intelligence Score</span>

        <div className="flex items-center gap-4">
          {dims.map(d => (
            <div key={d.label} className="text-center">
              <div className="text-[18px] font-semibold text-[#1d1d1f]">{d.value}</div>
              <div className="text-[10px] text-black/25">{d.label}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Brand Position ──
export function BrandPosition({ report }: { report: DesignReport }) {
  const { brandPosition } = report;
  return (
    <Section>
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-4 h-4 text-[#FF9500]" />
        <span className="text-[12px] font-medium text-black/40 uppercase tracking-wider">Brand Position</span>
      </div>
      <h2 className="text-[28px] sm:text-[32px] font-semibold text-[#1d1d1f] mb-4 leading-tight">
        {brandPosition.keywords.join(' · ')}
      </h2>
      <p className="text-[15px] text-black/40 leading-relaxed max-w-[600px] mb-6">{brandPosition.description}</p>
      <div className="flex flex-wrap gap-2">
        {brandPosition.keywords.map(k => (
          <span key={k} className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#FF9500]/[0.06] text-[#b25e00] border border-[#FF9500]/10">
            {k}
          </span>
        ))}
      </div>
    </Section>
  );
}

// ── Visual Language ──
export function VisualLanguage({ report }: { report: DesignReport }) {
  const { visualLanguage } = report;
  const items = [
    { label: 'Style', value: visualLanguage.style },
    { label: 'Mood', value: visualLanguage.mood },
    { label: 'Density', value: visualLanguage.density },
    { label: 'Whitespace', value: visualLanguage.whitespace },
    { label: 'Motion', value: visualLanguage.motion },
    { label: 'Imagery', value: visualLanguage.imagery },
  ];

  return (
    <Section delay={0.1}>
      <div className="flex items-center gap-2 mb-4">
        <Eye className="w-4 h-4 text-[#5856D6]" />
        <span className="text-[12px] font-medium text-black/40 uppercase tracking-wider">Visual Language</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map(item => (
          <div key={item.label} className="p-4 rounded-xl border border-black/[0.04] bg-white/50">
            <div className="text-[10px] text-black/25 mb-1">{item.label}</div>
            <div className="text-[13px] font-medium text-[#1d1d1f]">{item.value}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Color System ──
export function ColorSystem({ report }: { report: DesignReport }) {
  const { colorSystem } = report;
  const swatches = [
    { label: 'Primary', color: colorSystem.primary },
    { label: 'Secondary', color: colorSystem.secondary },
    { label: 'Background', color: colorSystem.background },
    { label: 'Surface', color: colorSystem.surface },
    { label: 'Accent', color: colorSystem.accent },
    { label: 'Text', color: colorSystem.text },
    { label: 'Text 2nd', color: colorSystem.textSecondary },
  ];

  return (
    <Section delay={0.1}>
      <div className="flex items-center gap-2 mb-4">
        <Palette className="w-4 h-4 text-[#0071E3]" />
        <span className="text-[12px] font-medium text-black/40 uppercase tracking-wider">Color System</span>
      </div>

      {/* Color swatches */}
      <div className="flex flex-wrap gap-3 mb-6">
        {swatches.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 300 }}
            className="flex flex-col items-center gap-1.5"
          >
            <div
              className="w-14 h-14 rounded-xl border border-black/[0.08] shadow-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-[9px] text-black/30">{s.label}</span>
            <span className="text-[8px] font-mono text-black/20">{s.color}</span>
          </motion.div>
        ))}
      </div>

      {/* Design tokens */}
      <div className="rounded-xl bg-[#1d1d1f] p-4 font-mono text-[11px]">
        <div className="text-white/25 mb-2">// Design Tokens</div>
        {Object.entries(colorSystem.tokens).map(([key, value]) => (
          <div key={key} className="text-white/55 py-0.5">
            <span className="text-[#0071E3]">{key}</span>
            <span className="text-white/25">: </span>
            <span className="text-[#FF9500]">{value}</span>
            <span className="text-white/25">;</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Typography Analysis ──
export function TypographyAnalysis({ report }: { report: DesignReport }) {
  const { typography } = report;
  return (
    <Section delay={0.1}>
      <div className="flex items-center gap-2 mb-4">
        <Type className="w-4 h-4 text-[#AF52DE]" />
        <span className="text-[12px] font-medium text-black/40 uppercase tracking-wider">Typography</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Font families */}
        <div className="p-4 rounded-xl border border-black/[0.04] bg-white/50">
          <div className="text-[10px] text-black/25 mb-3">Font Families</div>
          {[
            { role: 'Heading', family: typography.heading },
            { role: 'Body', family: typography.body },
            { role: 'Mono', family: typography.mono },
          ].map(f => (
            <div key={f.role} className="flex items-baseline gap-3 py-1.5 border-b border-black/[0.03] last:border-0">
              <span className="text-[10px] text-black/20 w-14 shrink-0">{f.role}</span>
              <span className="text-[14px] text-[#1d1d1f]">{f.family}</span>
            </div>
          ))}
        </div>

        {/* Type scale */}
        <div className="p-4 rounded-xl border border-black/[0.04] bg-white/50">
          <div className="text-[10px] text-black/25 mb-3">Type Scale</div>
          {typography.scale.map(s => (
            <div key={s.label} className="flex items-baseline gap-3 py-1 border-b border-black/[0.03] last:border-0">
              <span className="text-[9px] text-black/20 w-12 shrink-0">{s.label}</span>
              <span className="text-[#1d1d1f]" style={{ fontSize: Math.min(parseInt(s.size), 32), fontWeight: s.weight }}>
                Aa
              </span>
              <span className="text-[10px] text-black/20 ml-auto">{s.size} / {s.weight}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 mt-4 text-[11px] text-black/30">
        <span>Line Height: <strong className="text-black/50">{typography.lineHeight}</strong></span>
        <span>Letter Spacing: <strong className="text-black/50">{typography.letterSpacing}</strong></span>
      </div>
    </Section>
  );
}

// ── Layout Analysis ──
export function LayoutAnalysis({ report }: { report: DesignReport }) {
  const { layout } = report;
  return (
    <Section delay={0.1}>
      <div className="flex items-center gap-2 mb-4">
        <Layout className="w-4 h-4 text-[#34C759]" />
        <span className="text-[12px] font-medium text-black/40 uppercase tracking-wider">Layout Analysis</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-5 text-[11px] text-black/35">
        <span className="px-2.5 py-1 rounded-lg bg-[#34C759]/[0.06] border border-[#34C759]/10 text-[#1a7a3a]">
          Grid: {layout.grid}
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-[#34C759]/[0.06] border border-[#34C759]/10 text-[#1a7a3a]">
          Max: {layout.maxWidth}
        </span>
        {layout.breakpoints.map(bp => (
          <span key={bp} className="px-2.5 py-1 rounded-lg bg-black/[0.03] border border-black/[0.04]">
            @{bp}
          </span>
        ))}
      </div>

      {/* Section tree */}
      <div className="space-y-1">
        {layout.sections.map((sec, i) => (
          <motion.div
            key={sec.name}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-3 p-3 rounded-xl border border-black/[0.03] bg-white/40"
          >
            <div className="w-6 h-6 rounded-md bg-[#34C759]/10 flex items-center justify-center text-[10px] font-bold text-[#34C759]">
              {i + 1}
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-[#1d1d1f]">{sec.name}</div>
              <div className="text-[11px] text-black/30">{sec.description}</div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-black/[0.03] text-black/25 shrink-0">{sec.type}</span>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ── Component Extraction ──
export function ComponentExtraction({ report }: { report: DesignReport }) {
  const { components } = report;
  const priorityColors = { high: '#FF375F', medium: '#FF9500', low: '#8E8E93' };

  return (
    <Section delay={0.1}>
      <div className="flex items-center gap-2 mb-4">
        <Component className="w-4 h-4 text-[#FF375F]" />
        <span className="text-[12px] font-medium text-black/40 uppercase tracking-wider">Component Extraction</span>
      </div>

      <div className="space-y-2">
        {components.map((comp, i) => (
          <motion.div
            key={comp.name}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-3 p-3 rounded-xl border border-black/[0.04] bg-white/50 hover:bg-white/70 transition-colors"
          >
            <Check className="w-4 h-4 text-[#34C759] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-[#1d1d1f]">{comp.name}</span>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                  style={{ color: priorityColors[comp.priority], backgroundColor: `${priorityColors[comp.priority]}10` }}
                >
                  {comp.priority}
                </span>
              </div>
              <div className="text-[11px] text-black/30 mt-0.5">{comp.description}</div>
            </div>
            <span className="text-[10px] font-mono text-black/20 shrink-0">{comp.file}</span>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
