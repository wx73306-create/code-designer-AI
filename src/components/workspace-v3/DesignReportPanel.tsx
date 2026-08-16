'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, Type, Layout, Component, Eye, ChevronDown, ChevronRight, Sparkles, Star } from 'lucide-react';
import { MOCK_APPLE_REPORT } from '@/types/design-report';

export default function DesignReportPanel() {
  const report = MOCK_APPLE_REPORT;
  const [expanded, setExpanded] = useState<string | null>('colors');

  const toggle = (id: string) => setExpanded(expanded === id ? null : id);

  return (
    <div className="p-4 space-y-1">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-3.5 h-3.5 text-[#0071E3]" />
        <span className="text-[11px] font-semibold text-black/50 uppercase tracking-wider">Design Report</span>
      </div>

      {/* Score */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-[#0071E3]/[0.04] border border-[#0071E3]/10">
        <div className="text-[28px] font-bold text-[#0071E3]">{report.score.total}</div>
        <div>
          <div className="text-[10px] text-black/30">AI Design Score</div>
          <div className="text-[9px] text-black/20">Visual {report.score.visual} · Layout {report.score.layout}</div>
        </div>
      </div>

      {/* Brand keywords */}
      <div className="flex flex-wrap gap-1 mb-4">
        {report.brandPosition.keywords.map(k => (
          <span key={k} className="px-2 py-0.5 rounded text-[9px] font-medium bg-[#FF9500]/[0.06] text-[#b25e00] border border-[#FF9500]/10">
            {k}
          </span>
        ))}
      </div>

      {/* Collapsible sections */}
      {([
        { id: 'colors', icon: Palette, label: 'Colors', color: '#0071E3' },
        { id: 'typography', icon: Type, label: 'Typography', color: '#AF52DE' },
        { id: 'layout', icon: Layout, label: 'Layout', color: '#34C759' },
        { id: 'components', icon: Component, label: 'Components', color: '#FF375F' },
      ]).map(sec => {
        const Icon = sec.icon;
        const isOpen = expanded === sec.id;
        return (
          <div key={sec.id} className="border-b border-black/[0.03] last:border-0">
            <button
              onClick={() => toggle(sec.id)}
              className="w-full flex items-center gap-2 py-2.5 text-left hover:bg-black/[0.02] transition-colors rounded-lg px-1"
            >
              <Icon className="w-3.5 h-3.5" style={{ color: sec.color }} />
              <span className="text-[11px] font-medium text-black/55 flex-1">{sec.label}</span>
              {isOpen ? <ChevronDown className="w-3 h-3 text-black/20" /> : <ChevronRight className="w-3 h-3 text-black/15" />}
            </button>
            {isOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                className="pb-3 px-1 overflow-hidden">
                {sec.id === 'colors' && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(report.colorSystem.tokens).slice(0, 8).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded border border-black/[0.08]" style={{ backgroundColor: val }} />
                        <span className="text-[8px] text-black/25 font-mono">{val}</span>
                      </div>
                    ))}
                  </div>
                )}
                {sec.id === 'typography' && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-black/30">Heading: <strong className="text-black/50">{report.typography.heading}</strong></div>
                    <div className="text-[10px] text-black/30">Body: <strong className="text-black/50">{report.typography.body}</strong></div>
                    <div className="text-[10px] text-black/30">Scale: {report.typography.scale.map(s => s.size).join(' · ')}</div>
                  </div>
                )}
                {sec.id === 'layout' && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-black/30">Grid: <strong className="text-black/50">{report.layout.grid}</strong></div>
                    {report.layout.sections.map(s => (
                      <div key={s.name} className="flex items-center gap-1.5 text-[10px] text-black/30">
                        <span className="w-1 h-1 rounded-full bg-[#34C759]" />
                        {s.name} <span className="text-black/15">— {s.type}</span>
                      </div>
                    ))}
                  </div>
                )}
                {sec.id === 'components' && (
                  <div className="space-y-1">
                    {report.components.map(c => (
                      <div key={c.name} className="flex items-center gap-1.5 text-[10px] text-black/35">
                        <span className="text-[#34C759]">✓</span>
                        <span className="text-black/50 font-medium">{c.name}</span>
                        <span className="text-[8px] font-mono text-black/20 ml-auto">{c.file}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}
