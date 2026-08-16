'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Clock, Pause, Play, Minimize2, Check, Loader2, Circle,
  FileCode, Eye, BarChart3, Download, Layers, Sparkles, X, Home
} from 'lucide-react';
import { useAgentStore } from '@/store/agent-store';
import { buildPreviewHtml } from '@/lib/preview-utils';

// =============================================================================
// Types & Data
// =============================================================================

type NavTab = 'generating' | 'report' | 'components' | 'code' | 'preview' | 'export';

const NAV_TABS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'generating', label: '生成中', icon: Loader2 },
  { id: 'report', label: '设计报告', icon: BarChart3 },
  { id: 'components', label: '组件识别', icon: Layers },
  { id: 'code', label: '代码生成', icon: FileCode },
  { id: 'preview', label: '预览', icon: Eye },
  { id: 'export', label: '导出', icon: Download },
];

const WORKFLOW_STEPS = [
  { id: 'analyze', title: '分析网站', desc: '正在解析网页内容…' },
  { id: 'extract', title: '提取设计', desc: '识别设计系统…' },
  { id: 'generate', title: '生成代码', desc: '编写高质代码…' },
  { id: 'optimize', title: '优化完善', desc: '优化细节和性能…' },
];

const LOG_ENTRIES = [
  { message: '正在访问网站 https://www.apple.com', detail: '', status: 'completed' as const },
  { message: '提取页面结构', detail: '识别到 23 个主要区块', status: 'completed' as const },
  { message: '分析设计语言', detail: '检测到极简奢华风格', status: 'running' as const },
  { message: '识别组件系统', detail: '发现 18 个可复用组件', status: 'waiting' as const },
  { message: '提取色彩系统', detail: '分析主色调和辅助色', status: 'waiting' as const },
  { message: '分析排版系统', detail: '识别字体层级结构', status: 'waiting' as const },
  { message: '生成代码结构', detail: '规整文件和组件结构', status: 'waiting' as const },
];

const DESIGN_SCORES = [
  { label: '视觉还原度', score: 95 },
  { label: '布局结构', score: 96 },
  { label: '设计一致性', score: 94 },
  { label: '代码质量', score: 97 },
];

const CODE_LINES = [
  { num: 1, code: '<!DOCTYPE html>', type: 'tag' },
  { num: 2, code: '<html lang="zh-CN">', type: 'tag' },
  { num: 3, code: '<head>', type: 'tag' },
  { num: 4, code: '  <!-- AI 正在生成高质量代码 -->', type: 'comment' },
  { num: 5, code: '  <meta charset="UTF-8" />', type: 'tag' },
  { num: 6, code: '</head>', type: 'tag' },
  { num: 7, code: '<body>', type: 'tag' },
  { num: 8, code: '  <!-- 正在生成页面内容 -->', type: 'comment' },
  { num: 9, code: '  <header>', type: 'tag' },
  { num: 10, code: '    <!-- 导航栏组件 -->', type: 'comment' },
  { num: 11, code: '  </header>', type: 'tag' },
  { num: 12, code: '  <main>', type: 'tag' },
  { num: 13, code: '    <!-- Hero 区域 -->', type: 'comment' },
  { num: 14, code: '    <section class="hero">', type: 'tag' },
  { num: 15, code: '    </section>', type: 'tag' },
  { num: 16, code: '  </main>', type: 'tag' },
  { num: 17, code: '  <footer>', type: 'tag' },
  { num: 18, code: '    <!-- 页脚区域 -->', type: 'comment' },
  { num: 19, code: '  </footer>', type: 'tag' },
  { num: 20, code: '  <!-- 正在生成脚本 -->', type: 'comment' },
  { num: 21, code: '</body>', type: 'tag' },
  { num: 22, code: '</html>', type: 'tag' },
];

// =============================================================================
// Sub-components
// =============================================================================

function StepIcon({ status }: { status: 'waiting' | 'running' | 'completed' }) {
  if (status === 'completed') {
    return (
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}
        className="w-8 h-8 rounded-full bg-[#34C759] flex items-center justify-center shrink-0">
        <Check className="w-4 h-4 text-white" strokeWidth={3} />
      </motion.div>
    );
  }
  if (status === 'running') {
    return (
      <div className="relative w-8 h-8 shrink-0">
        <motion.div className="absolute inset-0 rounded-full bg-[#0071E3]/20"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }} />
        <div className="relative w-8 h-8 rounded-full bg-[#0071E3] flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        </div>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full border-2 border-black/[0.08] flex items-center justify-center shrink-0">
      <Circle className="w-2.5 h-2.5 text-black/12" />
    </div>
  );
}

function ScoreBar({ label, score, delay }: { label: string; score: number; delay: number }) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-black/40">{label}</span>
        <span className="text-[10px] font-semibold text-[#1d1d1f]">{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-black/[0.04] overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }}
          transition={{ duration: 1, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="h-full rounded-full bg-gradient-to-r from-[#0071E3] to-[#5856D6]" />
      </div>
    </div>
  );
}

function CodeLine({ line, delay }: { line: typeof CODE_LINES[0]; delay: number }) {
  const color = line.type === 'comment' ? 'text-[#6A9955]' : 'text-[#569CD6]';
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay }}
      className="flex text-[11px] leading-[1.6] font-mono">
      <span className="w-7 text-right mr-3 text-white/15 select-none shrink-0">{line.num}</span>
      <span className={color}>{line.code}</span>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function GenerationView() {
  const task = useAgentStore((s) => s.task);
  const resetTask = useAgentStore((s) => s.resetTask);
  const [activeTab, setActiveTab] = useState<NavTab>('generating');
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState(LOG_ENTRIES);
  const [visibleCodeLines, setVisibleCodeLines] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Timer
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [paused]);

  // Simulate log progression
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setLogs(prev => {
        const next = [...prev];
        const idx = next.findIndex(l => l.status === 'running');
        if (idx >= 0) {
          next[idx] = { ...next[idx], status: 'completed' };
          if (idx + 1 < next.length) next[idx + 1] = { ...next[idx + 1], status: 'running' };
        }
        return next;
      });
    }, 3500);
    return () => clearInterval(t);
  }, [paused]);

  // Simulate code line generation
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setVisibleCodeLines(prev => (prev < CODE_LINES.length ? prev + 1 : prev));
    }, 400);
    return () => clearInterval(t);
  }, [paused]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const previewHtml = useMemo(() => {
    if (!task.generatedCode || task.generatedCode.size === 0) return null;
    return buildPreviewHtml(task.generatedCode);
  }, [task.generatedCode]);

  const domain = useMemo(() => {
    try { return new URL(task.url || '').hostname.replace('www.', ''); } catch { return 'apple.com'; }
  }, [task.url]);

  const remaining = Math.max(0, 150 - elapsed);
  const completedLogs = logs.filter(l => l.status === 'completed').length;
  const overallProgress = Math.round((completedLogs / logs.length) * 100);

  return (
    <div className="h-screen flex flex-col bg-[#f5f5f7] overflow-hidden">
      {/* ── Top Bar ── */}
      <div className="h-11 shrink-0 flex items-center justify-between px-4 border-b border-black/[0.06] bg-white/90 backdrop-blur-xl z-30">
        <div className="flex items-center gap-3">
          <button onClick={resetTask} className="flex items-center gap-1.5 text-black/40 hover:text-black/60 transition-colors">
            <Home className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-black/[0.08]" />
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-[#0071E3]" />
            <span className="text-[12px] font-medium text-[#1d1d1f]">当前项目: {domain}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-gradient-to-r from-[#0071E3]/10 to-[#5856D6]/10 text-[#0071E3] border border-[#0071E3]/15">
            设计进化模式 · 80% 还原 · 20% 升级
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-black/35">
            <Clock className="w-3 h-3" />
            预计剩余 {Math.floor(remaining / 60)}分{remaining % 60}秒
          </div>
          <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-black/40 hover:text-black/60 hover:bg-black/[0.03] transition-colors">
            <Minimize2 className="w-3 h-3" /> 后台运行
          </button>
          <button onClick={() => setPaused(!paused)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
              paused ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#FF375F]/10 text-[#FF375F]'
            }`}>
            {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {paused ? '继续生成' : '暂停生成'}
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar */}
        <div className="w-[210px] shrink-0 border-r border-black/[0.06] bg-white/50 flex flex-col">
          <div className="p-3 space-y-0.5">
            {NAV_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 ${
                    isActive ? 'bg-[#0071E3]/[0.08] text-[#0071E3]' : 'text-black/40 hover:text-black/60 hover:bg-black/[0.02]'
                  }`}>
                  <Icon className={`w-3.5 h-3.5 ${tab.id === 'generating' && !paused ? 'animate-spin' : ''}`} />
                  {tab.label}
                  {tab.id === 'generating' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />}
                </button>
              );
            })}
          </div>

          {/* AI Design Score */}
          <div className="mt-auto p-4 border-t border-black/[0.04]">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#FF9500]" />
              <span className="text-[11px] font-medium text-black/50">AI 设计评分</span>
            </div>
            {DESIGN_SCORES.map((s, i) => <ScoreBar key={s.label} label={s.label} score={s.score} delay={0.2 + i * 0.15} />)}
            <div className="mt-3 pt-3 border-t border-black/[0.04] flex items-center justify-between">
              <span className="text-[10px] text-black/35">综合评分</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[18px] font-bold text-[#1d1d1f]">96</span>
                <span className="text-[9px] text-black/20">/100</span>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-[#34C759]/10 text-[#34C759]">优秀</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Workflow + Logs + Preview */}
        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto p-5">
          {/* Title */}
          <div className="mb-5">
            <h1 className="text-[20px] font-semibold text-[#1d1d1f] mb-1">AI 正在分析和生成您的项目</h1>
            <p className="text-[12px] text-black/35">智能解析网站结构，提取设计语言，生成高质量代码</p>
          </div>

          {/* 4-Step Workflow */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {WORKFLOW_STEPS.map((step, i) => {
              const status = i === 0 ? 'running' : 'waiting';
              const progress = i === 0 ? 85 : 0;
              return (
                <motion.div key={step.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className={`relative p-3.5 rounded-xl border transition-all duration-300 ${
                    status === 'running' ? 'bg-white border-[#0071E3]/20 shadow-[0_4px_20px_rgba(0,113,227,0.08)]'
                    : 'bg-white/50 border-black/[0.04]'
                  }`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <StepIcon status={status} />
                    <div>
                      <div className={`text-[12px] font-medium ${status === 'waiting' ? 'text-black/25' : 'text-[#1d1d1f]'}`}>{step.title}</div>
                      <div className="text-[9px] text-black/25">{status === 'running' ? `${progress}%` : '等待中'}</div>
                    </div>
                  </div>
                  {status === 'running' && (
                    <div className="h-1 rounded-full bg-black/[0.04] overflow-hidden">
                      <motion.div className="h-full rounded-full bg-[#0071E3]" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Two columns: Logs + Preview */}
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Real-time Logs */}
            <div className="flex flex-col rounded-xl border border-black/[0.06] bg-white/70 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-black/[0.04]">
                <span className="text-[11px] font-medium text-black/50">实时解析日志</span>
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-1.5">
                    {log.status === 'completed' ? <Check className="w-3.5 h-3.5 text-[#34C759] shrink-0 mt-0.5" />
                      : log.status === 'running' ? <Loader2 className="w-3.5 h-3.5 text-[#0071E3] animate-spin shrink-0 mt-0.5" />
                      : <Circle className="w-3 h-3 text-black/10 shrink-0 mt-1" />}
                    <div className="min-w-0">
                      <span className={`text-[11px] block ${
                        log.status === 'completed' ? 'text-black/50' : log.status === 'running' ? 'text-[#1d1d1f] font-medium' : 'text-black/25'
                      }`}>{log.message}</span>
                      {log.detail && log.status !== 'waiting' && (
                        <span className="text-[9px] text-black/25">{log.detail}</span>
                      )}
                    </div>
                    {log.status === 'running' && (
                      <span className="ml-auto shrink-0 text-[8px] px-1.5 py-0.5 rounded bg-[#0071E3]/[0.06] text-[#0071E3]">进行中</span>
                    )}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>

            {/* Live Preview */}
            <div className="flex flex-col rounded-xl border border-black/[0.06] bg-white/70 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-black/[0.04]">
                <Eye className="w-3.5 h-3.5 text-[#0071E3]" />
                <span className="text-[11px] font-medium text-black/50">实时预览</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/[0.03] text-black/25 ml-auto">
                  {previewHtml ? '已生成' : '分析中...'}
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                {previewHtml ? (
                  <iframe srcDoc={previewHtml} sandbox="allow-scripts allow-same-origin" className="w-full h-full border-0" title="Live Preview" />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-3">
                    {/* Skeleton loading */}
                    <div className="w-3/4 space-y-2">
                      <div className="h-3 bg-black/[0.04] rounded animate-pulse w-1/2" />
                      <div className="h-8 bg-black/[0.04] rounded animate-pulse" />
                      <div className="h-3 bg-black/[0.04] rounded animate-pulse w-2/3" />
                      <div className="h-16 bg-black/[0.04] rounded animate-pulse mt-3" />
                      <div className="h-3 bg-black/[0.04] rounded animate-pulse w-1/3 mt-3" />
                    </div>
                    <span className="text-[11px] text-black/20">正在生成预览...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Suggestion */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.5 }}
            className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-[#0071E3]/[0.03] to-[#5856D6]/[0.03] border border-[#0071E3]/[0.08]">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-[#0071E3] shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-[11px] font-medium text-[#1d1d1f] mb-0.5">AI 设计助手建议</div>
                <p className="text-[10px] text-black/40 leading-relaxed">
                  检测到这是一个科技产品官网，建议采用大图展示 + 简洁布局的设计策略，保持品牌高端感的同时优化移动端体验。
                </p>
              </div>
              <button className="shrink-0 text-[10px] text-[#0071E3] hover:underline">查看详情</button>
            </div>
          </motion.div>
        </div>

        {/* Right: Code Editor */}
        <div className="w-[300px] shrink-0 border-l border-black/[0.06] bg-[#1e1e1e] flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
            <FileCode className="w-3.5 h-3.5 text-[#0071E3]/60" />
            <span className="text-[11px] text-white/50 font-mono">index.html</span>
            <button className="ml-auto p-1 rounded text-white/20 hover:text-white/40 transition-colors"><X className="w-3 h-3" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {CODE_LINES.slice(0, visibleCodeLines).map((line, i) => (
              <CodeLine key={line.num} line={line} delay={i * 0.05} />
            ))}
            {visibleCodeLines < CODE_LINES.length && (
              <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}
                className="flex text-[11px] font-mono mt-0.5">
                <span className="w-7 text-right mr-3 text-white/15 select-none shrink-0">{visibleCodeLines + 1}</span>
                <span className="text-[#569CD6]">▊</span>
              </motion.div>
            )}
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5 text-[10px] text-white/25">
              <Loader2 className="w-3 h-3 animate-spin text-[#0071E3]" /> 正在生成...
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[#34C759]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
              已生成 {Math.max(visibleCodeLines * 15, 327)} 行代码
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
