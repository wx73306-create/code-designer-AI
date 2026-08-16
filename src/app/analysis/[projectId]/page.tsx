'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { MOCK_APPLE_REPORT, type DesignReport } from '@/types/design-report';
import {
  ReportHeader,
  BrandPosition,
  VisualLanguage,
  ColorSystem,
  TypographyAnalysis,
  LayoutAnalysis,
  ComponentExtraction,
} from '@/components/analysis/ReportSections';

// Sections to reveal progressively
const SECTIONS = [
  { id: 'brand', label: 'Brand Position', component: BrandPosition },
  { id: 'visual', label: 'Visual Language', component: VisualLanguage },
  { id: 'color', label: 'Color System', component: ColorSystem },
  { id: 'typography', label: 'Typography', component: TypographyAnalysis },
  { id: 'layout', label: 'Layout Analysis', component: LayoutAnalysis },
  { id: 'components', label: 'Component Extraction', component: ComponentExtraction },
] as const;

export default function AnalysisPage() {
  const router = useRouter();
  const [report] = useState<DesignReport>(MOCK_APPLE_REPORT);
  const [visibleSections, setVisibleSections] = useState(0);
  const [analyzing, setAnalyzing] = useState(true);

  // Progressive reveal: sections appear one by one
  useEffect(() => {
    if (!analyzing) return;

    if (visibleSections < SECTIONS.length) {
      const delay = visibleSections === 0 ? 1500 : 2000;
      const timer = setTimeout(() => {
        setVisibleSections(prev => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setAnalyzing(false);
    }
  }, [visibleSections, analyzing]);

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Top bar */}
      <nav className="sticky top-0 z-50 border-b border-black/[0.04] bg-[#f5f5f7]/85 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#0071E3]" />
            <span className="text-[13px] font-semibold text-[#1d1d1f]">Code Designer AI</span>
            <span className="text-black/15">/</span>
            <span className="text-[12px] text-black/40">Analysis Report</span>
          </div>
          {analyzing && (
            <div className="flex items-center gap-2 text-[11px] text-[#0071E3]">
              <Loader2 className="w-3 h-3 animate-spin" />
              分析中 {visibleSections}/{SECTIONS.length}
            </div>
          )}
        </div>
      </nav>

      {/* Report content */}
      <div className="max-w-4xl mx-auto px-6">
        {/* Header + Score */}
        <ReportHeader report={report} />

        {/* Progressive sections */}
        <div className="divide-y divide-black/[0.04]">
          {SECTIONS.slice(0, visibleSections).map((sec, i) => {
            const Comp = sec.component;
            return (
              <motion.div
                key={sec.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                {/* Section loading indicator for the next section */}
                <Comp report={report} />
              </motion.div>
            );
          })}

          {/* Loading indicator for next section */}
          {analyzing && visibleSections < SECTIONS.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-10 text-center"
            >
              <div className="inline-flex items-center gap-2 text-[13px] text-black/30">
                <Loader2 className="w-4 h-4 animate-spin text-[#0071E3]" />
                正在分析 {SECTIONS[visibleSections]?.label}...
              </div>
            </motion.div>
          )}
        </div>

        {/* Generate button — appears after all sections */}
        <AnimatePresence>
          {!analyzing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="py-16 text-center"
            >
              <h2 className="text-[24px] font-semibold text-[#1d1d1f] mb-3">
                设计分析完成
              </h2>
              <p className="text-[14px] text-black/35 mb-8 max-w-[400px] mx-auto">
                AI 已深度理解该网站的设计语言，可以开始生成项目
              </p>
              <button onClick={() => router.push('/')} className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#1d1d1f] text-white text-[15px] font-semibold shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-black hover:shadow-[0_6px_28px_rgba(0,0,0,0.3)] active:scale-[0.97] transition-all duration-300">
                Generate Project
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
