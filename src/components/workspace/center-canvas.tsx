'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Eye, Palette, Sparkles, GitBranch, Code2, ShieldCheck, Download, MonitorPlay, Monitor, Tablet, Smartphone, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAgentStore } from '@/store/agent-store';
import { cn } from '@/lib/utils';
import { DesignAnalysisContent } from '@/components/sections/design-analysis-section';
import { StyleMatchContent } from '@/components/sections/style-match-section';
import { DesignDecisionContent } from '@/components/sections/design-decision-section';
import { ComponentTreeContent } from '@/components/sections/component-tree-section';
import { CodeContent } from '@/components/sections/code-section';
import { QAContent } from '@/components/sections/qa-section';
import { DeployContent } from '@/components/sections/deploy-section';
import type { AgentId } from '@/types/agent';

interface TabDef {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  agentId: AgentId;
}

const TABS: TabDef[] = [
  { id: 'analysis', label: '设计分析', icon: Eye, color: '#AF52DE', agentId: 'vision' },
  { id: 'stylematcher', label: '设计体系', icon: Palette, color: '#FF6482', agentId: 'stylematcher' },
  { id: 'critic', label: '设计决策', icon: Sparkles, color: '#FFD60A', agentId: 'critic' },
  { id: 'components', label: '项目结构', icon: GitBranch, color: '#FF9500', agentId: 'planning' },
  { id: 'code', label: '代码生成', icon: Code2, color: '#34C759', agentId: 'code' },
  { id: 'preview', label: '实时预览', icon: MonitorPlay, color: '#30D158', agentId: 'preview' },
  { id: 'qa', label: '质量检测', icon: ShieldCheck, color: '#FF3B30', agentId: 'qa' },
  { id: 'deploy', label: '信息导出', icon: Download, color: '#0A84FF', agentId: 'deploy' },
];

export function CenterCanvas() {
  const agents = useAgentStore((s) => s.task.agents);
  const activeSection = useAgentStore((s) => s.activeSection);
  const setActiveSection = useAgentStore((s) => s.setActiveSection);
  const [activeTab, setActiveTab] = useState('analysis');

  // Sync from store (pipeline sidebar clicks) → local tab
  useEffect(() => {
    if (activeSection && activeSection !== 'home') {
      setActiveTab(activeSection);
    }
  }, [activeSection]);

  // Compute which tabs are available
  const availableTabs = useMemo(() => {
    return TABS.filter((tab) => {
      const agent = agents[tab.agentId];
      return agent.status === 'running' || agent.status === 'completed';
    });
  }, [agents]);

  // Auto-switch to latest available tab
  useEffect(() => {
    if (availableTabs.length > 0) {
      const latest = availableTabs[availableTabs.length - 1];
      // Only auto-switch if the current tab isn't available
      if (!availableTabs.find((t) => t.id === activeTab)) {
        setActiveTab(latest.id);
      }
    }
  }, [availableTabs, activeTab]);

  if (availableTabs.length === 0) {
    // Show a waiting state
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-black/[0.06] flex items-center justify-center mx-auto mb-4">
            <div className="w-6 h-6 rounded-full border-2 border-[#0071E3] border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-black/40">Agent 正在工作中...</p>
          <p className="text-xs text-black/20 mt-1">结果将在此处实时展示</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-0 border-b border-black/[0.06] bg-[#f9f9fb]/80 px-2 overflow-x-auto hide-scrollbar">
        {availableTabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setActiveSection(tab.id as any);
              }}
              className={cn(
                'relative flex items-center gap-2 px-4 py-3 text-[13px] font-medium whitespace-nowrap transition-colors duration-150',
                isActive ? 'text-[#1d1d1f]' : 'text-black/35 hover:text-black/55',
              )}
            >
              <Icon
                className="w-3.5 h-3.5"
                style={isActive ? { color: tab.color } : undefined}
              />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="center-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{ backgroundColor: tab.color }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="p-6"
        >
          {activeTab === 'analysis' && <DesignAnalysisContent />}
          {activeTab === 'stylematcher' && <StyleMatchContent />}
          {activeTab === 'critic' && <DesignDecisionContent />}
          {activeTab === 'components' && <ComponentTreeContent />}
          {activeTab === 'code' && <CodeContent />}
          {activeTab === 'qa' && <QAContent />}
          {activeTab === 'deploy' && <DeployContent />}
          {activeTab === 'preview' && <PreviewContent />}
        </motion.div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview Content — renders aiPreviewHtml in an iframe with device switcher
// ---------------------------------------------------------------------------

function PreviewContent() {
  const aiPreviewHtml = useAgentStore((s) => s.task.aiPreviewHtml);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const widthMap = { desktop: '100%', tablet: '768px', mobile: '375px' };

  if (!aiPreviewHtml) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#30D158]/10 flex items-center justify-center mx-auto mb-4">
            <MonitorPlay className="w-6 h-6 text-[#30D158]" />
          </div>
          <p className="text-sm text-black/40">AI 预览正在生成中...</p>
          <p className="text-xs text-black/20 mt-1">Preview Agent 完成后将在此显示高保真预览</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-black/[0.06] bg-[#f9f9fb]/80">
        <div className="flex items-center gap-1">
          {([
            { key: 'desktop' as const, icon: Monitor, label: '桌面' },
            { key: 'tablet' as const, icon: Tablet, label: '平板' },
            { key: 'mobile' as const, icon: Smartphone, label: '手机' },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setDevice(key)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                device === key ? 'bg-[#30D158]/10 text-[#30D158]' : 'text-black/35 hover:text-black/55 hover:bg-black/[0.03]'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            const blob = new Blob([aiPreviewHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#0071E3] hover:bg-[#0071E3]/8 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          新标签页打开
        </button>
      </div>

      {/* Iframe preview */}
      <div className="flex-1 flex justify-center bg-[#f0f0f0] p-4 overflow-auto">
        <div
          className="bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden transition-all duration-300"
          style={{ width: widthMap[device], maxWidth: '100%', height: '100%' }}
        >
          <iframe
            srcDoc={aiPreviewHtml}
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-full border-0"
            title="AI Preview"
          />
        </div>
      </div>
    </div>
  );
}
