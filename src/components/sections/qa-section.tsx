"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Eye,
  Monitor,
  Zap,
  Search,
  Accessibility,
  FileCode,
  Image,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  Crown,
  Camera,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import { mockQAIssues, mockQAFixes, mockGeneratedCode, mockVisualScore } from "@/lib/mock-data";
import { useAgentStore } from "@/store/agent-store";
import { buildPreviewHtml } from "@/lib/preview-utils";
import { DIMENSION_LABELS } from "@/lib/visual-evaluation";
import type { VisualScoreDimensions } from "@/types/agent";

// =============================================================================
// Types
// =============================================================================

interface DetectionMetric {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  percentage: number;
  status: 'pass' | 'fail' | 'in-progress';
}

const statusIcons = {
  pass: CheckCircle2,
  fail: XCircle,
  "in-progress": Loader2,
};

// =============================================================================
// QA Content (workspace tab) — fully dynamic, reads from store
// =============================================================================

export function QAContent() {
  const qaResult = useAgentStore((s) => s.task.qaResult);
  const taskUrl = useAgentStore((s) => s.task.url);
  const generatedCode = useAgentStore((s) => s.task.generatedCode);
  const [iframeError, setIframeError] = useState(false);

  // --- Data from store (with mock fallback) ---
  const similarity = qaResult?.similarity ?? 96.8;
  const issues = qaResult?.issues ?? mockQAIssues;
  const fixes = qaResult?.fixes ?? mockQAFixes;
  const fixedCount = fixes.filter((f) => f.applied).length;
  const totalIssues = issues.length;
  const fixedIssues = issues.filter((i) => i.fixed).length;
  const isAI = !!qaResult;
  const visualScore = qaResult?.visualScore ?? mockVisualScore;
  const optimizationRounds = qaResult?.optimizationRounds ?? 0;

  // --- Build preview HTML for the generated code panel ---
  const codeMap = generatedCode ?? mockGeneratedCode;
  const previewHtml = useMemo(() => buildPreviewHtml(codeMap), [codeMap]);

  // --- Build detection metrics from store data ---
  const detectionMetrics: DetectionMetric[] = useMemo(() => {
    const metrics = qaResult?.metrics;
    const accScore = qaResult?.accessibilityScore;
    const perfScore = qaResult?.performanceScore;

    if (isAI && (metrics || accScore !== undefined || perfScore !== undefined)) {
      // Use AI-derived scores where available
      return [
        {
          name: "视觉对比",
          icon: Eye,
          percentage: metrics?.visual ?? similarity,
          status: (metrics?.visual ?? similarity) >= 90 ? 'pass' : 'fail',
        },
        {
          name: "响应式布局",
          icon: Monitor,
          percentage: metrics?.responsive ?? Math.max(similarity - 3, 85),
          status: (metrics?.responsive ?? similarity - 3) >= 90 ? 'pass' : 'fail',
        },
        {
          name: "性能优化",
          icon: Zap,
          percentage: perfScore ?? 95,
          status: (perfScore ?? 95) >= 90 ? 'pass' : 'fail',
        },
        {
          name: "SEO 检查",
          icon: Search,
          percentage: metrics?.seo ?? 98,
          status: (metrics?.seo ?? 98) >= 90 ? 'pass' : 'fail',
        },
        {
          name: "可访问性",
          icon: Accessibility,
          percentage: accScore ?? 91,
          status: (accScore ?? 91) >= 90 ? 'pass' : 'fail',
        },
        {
          name: "代码规范",
          icon: FileCode,
          percentage: metrics?.code ?? 97,
          status: (metrics?.code ?? 97) >= 90 ? 'pass' : 'fail',
        },
        {
          name: "图片优化",
          icon: Image,
          percentage: metrics?.image ?? 96,
          status: (metrics?.image ?? 96) >= 90 ? 'pass' : 'fail',
        },
      ];
    }

    // Mock fallback scores
    return [
      { name: "视觉对比", icon: Eye, percentage: 96.8, status: 'pass' },
      { name: "响应式布局", icon: Monitor, percentage: 94.2, status: 'pass' },
      { name: "性能优化", icon: Zap, percentage: 98.1, status: 'pass' },
      { name: "SEO 检查", icon: Search, percentage: 100, status: 'pass' },
      { name: "可访问性", icon: Accessibility, percentage: 91.5, status: 'pass' },
      { name: "代码规范", icon: FileCode, percentage: 99.3, status: 'pass' },
      { name: "图片优化", icon: Image, percentage: 97.6, status: 'pass' },
    ];
  }, [qaResult, similarity, isAI]);

  // --- Extract hostname for display ---
  const hostname = useMemo(() => {
    try { return new URL(taskUrl).hostname; } catch { return taskUrl || 'website'; }
  }, [taskUrl]);

  return (
    <div className="space-y-6">
      {/* ─── Side-by-side comparison: real iframes ─── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
        {/* Left: Original website */}
        <div className="rounded-xl border border-black/[0.06] bg-white/75 backdrop-blur-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-black/[0.06] bg-black/[0.02] flex items-center justify-between">
            <span className="text-xs font-medium text-black/50">原网页</span>
            <a href={taskUrl} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-[#0071E3] hover:underline flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              {hostname}
            </a>
          </div>
          <div className="relative h-[260px] bg-[#f5f5f7]">
            {taskUrl && !iframeError ? (
              <iframe
                src={taskUrl}
                className="w-full h-full border-0"
                style={{ transform: 'scale(0.45)', transformOrigin: '0 0', width: '222%', height: '222%' }}
                sandbox="allow-scripts allow-same-origin"
                title="Original website"
                onError={() => setIframeError(true)}
                onLoad={(e) => {
                  setTimeout(() => {
                    try {
                      const doc = e.currentTarget.contentDocument;
                      if (!doc || !doc.body || doc.body.children.length === 0) setIframeError(true);
                    } catch { /* cross-origin */ }
                  }, 5000);
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-black/30">
                <AlertTriangle className="w-8 h-8 text-black/15" />
                <span className="text-xs">该网站禁止 iframe 嵌入</span>
                <a href={taskUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-[#0071E3] hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />在新窗口中查看
                </a>
              </div>
            )}
          </div>
        </div>

        {/* VS badge */}
        <div className="w-12 h-12 rounded-full bg-[#f0f0f2] border-2 border-black/[0.15] flex items-center justify-center text-sm font-bold text-black/70">
          VS
        </div>

        {/* Right: Generated preview */}
        <div className="rounded-xl border border-black/[0.06] bg-white/75 backdrop-blur-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-black/[0.06] bg-black/[0.02] flex items-center justify-between">
            <span className="text-xs font-medium text-black/50">生成预览</span>
            {isAI && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20 font-medium">
                AI 生成
              </span>
            )}
          </div>
          <div className="relative h-[260px] bg-[#f5f5f7]">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full border-0"
              sandbox="allow-scripts"
              title="Generated preview"
            />
            {/* Overlay check if similarity is high */}
            {similarity >= 90 && (
              <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#34C759]/90 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Visual Score: overall + premium emphasis ─── */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4">
        {/* Overall visual score */}
        <div className="rounded-xl border border-black/[0.06] bg-white/75 backdrop-blur-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#AF52DE]" />
              <span className="text-sm font-medium text-black/70">综合视觉评分</span>
              {optimizationRounds > 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#FF9500]/10 text-[#FF9500] border border-[#FF9500]/20 font-medium">
                  已优化 {optimizationRounds} 轮
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-3xl font-extrabold tabular-nums",
                visualScore.overall_score >= 90 ? "text-[#34C759]" : visualScore.overall_score >= 75 ? "text-[#FF9500]" : "text-[#FF3B30]"
              )}>
                {visualScore.overall_score}
              </span>
              <span className="text-lg font-semibold text-black/30">/100</span>
            </div>
          </div>
          <div className="h-3 rounded-full bg-black/[0.06] overflow-hidden">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${visualScore.overall_score}%` }}
              transition={{ delay: 0.3, duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={cn(
                "h-full rounded-full",
                visualScore.overall_score >= 90 ? "bg-gradient-to-r from-[#34C759] to-[#30D158] shadow-[0_0_24px_rgba(52,199,89,0.5)]" :
                visualScore.overall_score >= 75 ? "bg-gradient-to-r from-[#FF9500] to-[#FFB340] shadow-[0_0_24px_rgba(255,149,0,0.5)]" :
                "bg-gradient-to-r from-[#FF3B30] to-[#FF6961] shadow-[0_0_24px_rgba(255,59,48,0.5)]"
              )}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-black/30">
            <span>检测到 {visualScore.problems.length} 个视觉问题 · 通过阈值 90</span>
            {isAI ? <span className="text-[#34C759] font-medium">AI 视觉评审</span> : <span>启发式评分</span>}
          </div>
        </div>

        {/* Premium score emphasis ⭐ */}
        <div className={cn(
          "rounded-xl border p-5 relative overflow-hidden",
          visualScore.scores.premium_score >= 80
            ? "border-[#34C759]/25 bg-gradient-to-br from-[#34C759]/[0.07] to-white/75"
            : "border-[#FF9500]/25 bg-gradient-to-br from-[#FF9500]/[0.07] to-white/75"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Crown className={cn("w-4 h-4", visualScore.scores.premium_score >= 80 ? "text-[#34C759]" : "text-[#FF9500]")} />
            <span className="text-sm font-medium text-black/70">高级感评分</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/[0.05] text-black/40 font-medium">权重 20% ⭐</span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className={cn(
                "text-4xl font-extrabold tabular-nums",
                visualScore.scores.premium_score >= 80 ? "text-[#34C759]" : "text-[#FF9500]"
              )}
            >
              {visualScore.scores.premium_score}
            </motion.span>
            <span className="text-lg font-semibold text-black/30">/100</span>
          </div>
          <p className="text-[11px] text-black/40 leading-relaxed">
            {visualScore.scores.premium_score >= 80
              ? "达到 Apple / Linear / Stripe 级别的设计水准"
              : "存在模板感，将触发自动优化闭环"}
          </p>
        </div>
      </div>

      {/* ─── Six-dimension visual scores ─── */}
      <div className="rounded-xl border border-black/[0.06] bg-white/75 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="w-4 h-4 text-[#0071E3]" />
          <h3 className="text-sm font-medium text-black/80">六维视觉评分</h3>
          <span className="text-[11px] text-black/30 ml-auto">Visual Evaluation Agent</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
          {(Object.entries(visualScore.scores) as Array<[keyof VisualScoreDimensions, number]>).map(([dim, value]) => {
            const isPremium = dim === 'premium_score';
            const color = value >= 90 ? '#34C759' : value >= 75 ? '#FF9500' : '#FF3B30';
            return (
              <div key={dim} className="flex items-center gap-3">
                <span className={cn("text-xs w-16 shrink-0", isPremium ? "font-semibold text-black/70" : "text-black/50")}>
                  {DIMENSION_LABELS[dim]}{isPremium && '⭐'}
                </span>
                <div className="flex-1 h-2 rounded-full bg-black/[0.05] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color }}>{value}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Visual problems ─── */}
      {visualScore.problems.length > 0 && (
        <div className="rounded-xl border border-black/[0.06] bg-white/75 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-[#FF9500]" />
            <h3 className="text-sm font-medium text-black/80">视觉问题诊断</h3>
            <span className="text-[11px] text-black/30 font-mono ml-auto">{visualScore.problems.length} 项</span>
          </div>
          <div className="space-y-0">
            {visualScore.problems.map((prob, idx) => (
              <div key={prob.description + idx} className="flex items-start gap-3 py-2.5 border-b border-black/[0.04] last:border-0 px-2 rounded-lg hover:bg-black/[0.02] transition-colors">
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 border",
                  prob.type === 'premium' ? "bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/20" : "bg-black/[0.04] text-black/45 border-black/[0.08]"
                )}>
                  {DIMENSION_LABELS[`${prob.type}_score` as keyof VisualScoreDimensions] || prob.type}
                </span>
                <p className="text-[12px] text-black/60 leading-relaxed flex-1">{prob.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Repair log ─── */}
      <div className="rounded-xl border border-black/[0.06] bg-white/75 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-[#34C759]" />
          <h3 className="text-sm font-medium text-black/80">自动修复日志</h3>
          <span className="text-[11px] text-black/30 font-mono ml-auto">{fixedCount} / {fixes.length} 已修复</span>
        </div>
        {fixes.length > 0 ? (
          <div className="space-y-0">
            {fixes.map((fix, idx) => (
              <div key={fix.issue + idx} className="flex items-start gap-3 py-2.5 border-b border-black/[0.04] last:border-0 px-2 rounded-lg hover:bg-black/[0.02] transition-colors">
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5', fix.applied ? 'bg-[#34C759]/15' : 'bg-black/[0.04]')}>
                  {fix.applied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#34C759]" /> : <ArrowRight className="w-3 h-3 text-black/30" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-black/80">{fix.issue}</span>
                    {fix.applied && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20">已修复</span>}
                  </div>
                  <p className="text-[11px] text-black/40 mt-0.5">{fix.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-black/30 text-xs">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#34C759]/40" />
            未检测到需要修复的问题
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// QA Section (homepage scroll section) — keeps the original visual design
// =============================================================================

export function QASection() {
  const qaResult = useAgentStore((s) => s.task.qaResult);
  const taskUrl = useAgentStore((s) => s.task.url);
  const generatedCode = useAgentStore((s) => s.task.generatedCode);
  const [iframeError, setIframeError] = useState(false);

  const similarity = qaResult?.similarity ?? 96.8;
  const issues = qaResult?.issues ?? mockQAIssues;
  const fixes = qaResult?.fixes ?? mockQAFixes;
  const fixedIssues = issues.filter((i) => i.fixed).length;
  const codeMap = generatedCode ?? mockGeneratedCode;
  const previewHtml = useMemo(() => buildPreviewHtml(codeMap), [codeMap]);

  const hostname = useMemo(() => {
    try { return new URL(taskUrl).hostname; } catch { return 'website'; }
  }, [taskUrl]);

  return (
    <motion.section
      id="qa"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full py-24 px-4"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF3B30]/10 border border-[#FF3B30]/20 mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FF3B30]" />
            <span className="text-xs font-medium text-[#FF3B30]">QA Agent</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight bg-gradient-to-r from-[#1d1d1f] to-black/70 bg-clip-text text-transparent">
            {"自动修复与优化"}
          </h2>
          <p className="mt-3 text-base text-black/50 max-w-xl mx-auto">
            {"AI 自动对比原始网站与生成结果，检测差异并自动修复以达到最高还原度"}
          </p>
        </motion.div>

        {/* ─── Top: Side-by-side comparison ─── */}
        <div className="relative mb-10">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
            {/* Original */}
            <GlassCard className="overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.2)]" animate delay={0.15}>
              <div className="px-4 py-2.5 border-b border-black/[0.06] bg-black/[0.02] flex items-center justify-between">
                <span className="text-xs font-medium text-black/50">{"原网页"}</span>
                {taskUrl && (
                  <a href={taskUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-[#0071E3] hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />{hostname}
                  </a>
                )}
              </div>
              <div className="relative h-[280px] bg-[#f5f5f7]">
                {taskUrl && !iframeError ? (
                  <>
                    <iframe
                      src={taskUrl}
                      className="w-full h-full border-0"
                      style={{ transform: 'scale(0.42)', transformOrigin: '0 0', width: '238%', height: '238%' }}
                      sandbox="allow-scripts allow-same-origin"
                      title="Original website"
                      onError={() => setIframeError(true)}
                      onLoad={(e) => {
                        // Detect X-Frame-Options blocking: if iframe loaded but has no content
                        try {
                          const iframe = e.currentTarget;
                          if (iframe.contentDocument?.body?.innerHTML === '') {
                            setIframeError(true);
                          }
                        } catch { /* cross-origin, can't check */ }
                        // Also set timeout fallback
                        setTimeout(() => {
                          try {
                            const doc = e.currentTarget.contentDocument;
                            if (!doc || !doc.body || doc.body.children.length === 0) {
                              setIframeError(true);
                            }
                          } catch { /* cross-origin */ }
                        }, 5000);
                      }}
                    />
                  </>
                ) : taskUrl ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-black/30">
                    <AlertTriangle className="w-8 h-8 text-black/15" />
                    <span className="text-xs">该网站禁止 iframe 嵌入</span>
                    <a href={taskUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#0071E3] hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />在新窗口中查看原网站
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-black/20 text-xs">
                    未指定目标网站
                  </div>
                )}
              </div>
            </GlassCard>

            {/* VS badge */}
            <div className="flex items-center justify-center">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 15 }}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center",
                  "bg-[#f0f0f2] border-2 border-black/[0.15]",
                  "text-base font-bold text-black/70",
                )}
              >
                VS
              </motion.div>
            </div>

            {/* Generated */}
            <GlassCard className="overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.2)]" animate delay={0.25}>
              <div className="px-4 py-2.5 border-b border-black/[0.06] bg-black/[0.02] flex items-center justify-between">
                <span className="text-xs font-medium text-black/50">{"生成预览"}</span>
                {qaResult && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20 font-medium">AI 生成</span>
                )}
              </div>
              <div className="relative h-[280px] bg-[#f5f5f7]">
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                  title="Generated preview"
                />
                {similarity >= 90 && (
                  <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-[#34C759]/90 flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Similarity bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-6"
          >
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-black/70">{"视觉还原度"}</span>
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    "text-4xl font-extrabold tabular-nums",
                    similarity >= 95 ? "text-[#34C759]" : similarity >= 80 ? "text-[#FF9500]" : "text-[#FF3B30]"
                  )}>
                    {similarity}
                  </span>
                  <span className={cn(
                    "text-xl font-semibold",
                    similarity >= 95 ? "text-[#34C759]/60" : similarity >= 80 ? "text-[#FF9500]/60" : "text-[#FF3B30]/60"
                  )}>%</span>
                </div>
              </div>
              <div className="h-4 rounded-full bg-black/[0.06] overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: `${similarity}%` }}
                  transition={{ delay: 0.6, duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className={cn(
                    "h-full rounded-full",
                    similarity >= 95 ? "bg-gradient-to-r from-[#34C759] to-[#30D158] shadow-[0_0_24px_rgba(52,199,89,0.5)]" :
                    similarity >= 80 ? "bg-gradient-to-r from-[#FF9500] to-[#FFB340] shadow-[0_0_24px_rgba(255,149,0,0.5)]" :
                    "bg-gradient-to-r from-[#FF3B30] to-[#FF6961] shadow-[0_0_24px_rgba(255,59,48,0.5)]"
                  )}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] text-black/30">
                <span>{"已检测"} {issues.length} {"个问题，修复"} {fixedIssues} {"个"}</span>
                {qaResult ? <span className="text-[#34C759] font-medium">AI 分析结果</span> : <span>{"阈值: 95%"}</span>}
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* ─── Repair log timeline ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <GlassCard className="p-5" animate delay={0.85}>
            <div className="flex items-center gap-2 mb-5">
              <ShieldCheck className="w-4 h-4 text-[#34C759]" />
              <h3 className="text-sm font-medium text-black/80">{"自动修复日志"}</h3>
              <span className="text-[11px] text-black/30 font-mono ml-auto">
                {fixes.filter(f => f.applied).length} / {fixes.length} {"已修复"}
              </span>
            </div>
            <div className="space-y-0">
              {fixes.map((fix, idx) => (
                <motion.div
                  key={fix.issue + idx}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + idx * 0.08, duration: 0.3 }}
                  className="flex items-start gap-3 py-3 border-b border-black/[0.04] last:border-0 rounded-lg hover:bg-black/[0.02] transition-colors duration-200 px-2"
                >
                  <div className="relative flex flex-col items-center pt-0.5">
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", fix.applied ? "bg-[#34C759]/15" : "bg-black/[0.04]")}>
                      {fix.applied ? <CheckCircle2 className="w-4 h-4 text-[#34C759]" /> : <ArrowRight className="w-3.5 h-3.5 text-black/30" />}
                    </div>
                    {idx < fixes.length - 1 && (
                      <div className="w-[2px] h-full min-h-[8px] bg-black/[0.08] absolute top-7" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-medium text-black/80">{fix.issue}</span>
                      {fix.applied && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20">{"已修复"}</span>
                      )}
                    </div>
                    <p className="text-[12px] text-black/40 leading-relaxed">{fix.description}</p>
                  </div>
                  <span className="text-[10px] text-black/20 font-mono shrink-0 mt-1">T+{(idx * 0.6 + 1).toFixed(1)}s</span>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </motion.section>
  );
}
