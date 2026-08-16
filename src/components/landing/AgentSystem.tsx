'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Eye, Palette, Code2, BarChart3 } from 'lucide-react';

const CAPABILITIES = [
  {
    num: '01',
    icon: Eye,
    title: 'Vision AI',
    subtitle: '理解网页视觉',
    desc: '多模态模型分析色彩系统、字体层级、布局比例、视觉焦点，从截图逆向提取完整设计语言。',
    color: '#0071E3',
  },
  {
    num: '02',
    icon: Palette,
    title: 'Design Intelligence',
    subtitle: '生成设计系统',
    desc: '自动匹配 Apple / Stripe / Linear 等设计风格知识库，构建颜色、字体、间距、动效的完整 Token 系统。',
    color: '#5856D6',
  },
  {
    num: '03',
    icon: Code2,
    title: 'Code Agent',
    subtitle: '输出工程代码',
    desc: '组件级代码生成：React 18 + TypeScript + TailwindCSS + Framer Motion，保持高复用、响应式、可维护。',
    color: '#AF52DE',
  },
  {
    num: '04',
    icon: BarChart3,
    title: 'QA Agent',
    subtitle: '自动视觉评分',
    desc: '6 维度视觉还原度评分（布局/颜色/字体/间距/细节/响应式），评分 < 90 自动优化，最多迭代 5 轮。',
    color: '#FF375F',
  },
];

export default function AgentSystem() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="relative py-28 px-4 overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full bg-gradient-to-r from-[#0071E3]/[0.02] via-[#5856D6]/[0.03] to-[#AF52DE]/[0.02] blur-[100px]" />
      </div>

      <div className="max-w-[1080px] mx-auto">
        {/* Title — Apple style: big text, minimal */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center mb-20"
        >
          <h2 className="text-[40px] sm:text-[52px] font-semibold tracking-tight text-[#1d1d1f] leading-[1.1]">
            一个 AI 设计团队
            <br />
            <span className="text-black/30">正在为你工作</span>
          </h2>
        </motion.div>

        {/* Horizontal capabilities — scrollable on mobile, grid on desktop */}
        <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
          {CAPABILITIES.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <motion.div
                key={cap.num}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.12, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="flex-shrink-0 w-[280px] sm:w-auto snap-start"
              >
                <div className="p-6 rounded-2xl border border-black/[0.04] bg-white/40 backdrop-blur-sm transition-all duration-300 hover:border-black/[0.08] hover:bg-white/60">
                  {/* Number + Icon */}
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-[11px] font-mono text-black/15">{cap.num}</span>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${cap.color}10` }}
                    >
                      <Icon className="w-4.5 h-4.5" style={{ color: cap.color }} />
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-1">{cap.title}</h3>
                  <p className="text-[12px] font-medium mb-3" style={{ color: cap.color }}>{cap.subtitle}</p>

                  {/* Description */}
                  <p className="text-[13px] text-black/35 leading-relaxed">{cap.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
