'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, TrendingUp, Sparkles } from 'lucide-react';
import { MOCK_IMPROVEMENT_REPORT } from '@/config/generation-mode';

export default function ImprovementReport() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const report = MOCK_IMPROVEMENT_REPORT;

  return (
    <section ref={ref} className="relative py-16 px-4">
      <div className="max-w-[720px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[#0071E3]" />
            <span className="text-[12px] font-medium text-[#0071E3] uppercase tracking-wider">AI Improvement Report</span>
          </div>
          <h2 className="text-[28px] font-semibold text-[#1d1d1f] mb-3">
            设计进化摘要
          </h2>
          <p className="text-[14px] text-black/35 leading-relaxed">{report.summary}</p>
        </motion.div>

        {/* Score comparison */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="flex items-center gap-6 mb-8 p-5 rounded-2xl border border-black/[0.04] bg-white/50"
        >
          <div className="text-center">
            <div className="text-[32px] font-bold text-black/25">{report.beforeScore}</div>
            <div className="text-[11px] text-black/25">Before</div>
          </div>
          <div className="flex-1 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-black/[0.04] overflow-hidden">
              <motion.div
                initial={{ width: `${report.beforeScore}%` }}
                animate={isInView ? { width: `${report.afterScore}%` } : {}}
                transition={{ delay: 0.5, duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="h-full rounded-full bg-gradient-to-r from-[#0071E3] to-[#5856D6]"
              />
            </div>
            <TrendingUp className="w-4 h-4 text-[#34C759]" />
          </div>
          <div className="text-center">
            <div className="text-[32px] font-bold text-[#0071E3]">{report.afterScore}</div>
            <div className="text-[11px] text-black/25">After</div>
          </div>
        </motion.div>

        {/* Improvement items */}
        <div className="space-y-3">
          {report.improvements.map((item, i) => (
            <motion.div
              key={item.dimension}
              initial={{ opacity: 0, y: 8 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
              className="p-4 rounded-xl border border-black/[0.04] bg-white/50"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-semibold text-[#1d1d1f]">{item.dimension}</span>
              </div>
              <div className="flex items-center gap-3 text-[12px]">
                <span className="text-black/30 line-through">{item.before}</span>
                <ArrowRight className="w-3 h-3 text-[#0071E3] shrink-0" />
                <span className="text-[#1d1d1f] font-medium">{item.after}</span>
              </div>
              <div className="text-[11px] text-black/25 mt-1.5">{item.reason}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
