'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Sparkles, Zap, Shield, ChevronDown, Camera, FolderArchive, ArrowDown } from 'lucide-react';

interface HeroProps {
  url: string;
  setUrl: (url: string) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  selectedMode: 'clone' | 'enhancement';
  setSelectedMode: (mode: 'clone' | 'enhancement') => void;
  selectedGoal: number | null;
  setSelectedGoal: (goal: number | null) => void;
  onSubmit: () => void;
  isRunning: boolean;
  genEnabled: boolean;
  isLoggedIn: boolean;
  onLoginClick: () => void;
  selectedProvider: string;
  setSelectedProvider: (p: string) => void;
  modelMenu: boolean;
  setModelMenu: (v: boolean) => void;
  quota: { used: number; limit: number; remaining: number; allowed: boolean } | null;
}

const PROVIDERS = [
  { id: 'mimo', label: 'MiMo-V2.5', desc: '深度推理' },
  { id: 'openai', label: 'GPT-4o', desc: '通用能力' },
  { id: 'anthropic', label: 'Claude', desc: '代码专精' },
  { id: 'google', label: 'Gemini', desc: '多模态' },
  { id: 'deepseek', label: 'DeepSeek', desc: '高性价比' },
];

const ease = [0.25, 0.46, 0.45, 0.94] as const;

export default function Hero(props: HeroProps) {
  const {
    url, setUrl, selectedMode, setSelectedMode,
    onSubmit, isRunning, genEnabled,
    isLoggedIn, onLoginClick, selectedProvider, setSelectedProvider,
    modelMenu, setModelMenu, quota,
  } = props;

  const [inputMode, setInputMode] = useState<'url' | 'screenshot' | 'zip'>('url');
  const screenshotRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const canSubmit = url.trim() && genEnabled && !isRunning && isLoggedIn;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-16 pb-20">
      {/* ── Ambient background ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[650px] rounded-full bg-gradient-to-br from-[#0071E3]/[0.04] via-[#5856D6]/[0.025] to-transparent blur-[140px]" />
        <div className="absolute bottom-[5%] left-[15%] w-[500px] h-[400px] rounded-full bg-[#AF52DE]/[0.02] blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[350px] rounded-full bg-[#FF375F]/[0.015] blur-[100px]" />
      </div>

      {/* ── Badge ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="relative mb-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <Sparkles className="w-3.5 h-3.5 text-[#0071E3]" />
          <span className="text-[12px] font-medium text-black/50">Code Designer AI</span>
        </div>
      </motion.div>

      {/* ── Main title — Apple-style responsive clamp ── */}
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease }}
        className="relative text-center font-bold tracking-[-0.04em] leading-[1.05] mb-4"
        style={{ fontSize: 'clamp(42px, 7vw, 96px)' }}
      >
        <span className="bg-gradient-to-r from-[#1d1d1f] via-[#1d1d1f] to-black/55 bg-clip-text text-transparent">
          让 AI 重新设计
        </span>
        <br />
        <span className="bg-gradient-to-r from-[#0071E3] via-[#5856D6] to-[#AF52DE] bg-clip-text text-transparent">
          任何网站
        </span>
      </motion.h1>

      {/* ── English slogan ── */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease }}
        className="relative text-center text-[15px] sm:text-[17px] text-black/25 font-medium tracking-wide mb-4 uppercase"
      >
        AI Reverse Engineering For Web Design
      </motion.p>

      {/* ── Description ── */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25, ease }}
        className="relative text-center text-[16px] sm:text-[18px] text-black/40 max-w-[500px] mb-10 leading-relaxed"
      >
        上传一个网页链接，AI 自动分析视觉系统、生成设计方案，并输出完整可运行项目。
      </motion.p>

      {/* ── Core Input Area ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35, ease }}
        className="relative w-full max-w-[640px] mb-4"
      >
        {/* Input mode tabs */}
        <div className="flex items-center gap-1 mb-2.5 px-1">
          {([
            { id: 'url' as const, icon: Globe, label: 'URL' },
            { id: 'screenshot' as const, icon: Camera, label: '截图' },
            { id: 'zip' as const, icon: FolderArchive, label: 'ZIP 包' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setInputMode(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                inputMode === tab.id
                  ? 'bg-[#1d1d1f] text-white'
                  : 'text-black/30 hover:text-black/50 hover:bg-black/[0.03]'
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Input container */}
        <div className="group relative flex items-center bg-white/80 backdrop-blur-2xl rounded-2xl border border-black/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all duration-300 focus-within:border-[#0071E3]/30 focus-within:shadow-[0_8px_40px_rgba(0,113,227,0.08)]">
          {/* Left icon */}
          <div className="ml-5 shrink-0">
            {inputMode === 'url' && <Globe className="w-4 h-4 text-black/25" />}
            {inputMode === 'screenshot' && <Camera className="w-4 h-4 text-black/25" />}
            {inputMode === 'zip' && <FolderArchive className="w-4 h-4 text-black/25" />}
          </div>

          {/* URL input */}
          {inputMode === 'url' && (
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canSubmit && onSubmit()}
              placeholder="粘贴任意网站 URL（如：https://apple.com）"
              className="flex-1 bg-transparent px-3 py-4 text-[15px] text-[#1d1d1f] placeholder:text-black/25 outline-none"
            />
          )}

          {/* Screenshot upload */}
          {inputMode === 'screenshot' && (
            <button
              onClick={() => screenshotRef.current?.click()}
              className="flex-1 text-left px-3 py-4 text-[14px] text-black/35 hover:text-black/50 transition-colors"
            >
              {url || '📷 点击上传网站截图（PNG / JPG）'}
              <input ref={screenshotRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) setUrl(`screenshot:${file.name}`);
              }} />
            </button>
          )}

          {/* ZIP upload */}
          {inputMode === 'zip' && (
            <button
              onClick={() => zipRef.current?.click()}
              className="flex-1 text-left px-3 py-4 text-[14px] text-black/35 hover:text-black/50 transition-colors"
            >
              {url || '📦 点击上传项目 ZIP 包（最大 100MB）'}
              <input ref={zipRef} type="file" accept=".zip" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) setUrl(`zip:${file.name}`);
              }} />
            </button>
          )}

          {/* Model selector */}
          <div className="relative shrink-0 mr-2">
            <button
              onClick={() => setModelMenu(!modelMenu)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium text-black/35 hover:text-black/55 hover:bg-black/[0.03] transition-colors"
            >
              <Zap className="w-3 h-3" />
              {PROVIDERS.find(p => p.id === selectedProvider)?.label || 'MiMo-V2.5'}
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${modelMenu ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {modelMenu && (
                <>
                  {/* Backdrop to close on outside click */}
                  <div className="fixed inset-0 z-40" onClick={() => setModelMenu(false)} />
                  {/* Dropdown — opens upward */}
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 bottom-full mb-2 w-52 bg-white/98 backdrop-blur-2xl rounded-xl border border-black/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.15)] overflow-hidden z-50"
                  >
                    {PROVIDERS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProvider(p.id); setModelMenu(false); }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                          selectedProvider === p.id ? 'bg-[#0071E3]/[0.06] text-[#0071E3]' : 'text-black/55 hover:bg-black/[0.03]'
                        }`}
                      >
                        <span className="text-[13px] font-medium">{p.label}</span>
                        <span className="text-[10px] text-black/25">{p.desc}</span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* CTA button — black pill */}
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className={`shrink-0 mr-3 px-7 py-3 rounded-full text-[14px] font-semibold transition-all duration-300 ${
              canSubmit
                ? 'bg-[#1d1d1f] text-white shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-black hover:shadow-[0_6px_28px_rgba(0,0,0,0.3)] active:scale-[0.97]'
                : 'bg-black/[0.06] text-black/20 cursor-not-allowed'
            }`}
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <motion.div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                分析中...
              </span>
            ) : !isLoggedIn ? (
              <span onClick={onLoginClick} className="cursor-pointer">登录开始</span>
            ) : (
              '开始 AI 分析'
            )}
          </button>
        </div>

        {/* Quota indicator */}
        {isLoggedIn && quota && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-[11px] text-black/20">
              今日配额：{quota.remaining} / {quota.limit}
            </span>
            {!quota.allowed && (
              <span className="text-[11px] text-[#FF3B30] font-medium">配额已用尽</span>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Design Mode + Secondary CTA ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45, ease }}
        className="relative flex flex-wrap items-center justify-center gap-3 mb-6"
      >
        <button
          onClick={() => setSelectedMode('clone')}
          className={`px-4 py-2 rounded-xl text-[12px] font-medium transition-all duration-200 border ${
            selectedMode === 'clone'
              ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
              : 'bg-white/50 text-black/40 border-black/[0.05] hover:border-black/[0.1]'
          }`}
        >
          <Shield className="w-3 h-3 inline mr-1 -mt-0.5" />
          精准复刻
        </button>
        <button
          onClick={() => setSelectedMode('enhancement')}
          className={`px-4 py-2 rounded-xl text-[12px] font-medium transition-all duration-200 border ${
            selectedMode === 'enhancement'
              ? 'bg-gradient-to-r from-[#0071E3] to-[#5856D6] text-white border-transparent'
              : 'bg-white/50 text-black/40 border-black/[0.05] hover:border-black/[0.1]'
          }`}
        >
          <Sparkles className="w-3 h-3 inline mr-1 -mt-0.5" />
          设计升级
        </button>

        <div className="w-px h-5 bg-black/[0.08]" />

        <button
          onClick={() => scrollTo('showcase-section')}
          className="px-4 py-2 rounded-xl text-[12px] font-medium text-black/35 hover:text-black/55 transition-colors"
        >
          查看案例
          <ArrowDown className="w-3 h-3 inline ml-1 -mt-0.5" />
        </button>
      </motion.div>

      {/* ── Scroll hint ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-1"
        >
          <span className="text-[10px] text-black/15">向下滚动探索</span>
          <ChevronDown className="w-3.5 h-3.5 text-black/12" />
        </motion.div>
      </motion.div>
    </section>
  );
}
