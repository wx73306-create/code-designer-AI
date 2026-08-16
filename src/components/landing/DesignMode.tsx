'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Shield, Sparkles, Check } from 'lucide-react';

interface DesignModeProps {
  selectedMode: 'clone' | 'enhancement';
  setSelectedMode: (mode: 'clone' | 'enhancement') => void;
}

const MODES = [
  {
    id: 'clone' as const,
    icon: Shield,
    title: '精准复刻',
    subtitle: '95% 视觉一致',
    desc: '适合学习研究、设计分析、竞品拆解',
    features: ['保留原始布局结构', '精确匹配颜色字体', '还原交互动效', '像素级视觉还原'],
    gradient: 'from-[#1d1d1f] to-[#424245]',
    accentColor: '#1d1d1f',
  },
  {
    id: 'enhancement' as const,
    icon: Sparkles,
    title: '设计升级',
    subtitle: '80% 复刻 + 20% 优化',
    desc: '适合商业发布、品牌升级、产品落地',
    features: ['保留 80% 设计 DNA', '优化 20% 视觉体验', '增强响应式适配', '提升可访问性'],
    gradient: 'from-[#0071E3] to-[#5856D6]',
    accentColor: '#0071E3',
  },
];

export default function DesignMode({ selectedMode, setSelectedMode }: DesignModeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="relative py-24 px-4">
      <div className="max-w-[860px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-[36px] sm:text-[44px] font-semibold tracking-tight text-[#1d1d1f] mb-4">
            选择你的创造方式
          </h2>
          <p className="text-[16px] text-black/35">
            两种 AI 模式，满足不同需求
          </p>
        </motion.div>

        {/* Mode cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {MODES.map((mode, i) => {
            const Icon = mode.icon;
            const isSelected = selectedMode === mode.id;
            return (
              <motion.button
                key={mode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                onClick={() => setSelectedMode(mode.id)}
                className={`relative text-left p-7 rounded-2xl border transition-all duration-300 ${
                  isSelected
                    ? 'border-transparent bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)]'
                    : 'border-black/[0.06] bg-white/50 hover:bg-white/70 hover:border-black/[0.1]'
                }`}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <motion.div
                    layoutId="mode-selected"
                    className="absolute inset-0 rounded-2xl border-2"
                    style={{ borderColor: mode.accentColor }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}

                {/* Icon + Title */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${mode.accentColor}10` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: mode.accentColor }} />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-semibold text-[#1d1d1f]">{mode.title}</h3>
                    <p className="text-[12px] font-medium" style={{ color: mode.accentColor }}>{mode.subtitle}</p>
                  </div>
                </div>

                <p className="text-[13px] text-black/35 mb-5">{mode.desc}</p>

                {/* Features */}
                <ul className="space-y-2">
                  {mode.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-[12px] text-black/45">
                      <Check className="w-3.5 h-3.5 shrink-0" style={{ color: mode.accentColor }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
