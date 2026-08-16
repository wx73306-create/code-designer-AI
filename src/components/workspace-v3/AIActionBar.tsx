'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand2, Layout, Smartphone, Star, Send, Loader2, Check } from 'lucide-react';
import { useAgentStore } from '@/store/agent-store';

interface AIAction {
  id: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  prompt: string;
  color: string;
}

const ACTIONS: AIAction[] = [
  { id: 'visual', icon: Wand2, title: '优化视觉', prompt: 'Improve visual hierarchy, spacing and typography across all components', color: '#0071E3' },
  { id: 'hero', icon: Layout, title: '重设计 Hero', prompt: 'Redesign hero section with more premium layout and better visual impact', color: '#5856D6' },
  { id: 'premium', icon: Star, title: '提升高级感', prompt: 'Apply premium design principles: better shadows, gradients, micro-interactions', color: '#AF52DE' },
  { id: 'mobile', icon: Smartphone, title: '移动端适配', prompt: 'Optimize responsive experience for mobile devices with better touch targets', color: '#FF9500' },
];

export default function AIActionBar() {
  const [customPrompt, setCustomPrompt] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const task = useAgentStore((s) => s.task);

  const handleAction = async (action: AIAction) => {
    if (running) return;
    setRunning(action.id);
    setCompleted(prev => { const next = new Set(prev); next.delete(action.id); return next; });

    try {
      const files = task.generatedCode ? [...task.generatedCode.entries()] : [];
      if (files.length === 0) {
        setRunning(null);
        return;
      }

      const res = await fetch('/api/ai-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action.id, files, url: task.url }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      if (data.success && data.files && data.files.length > 0) {
        // Apply updated files to the store
        for (const [filename, code] of data.files) {
          if (task.generatedCode?.has(filename)) {
            task.generatedCode.set(filename, code);
          }
        }
        // Trigger re-render by updating the store
        useAgentStore.setState({ task: { ...task } });
      }

      setCompleted(prev => new Set(prev).add(action.id));
      setTimeout(() => {
        setCompleted(prev => { const next = new Set(prev); next.delete(action.id); return next; });
      }, 3000);
    } catch (err) {
      console.error('[AIActionBar] Action failed:', err);
    } finally {
      setRunning(null);
    }
  };

  const handleCustomSubmit = async () => {
    if (!customPrompt.trim() || running) return;
    setRunning('custom');

    try {
      const files = task.generatedCode ? [...task.generatedCode.entries()] : [];
      if (files.length === 0) {
        setRunning(null);
        return;
      }

      const res = await fetch('/api/ai-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'custom', prompt: customPrompt, files, url: task.url }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      if (data.success && data.files && data.files.length > 0) {
        for (const [filename, code] of data.files) {
          if (task.generatedCode?.has(filename)) {
            task.generatedCode.set(filename, code);
          }
        }
        useAgentStore.setState({ task: { ...task } });
      }

      setCustomPrompt('');
    } catch (err) {
      console.error('[AIActionBar] Custom action failed:', err);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="shrink-0 border-t border-black/[0.06] bg-white/90 backdrop-blur-xl px-4 py-3">
      {/* AI action buttons */}
      <div className="flex items-center gap-2 mb-2.5 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1.5 shrink-0 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-[#0071E3]" />
          <span className="text-[11px] font-medium text-black/40">AI Design</span>
        </div>

        {ACTIONS.map(action => {
          const Icon = action.icon;
          const isRunning = running === action.id;
          const isDone = completed.has(action.id);
          return (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={!!running}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-200 ${
                isDone
                  ? 'bg-[#34C759]/[0.06] text-[#34C759] border-[#34C759]/15'
                  : isRunning
                  ? 'bg-black/[0.03] text-black/30 border-black/[0.06]'
                  : 'bg-white text-black/45 border-black/[0.06] hover:border-black/[0.12] hover:text-black/60 hover:bg-black/[0.02]'
              } ${running && !isRunning ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {isRunning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isDone ? (
                <Check className="w-3 h-3" />
              ) : (
                <Icon className="w-3 h-3" style={{ color: action.color }} />
              )}
              {action.title}
            </button>
          );
        })}
      </div>

      {/* Custom prompt input */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center bg-black/[0.03] rounded-xl border border-black/[0.06] px-3 py-2 focus-within:border-[#0071E3]/30 transition-colors">
          <Sparkles className="w-3.5 h-3.5 text-black/20 shrink-0 mr-2" />
          <input
            type="text"
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
            placeholder="描述你想要的设计修改...（如：把导航栏改成暗色）"
            className="flex-1 bg-transparent text-[12px] text-[#1d1d1f] placeholder:text-black/25 outline-none"
          />
        </div>
        <button
          onClick={handleCustomSubmit}
          disabled={!customPrompt.trim() || !!running}
          className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
            customPrompt.trim() && !running
              ? 'bg-[#0071E3] text-white shadow-[0_2px_8px_rgba(0,113,227,0.25)] hover:bg-[#0077ED]'
              : 'bg-black/[0.04] text-black/15 cursor-not-allowed'
          }`}
        >
          {running === 'custom' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
