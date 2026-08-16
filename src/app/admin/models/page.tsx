'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Eye, EyeOff, Shield, Zap, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useModelSettings } from '@/store/model-settings';

export default function AdminModelsPage() {
  const { providers, pipeline, setProviders, setPipeline } = useModelSettings();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleProvider = (id: string) => {
    setProviders(providers.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };
  const updateStage = (stage: string, pid: string, model: string) => {
    setPipeline(pipeline.map(p => p.stage === stage ? { ...p, provider: pid, model } : p));
  };
  const enabled = providers.filter(p => p.enabled);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">模型管理</h1>
        <p className="text-sm text-white/40 mt-1">配置 AI 模型提供商、API 密钥和流水线阶段</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<Zap className="w-4 h-4 text-[#FF6A00]" />} label="已启用" value={enabled.length} total={providers.length} />
        <StatCard icon={<Shield className="w-4 h-4 text-[#34C759]" />} label="已配 Key" value={providers.filter(p => p.apiKey).length} total={providers.length} />
        <StatCard icon={<RefreshCw className="w-4 h-4 text-[#0071E3]" />} label="流水线" value={pipeline.length} />
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">AI 流水线配置</h2>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {pipeline.map((stage) => {
            const sp = providers.find(p => p.id === stage.provider);
            return (
              <div key={stage.stage} className="px-5 py-3 flex items-center gap-4">
                <span className="text-xs font-medium text-white/60 w-20 capitalize">{stage.stage}</span>
                <span className="text-sm">{sp?.icon}</span>
                <span className="text-sm text-white">{sp?.name || stage.provider}</span>
                <span className="text-[11px] font-mono text-white/40 bg-white/[0.04] px-2 py-0.5 rounded">{stage.model}</span>
                <div className="flex-1" />
                <select
                  value={stage.provider + ':' + stage.model}
                  onChange={(e) => { const v = e.target.value; const i = v.indexOf(':'); updateStage(stage.stage, v.slice(0, i), v.slice(i + 1)); }}
                  className="text-xs bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/70 outline-none"
                >
                  {enabled.map(p => p.models.map(m => (
                    <option key={p.id + m} value={p.id + ':' + m} className="bg-[#1a1a2e]">{p.name} - {m}</option>
                  )))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white mb-4">模型提供商</h2>
        <div className="space-y-3">
          {providers.map((p) => {
            const isOpen = expanded === p.id;
            return (
              <div key={p.id} className={'bg-white/[0.03] border rounded-xl overflow-hidden ' + (p.enabled ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60')}>
                <div className="px-5 py-4 flex items-center gap-4">
                  <span className="text-2xl">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{p.name}</h3>
                      <span className={'px-1.5 py-0.5 rounded text-[9px] font-medium ' + (p.enabled ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-white/[0.06] text-white/30')}>
                        {p.enabled ? '已启用' : '已禁用'}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/30 font-mono truncate mt-0.5">{p.endpoint}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.apiKey
                      ? <span className="text-[10px] text-[#34C759] flex items-center gap-1"><Check className="w-3 h-3" />Key</span>
                      : <span className="text-[10px] text-white/25 flex items-center gap-1"><X className="w-3 h-3" />无</span>}
                    <button onClick={() => toggleProvider(p.id)}
                      className={'relative w-10 h-5 rounded-full transition-colors ' + (p.enabled ? 'bg-[#34C759]' : 'bg-white/[0.1]')}>
                      <motion.div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                        animate={{ left: p.enabled ? 22 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                    </button>
                    <button onClick={() => setExpanded(isOpen ? null : p.id)} className="p-1 text-white/30 hover:text-white/60">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
                    <div>
                      <label className="text-[11px] text-white/40 block mb-1">API Key</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 font-mono text-xs text-white/60 truncate">
                          {p.apiKey ? (showKeys[p.id] ? p.apiKey : '\u2022'.repeat(32)) : <span className="text-white/20 italic">未配置</span>}
                        </div>
                        {p.apiKey && (
                          <button onClick={() => setShowKeys(s => ({ ...s, [p.id]: !s[p.id] }))}
                            className="p-2 rounded-lg bg-white/[0.04] text-white/40 hover:text-white/60">
                            {showKeys[p.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-white/40 block mb-1">可用模型 ({p.models.length})</label>
                      <div className="flex flex-wrap gap-1.5">
                        {p.models.map(m => (
                          <span key={m} className="px-2 py-1 rounded bg-white/[0.04] border border-white/[0.06] text-[11px] font-mono text-white/50">{m}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, total }: { icon: React.ReactNode; label: string; value: number; total?: number }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-white/40">{label}</span></div>
      <div className="text-2xl font-bold text-white">{value}{total !== undefined && <span className="text-sm text-white/30"> / {total}</span>}</div>
    </div>
  );
}
