'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Clock, Zap, Star } from 'lucide-react';

interface ShowcaseCase {
  name: string;
  category: string;
  score: number;
  time: string;
  tech: string;
  gradient: string;
  emoji: string;
  desc: string;
}

const CASES: ShowcaseCase[] = [
  { name: 'Apple', category: '科技', score: 98, time: '1m 42s', tech: 'Next.js', gradient: 'from-[#1d1d1f] to-[#424245]', emoji: '🍎', desc: '极简主义设计标杆，精确还原导航栏、Hero区、产品网格' },
  { name: 'Tesla', category: '汽车', score: 96, time: '2m 05s', tech: 'React', gradient: 'from-[#171A20] to-[#3E6AE1]', emoji: '⚡', desc: '全屏沉浸式布局，视差滚动效果，暗色主题' },
  { name: 'Stripe', category: '金融', score: 95, time: '1m 58s', tech: 'Next.js', gradient: 'from-[#635BFF] to-[#00D4FF]', emoji: '💳', desc: '渐变网格背景，卡片系统，开发者友好UI' },
  { name: 'Linear', category: '工具', score: 94, time: '1m 35s', tech: 'React', gradient: 'from-[#5E6AD2] to-[#0E0E10]', emoji: '📋', desc: '暗色精密设计，微光效果，精确排版系统' },
  { name: 'Netflix', category: '娱乐', score: 93, time: '2m 12s', tech: 'Next.js', gradient: 'from-[#E50914] to-[#141414]', emoji: '🎬', desc: '深色主题，横向滚动卡片，Hero视频区' },
  { name: 'Notion', category: '工具', score: 92, time: '1m 48s', tech: 'React', gradient: 'from-[#000000] to-[#37352F]', emoji: '📝', desc: '极简文档风格，块级编辑器，浅色主题' },
];

const CATEGORIES = ['全部', '科技', '汽车', '金融', '工具', '娱乐'];

export default function Showcase() {
  const [filter, setFilter] = useState('全部');
  const filtered = filter === '全部' ? CASES : CASES.filter(c => c.category === filter);

  return (
    <section id="showcase-section" className="relative py-24 px-4">
      <div className="max-w-[1080px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-[36px] sm:text-[44px] font-semibold tracking-tight text-[#1d1d1f] mb-4">
            AI 生成案例
          </h2>
          <p className="text-[16px] text-black/35 max-w-[440px] mx-auto">
            每一个都从真实网站逆向生成，可运行、可编辑
          </p>
        </motion.div>

        {/* Category filter */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 ${
                filter === cat
                  ? 'bg-[#1d1d1f] text-white'
                  : 'text-black/35 hover:text-black/55 hover:bg-black/[0.03]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Case grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="group relative rounded-2xl border border-black/[0.06] bg-white/70 backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-black/[0.12] hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)]"
            >
              {/* Preview area */}
              <div className={`relative h-[180px] bg-gradient-to-br ${c.gradient} flex items-center justify-center`}>
                <span className="text-5xl opacity-60 group-hover:opacity-80 transition-opacity group-hover:scale-110 duration-500">{c.emoji}</span>

                {/* Score badge */}
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur-sm border border-white/10">
                  <span className="text-[11px] font-bold text-white">{c.score}%</span>
                </div>
              </div>

              {/* Info */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[15px] font-semibold text-[#1d1d1f]">{c.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/[0.04] text-black/30 font-medium">{c.category}</span>
                </div>
                <p className="text-[12px] text-black/35 leading-relaxed mb-4 line-clamp-2">{c.desc}</p>

                {/* Stats */}
                <div className="flex items-center gap-4 text-[11px] text-black/25">
                  <span className="flex items-center gap-1"><Star className="w-3 h-3" />还原度 {c.score}%</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.time}</span>
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{c.tech}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
