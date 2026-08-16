'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Check, ArrowRight, Target, Sparkles } from 'lucide-react';
import { DESIGN_MODES } from '@/config/generation-mode';
import type { DesignMode } from '@/types/design-mode';

interface ModeSelectorProps {
  selected: DesignMode;
  onSelect: (mode: DesignMode) => void;
  onGenerate?: () => void;
}

export default function ModeSelector({ selected, onSelect, onGenerate }: ModeSelectorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-20 px-4">
      <div className="max-w-[820px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-[36px] sm:text-[44px] font-semibold tracking-tight text-[#1d1d1f] mb-4">
            选择你的创造方式
          </h2>
          <p className="text-[16px] text-black/35 max-w-[440px] mx-auto">
            AI 不仅复制网页，还可以理解设计并进化它
          </p>
        </motion.div>

        {/* Mode cards — large, immersive */}
        <div className="space-y-4">
          {DESIGN_MODES.map((mode, i) => {
            const isSelected = selected === mode.id;
            return (
              <motion.button
                key={mode.id}
                initial={{ opacity: 0, y: 16 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                onClick={() => onSelect(mode.id)}
                className={`relative w-full text-left p-7 rounded-2xl border transition-all duration-300 overflow-hidden group ${
                  isSelected
                    ? 'border-transparent shadow-[0_8px_40px_rgba(0,0,0,0.08)]'
                    : 'border-black/[0.06] bg-white/50 hover:bg-white/70 hover:border-black/[0.1]'
                }`}
              >
                {/* Selected gradient background */}
                {isSelected && (
                  <motion.div
                    layoutId="mode-bg"
                    className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-[0.04]`}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                  />
                )}

                {/* Selected border indicator */}
                {isSelected && (
                  <motion.div
                    layoutId="mode-border"
                    className="absolute inset-0 rounded-2xl border-2 pointer-events-none"
                    style={{ borderColor: mode.accentColor }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                  />
                )}

                <div className="relative flex items-start gap-5">
                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                    style={{ backgroundColor: `${mode.accentColor}10` }}
                  >
                    {mode.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-[20px] font-semibold text-[#1d1d1f]">{mode.title}</h3>
                      <span className="text-[12px] font-medium" style={{ color: mode.accentColor }}>
                        {mode.subtitle}
                      </span>
                    </div>

                    <p className="text-[13px] text-black/35 mb-4">{mode.description}</p>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" style={{ color: mode.accentColor }} />
                        <span className="text-[12px] font-semibold text-[#1d1d1f]">{mode.similarity}%</span>
                        <span className="text-[11px] text-black/25">视觉还原</span>
                      </div>
                      {mode.id === 'design-evolution' && (
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" style={{ color: mode.accentColor }} />
                          <span className="text-[11px] text-black/25">20% AI 优化</span>
                        </div>
                      )}
                    </div>

                    {/* Feature tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {mode.optimization.map(opt => (
                        <span
                          key={opt}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium border"
                          style={{
                            color: isSelected ? mode.accentColor : 'rgba(0,0,0,0.3)',
                            backgroundColor: isSelected ? `${mode.accentColor}08` : 'rgba(0,0,0,0.02)',
                            borderColor: isSelected ? `${mode.accentColor}15` : 'rgba(0,0,0,0.04)',
                          }}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 inline mr-1 -mt-0.5" />}
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Selection indicator */}
                  <div className="shrink-0 mt-1">
                    {isSelected ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: mode.accentColor }}
                      >
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      </motion.div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-black/[0.1]" />
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Generate button */}
        {onGenerate && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-center mt-10"
          >
            <button
              onClick={onGenerate}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#1d1d1f] text-white text-[15px] font-semibold shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-black hover:shadow-[0_6px_28px_rgba(0,0,0,0.3)] active:scale-[0.97] transition-all duration-300"
            >
              Generate Project
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
}
