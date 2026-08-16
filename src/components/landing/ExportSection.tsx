'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Globe, FileCode, FolderArchive, Package, ArrowRight, Sparkles } from 'lucide-react';

const EXPORT_FORMATS = [
  { icon: Globe, label: 'HTML', desc: '自包含单文件，双击打开', color: '#0071E3' },
  { icon: FileCode, label: 'React', desc: '组件化代码，可直接开发', color: '#5856D6' },
  { icon: FolderArchive, label: 'ZIP 包', desc: '完整项目包，解压即用', color: '#34C759' },
  { icon: Package, label: 'Next.js', desc: '全栈项目脚手架', color: '#FF9500' },
];

interface ExportSectionProps {
  onCtaClick: () => void;
}

export default function ExportSection({ onCtaClick }: ExportSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="relative py-24 px-4">
      <div className="max-w-[860px] mx-auto">
        {/* Export formats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-[36px] sm:text-[44px] font-semibold tracking-tight text-[#1d1d1f] mb-4">
            生成完成，一键带走
          </h2>
          <p className="text-[16px] text-black/35">
            支持多种导出格式，满足学习和开发需求
          </p>
        </motion.div>

        {/* Format grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-20">
          {EXPORT_FORMATS.map((fmt, i) => {
            const Icon = fmt.icon;
            return (
              <motion.div
                key={fmt.label}
                initial={{ opacity: 0, y: 16 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="flex flex-col items-center p-5 rounded-2xl border border-black/[0.04] bg-white/50 backdrop-blur-sm text-center"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${fmt.color}10` }}
                >
                  <Icon className="w-5 h-5" style={{ color: fmt.color }} />
                </div>
                <span className="text-[14px] font-semibold text-[#1d1d1f] mb-1">{fmt.label}</span>
                <span className="text-[11px] text-black/30 leading-relaxed">{fmt.desc}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Final CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0071E3]/[0.06] via-[#5856D6]/[0.04] to-[#AF52DE]/[0.03]" />

          <div className="relative text-center py-16 px-6">
            <Sparkles className="w-8 h-8 text-[#0071E3] mx-auto mb-5" />
            <h3 className="text-[28px] sm:text-[32px] font-semibold text-[#1d1d1f] mb-3">
              准备好开始了吗？
            </h3>
            <p className="text-[15px] text-black/35 mb-8 max-w-[400px] mx-auto">
              粘贴一个网址，让 AI 为你逆向生成完整项目
            </p>
            <button
              onClick={onCtaClick}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#0071E3] text-white text-[15px] font-medium shadow-[0_4px_20px_rgba(0,113,227,0.3)] hover:bg-[#0077ED] hover:shadow-[0_6px_28px_rgba(0,113,227,0.4)] active:scale-[0.97] transition-all duration-300"
            >
              开始 AI 分析
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
