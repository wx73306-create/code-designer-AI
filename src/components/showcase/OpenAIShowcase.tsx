'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// Data — 替换为真实案例内容
// =============================================================================

export interface ShowcaseItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  meta: string; // e.g. "产品 · 18 分钟阅读"
  media: {
    type: 'image' | 'video';
    src: string;
    poster?: string; // video poster
  };
  thumbnail: string; // right-side card thumbnail
}

const SHOWCASE_DATA: ShowcaseItem[] = [
  {
    id: 'kultura',
    title: 'KULTURA',
    subtitle: 'AI 重构印尼旅游沉浸式着陆页，航拍海岸线与热带风情视觉叙事',
    category: '旅游探索',
    meta: '96% 还原度 · 26 组件',
    media: { type: 'image', src: '/showcase/kultura.jpg' },
    thumbnail: '/showcase/kultura.jpg',
  },
  {
    id: 'nexusmind',
    title: 'NexusMind',
    subtitle: 'AI 重新构建人机协作统一工作区，暗色宇宙主题沉浸式体验',
    category: 'AI 协作平台',
    meta: '97% 还原度 · 47 组件',
    media: { type: 'image', src: '/showcase/nexusmind.jpg' },
    thumbnail: '/showcase/nexusmind.jpg',
  },
  {
    id: 'adventure',
    title: 'Adventure',
    subtitle: 'AI 重现自然山脉全景沉浸式着陆页，视差滚动体验',
    category: '旅游探索',
    meta: '96% 还原度 · 23 组件',
    media: { type: 'image', src: '/showcase/adventure.jpg' },
    thumbnail: '/showcase/adventure.jpg',
  },
  {
    id: 'dune',
    title: 'Netflix · Dune',
    subtitle: 'AI 重构流媒体电影详情页，角色视觉叙事与暗色 UI',
    category: '影视娱乐',
    meta: '95% 还原度 · 34 组件',
    media: { type: 'image', src: '/showcase/netflix-dune.jpg' },
    thumbnail: '/showcase/netflix-dune.jpg',
  },
  {
    id: 'joker',
    title: 'Joker',
    subtitle: 'AI 还原暗色电影风格高对比视觉冲击宣传页',
    category: '电影宣传',
    meta: '98% 还原度 · 18 组件',
    media: { type: 'image', src: '/showcase/joker.jpg' },
    thumbnail: '/showcase/joker.jpg',
  },
  {
    id: 'vsolar',
    title: 'V Solar',
    subtitle: 'AI 构建未来风太阳能科技景观着陆页',
    category: '新能源科技',
    meta: '94% 还原度 · 29 组件',
    media: { type: 'image', src: '/showcase/vsolar.jpg' },
    thumbnail: '/showcase/vsolar.jpg',
  },
];

// =============================================================================
// Component
// =============================================================================

export default function OpenAIShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = SHOWCASE_DATA[activeIndex];

  const handleSelect = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  return (
    <section className="relative bg-white">
      {/* Section header */}
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-[32px] sm:text-[40px] font-bold text-[#0d0d0d] tracking-tight"
        >
          AI Design Showcase
        </motion.h2>
      </div>

      {/* Main split layout */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

          {/* ── Left: Sticky featured area (65%) ── */}
          <div className="lg:w-[65%] shrink-0">
            <div className="lg:sticky lg:top-24">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  {/* Media area */}
                  <div className="relative rounded-2xl overflow-hidden bg-[#f5f5f5] aspect-[16/10]">
                    {active.media.type === 'video' ? (
                      <video src={active.media.src} poster={active.media.poster} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                    ) : (
                      <img src={active.media.src} alt={active.title} className="w-full h-full object-cover" loading="lazy" />
                    )}
                  </div>

                  {/* Title + subtitle */}
                  <div className="mt-6">
                    <h3 className="text-[24px] sm:text-[28px] font-bold text-[#0d0d0d] tracking-tight mb-2">{active.title}</h3>
                    <p className="text-[15px] text-[#666] leading-relaxed max-w-[520px] mb-3">{active.subtitle}</p>
                    <div className="flex items-center gap-2 text-[13px] text-[#999]">
                      <span className="px-2 py-0.5 rounded bg-[#f5f5f5] text-[#888] font-medium">{active.category}</span>
                      <span className="text-[#ddd]">·</span>
                      <span>{active.meta}</span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ── Right: Other cases (35%) — excludes active case ── */}
          <div className="lg:w-[35%]">
            <div className="flex flex-row lg:flex-col gap-4 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)] pr-1">
              {SHOWCASE_DATA.filter((_, i) => i !== activeIndex).map((item) => {
                const itemIndex = SHOWCASE_DATA.findIndex(d => d.id === item.id);
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: itemIndex * 0.06, duration: 0.4 }}
                    onClick={() => handleSelect(itemIndex)}
                    className="shrink-0 w-[260px] lg:w-full text-left rounded-xl overflow-hidden transition-all duration-300 cursor-pointer group border border-transparent hover:shadow-[0_2px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden bg-[#f0f0f0]">
                      <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
                    </div>
                    <div className="p-4 bg-white">
                      <h4 className="text-[14px] font-semibold mb-1.5 text-[#333]">{item.title}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-[#999]">
                        <span className="px-1.5 py-0.5 rounded bg-[#f5f5f5] text-[#888] font-medium">{item.category}</span>
                        <span>{item.meta}</span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
