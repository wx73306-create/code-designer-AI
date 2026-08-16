'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Clock, Sparkles } from 'lucide-react';

interface AIProcessProps {
  isVisible: boolean;
  url: string;
}

const STEPS = [
  { id: 'capture', title: '网页采集', desc: '获取页面结构与资源' },
  { id: 'vision', title: '视觉分析', desc: 'AI 理解设计语言' },
  { id: 'design', title: '设计系统提取', desc: '颜色 · 字体 · 间距 · 动效' },
  { id: 'planning', title: '组件规划', desc: '拆解 React 组件树' },
  { id: 'code', title: '代码生成', desc: 'React + TypeScript + TailwindCSS' },
  { id: 'qa', title: '视觉评分', desc: '6 维度自动检测' },
  { id: 'optimize', title: '自动优化', desc: '迭代修复至 90+ 分' },
  { id: 'export', title: '打包输出', desc: 'HTML · React · ZIP 下载' },
];

export default function AIProcess({ isVisible, url }: AIProcessProps) {
  if (!isVisible) return null;

  const domain = (() => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return '目标网站'; }
  })();

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6 }}
      className="relative py-20 px-4"
    >
      <div className="max-w-[640px] mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#34C759]/10 border border-[#34C759]/20 mb-4">
            <Sparkles className="w-3 h-3 text-[#34C759]" />
            <span className="text-[11px] font-medium text-[#34C759]">AI 正在工作</span>
          </div>
          <h2 className="text-[28px] font-semibold text-[#1d1d1f] mb-2">
            正在分析 {domain}
          </h2>
          <p className="text-[14px] text-black/35">
            8 个 AI Agent 协同工作，预计 2 分钟内完成
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-1">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15, duration: 0.4 }}
              className="flex items-center gap-4 px-5 py-3.5 rounded-xl bg-white/50 backdrop-blur-sm border border-black/[0.03]"
            >
              {/* Status icon */}
              <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center">
                {i < 2 ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.15 + 0.2, type: 'spring', stiffness: 300 }}
                  >
                    <Check className="w-4 h-4 text-[#34C759]" />
                  </motion.div>
                ) : i === 2 ? (
                  <Loader2 className="w-4 h-4 text-[#0071E3] animate-spin" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-black/15" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`text-[14px] font-medium ${i <= 2 ? 'text-[#1d1d1f]' : 'text-black/35'}`}>
                  {step.title}
                </div>
                <div className="text-[11px] text-black/25 mt-0.5">{step.desc}</div>
              </div>

              {/* Progress bar for active step */}
              {i === 2 && (
                <div className="w-16 h-1.5 rounded-full bg-black/[0.04] overflow-hidden shrink-0">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#0071E3] to-[#5856D6]"
                    initial={{ width: '0%' }}
                    animate={{ width: '65%' }}
                    transition={{ duration: 2, ease: 'easeOut' }}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
