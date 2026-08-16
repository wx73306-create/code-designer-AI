"use client"

import { useState, useEffect } from "react"
import {
  Settings, Cpu, Database, Pencil, Save, ChevronDown, ChevronUp,
  Zap, ShieldCheck, Eye, Code2, Brain, RotateCcw, AlertTriangle,
  Check, X, Plus, Trash2, ToggleLeft, ToggleRight, Power,
} from "lucide-react"
import { useModelSettings, type ModelProvider, type PipelineStage } from "@/store/model-settings"

const COST_DATA = [
  { provider: "MiMo API", today: 1245, tokens: "128W", cost: 38.2, successRate: 99.1 },
  { provider: "OpenAI", today: 0, tokens: "0", cost: 0, successRate: 0 },
  { provider: "Anthropic", today: 0, tokens: "0", cost: 0, successRate: 0 },
  { provider: "Google", today: 0, tokens: "0", cost: 0, successRate: 0 },
]

const STAGE_META: Record<string, { label: string; icon: any }> = {
  vision: { label: "视觉分析 (Vision)", icon: Eye },
  planning: { label: "架构规划 (Planning)", icon: Brain },
  code: { label: "代码生成 (Code)", icon: Code2 },
  qa: { label: "质量检测 (QA)", icon: ShieldCheck },
}

export default function SettingsPage() {
  const {
    providers, pipeline, fallbackEnabled, fallbackProvider, fallbackModel,
    setProviders, setPipeline, setFallback,
  } = useModelSettings()

  const [expandedProvider, setExpandedProvider] = useState<string | null>("mimo")
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<"models" | "pipeline" | "quota" | "maintenance">("models")

  // Quota settings (local for now)
  const [freeQuota, setFreeQuota] = useState(2)
  const [proQuota, setProQuota] = useState(100)
  const [autoOptimize, setAutoOptimize] = useState(true)
  const [quotaSaved, setQuotaSaved] = useState(false)
  const [quotaUsers, setQuotaUsers] = useState<Array<{
    email: string; name: string; tier: "free" | "pro"; isAdmin: boolean;
    used: number; limit: number; remaining: number; allowed: boolean;
  }>>([])

  // ---- 总控制开关（网页生成） ----
  const [genEnabled, setGenEnabled] = useState(true)
  const [genToggling, setGenToggling] = useState(false)

  // 加载系统设置（总开关 + 配额配置）
  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        setGenEnabled(d.generationEnabled ?? true)
        if (d.quotaConfig) {
          setFreeQuota(d.quotaConfig.free ?? 2)
          setProQuota(d.quotaConfig.pro ?? 100)
        }
      })
      .catch(() => {})
  }, [])

  // 轮询配额总览（实时用户用量 + 配置同步）
  useEffect(() => {
    let alive = true
    const load = () => {
      fetch("/api/admin/stats?section=quota", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return
          if (Array.isArray(d.users)) setQuotaUsers(d.users)
          if (d.quotaConfig) {
            setFreeQuota(d.quotaConfig.free ?? 2)
            setProQuota(d.quotaConfig.pro ?? 100)
          }
        })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 4000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  async function toggleGeneration() {
    if (genToggling) return
    const next = !genEnabled
    setGenToggling(true)
    setGenEnabled(next)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationEnabled: next }),
      })
      if (!res.ok) throw new Error("toggle failed")
    } catch {
      setGenEnabled(!next)
    } finally {
      setGenToggling(false)
    }
  }

  // 保存配额配置（实时下发到前端账户）
  async function saveQuotaConfig(free: number, pro: number) {
    try {
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotaConfig: { free, pro } }),
      })
      setQuotaSaved(true)
      setTimeout(() => setQuotaSaved(false), 1500)
    } catch { /* ignore */ }
  }

  // 切换用户套餐等级
  async function toggleUserTier(email: string, current: "free" | "pro") {
    const next = current === "pro" ? "free" : "pro"
    setQuotaUsers((prev) => prev.map((u) => u.email === email ? { ...u, tier: next } : u))
    try {
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userTier: { email, tier: next } }),
      })
    } catch { /* ignore */ }
  }

  function toggleProvider(id: string) {
    setProviders(providers.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p))
  }

  function updateProvider(id: string, field: keyof ModelProvider, value: string) {
    setProviders(providers.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  function updatePipelineStage(stage: string, field: keyof PipelineStage, value: any) {
    setPipeline(pipeline.map(p => p.stage === stage ? { ...p, [field]: value } : p))
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const tabs = [
    { id: "models" as const, label: "AI 模型配置", icon: Cpu },
    { id: "pipeline" as const, label: "流水线分配", icon: Zap },
    { id: "quota" as const, label: "配额与限额", icon: ShieldCheck },
    { id: "maintenance" as const, label: "系统维护", icon: Database },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-white/40" />
            系统设置
          </h1>
          <p className="text-sm text-white/30 mt-1">平台配置、AI 模型切换与系统参数</p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
            ${saved
              ? "bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20"
              : "bg-[#0071E3] text-white shadow-[0_2px_12px_rgba(0,113,227,0.3)] hover:bg-[#0077ED]"
            }`}
        >
          {saved ? <><Check className="w-4 h-4" />已保存</> : <><Save className="w-4 h-4" />保存配置</>}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/[0.06] w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer
              ${activeTab === id
                ? "bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/15"
                : "text-white/40 hover:text-white/60 border border-transparent"
              }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── Tab: AI Model Configuration ─── */}
      {activeTab === "models" && (
        <div className="space-y-4">
          {/* Provider cards */}
          {providers.map((provider) => {
            const isExpanded = expandedProvider === provider.id
            const enabledModels = provider.models.length
            return (
              <div key={provider.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                {/* Provider header */}
                <div className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{provider.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white">{provider.name}</h3>
                        {provider.enabled && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/15">已启用</span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/25 mt-0.5">{enabledModels} 个可用模型</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Enable toggle */}
                    <button onClick={() => toggleProvider(provider.id)} className="cursor-pointer">
                      {provider.enabled
                        ? <ToggleRight className="w-8 h-8 text-[#34C759]" />
                        : <ToggleLeft className="w-8 h-8 text-white/20" />
                      }
                    </button>
                    {/* Expand */}
                    <button onClick={() => setExpandedProvider(isExpanded ? null : provider.id)} className="cursor-pointer text-white/30 hover:text-white/60 transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded: config details */}
                {isExpanded && (
                  <div className="border-t border-white/[0.04] px-5 py-4 space-y-4">
                    {/* API Key */}
                    <div>
                      <label className="block text-[11px] font-medium text-white/40 mb-1.5">API Key</label>
                      <input
                        type="password"
                        value={provider.apiKey}
                        onChange={(e) => updateProvider(provider.id, "apiKey", e.target.value)}
                        placeholder="输入 API Key..."
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-white/15 outline-none focus:ring-1 focus:ring-[#0071E3]/30 transition-all"
                      />
                    </div>
                    {/* Endpoint */}
                    <div>
                      <label className="block text-[11px] font-medium text-white/40 mb-1.5">API Endpoint</label>
                      <input
                        type="text"
                        value={provider.endpoint}
                        onChange={(e) => updateProvider(provider.id, "endpoint", e.target.value)}
                        placeholder="https://api.example.com/v1"
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-white/15 outline-none focus:ring-1 focus:ring-[#0071E3]/30 transition-all"
                      />
                    </div>
                    {/* Available models */}
                    <div>
                      <label className="block text-[11px] font-medium text-white/40 mb-2">可用模型</label>
                      <div className="flex flex-wrap gap-2">
                        {provider.models.map((model) => {
                          const inUse = pipeline.some(p => p.provider === provider.id && p.model === model)
                          return (
                            <span key={model} className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border
                              ${inUse
                                ? "bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/20"
                                : "bg-white/[0.03] text-white/40 border-white/[0.06]"
                              }`}>
                              {inUse && <Zap className="w-2.5 h-2.5 inline mr-1" />}
                              {model}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add provider button */}
          <button className="w-full py-3 rounded-xl border border-dashed border-white/[0.08] text-xs text-white/25 hover:text-white/50 hover:border-white/[0.15] transition-all cursor-pointer flex items-center justify-center gap-2">
            <Plus className="w-3.5 h-3.5" />
            添加新的模型供应商
          </button>
        </div>
      )}

      {/* ─── Tab: Pipeline Assignment ─── */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-white">流水线模型分配</h3>
                <p className="text-[11px] text-white/30 mt-0.5">为每个 AI 处理阶段分配不同的模型和参数</p>
              </div>
              <button
                onClick={() => setPipeline([
                  { stage: "vision", provider: "alibaba", model: "qwen-plus", temperature: 0.3, maxTokens: 4096 },
                  { stage: "critic", provider: "alibaba", model: "qwen-plus", temperature: 0.2, maxTokens: 4096 },
                  { stage: "planning", provider: "alibaba", model: "qwen-plus", temperature: 0.2, maxTokens: 8192 },
                  { stage: "code", provider: "alibaba", model: "qwen-plus", temperature: 0.1, maxTokens: 16384 },
                  { stage: "qa", provider: "alibaba", model: "qwen-plus", temperature: 0.2, maxTokens: 4096 },
                ])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-white/30 hover:text-white/60 border border-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                重置默认
              </button>
            </div>

            <div className="space-y-3">
              {pipeline.map((stage) => {
                const meta = STAGE_META[stage.stage] || { label: stage.stage, icon: Cpu }
                const StageIcon = meta.icon
                const availableProvider = providers.find(p => p.id === stage.provider)
                return (
                  <div key={stage.stage} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                        <StageIcon className="w-4 h-4 text-white/50" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{meta.label}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Provider select */}
                      <div>
                        <label className="block text-[10px] text-white/30 mb-1">供应商</label>
                        <select
                          value={stage.provider}
                          onChange={(e) => {
                            const newProvider = e.target.value
                            const provider = providers.find(p => p.id === newProvider)
                            updatePipelineStage(stage.stage, "provider", newProvider)
                            if (provider && provider.models.length > 0) {
                              updatePipelineStage(stage.stage, "model", provider.models[0])
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white outline-none focus:ring-1 focus:ring-[#0071E3]/30 appearance-none cursor-pointer"
                        >
                          {providers.filter(p => p.enabled).map(p => (
                            <option key={p.id} value={p.id} className="bg-[#1a1d23]">{p.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Model select */}
                      <div>
                        <label className="block text-[10px] text-white/30 mb-1">模型</label>
                        <select
                          value={stage.model}
                          onChange={(e) => updatePipelineStage(stage.stage, "model", e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white outline-none focus:ring-1 focus:ring-[#0071E3]/30 appearance-none cursor-pointer"
                        >
                          {(availableProvider?.models || []).map(m => (
                            <option key={m} value={m} className="bg-[#1a1d23]">{m}</option>
                          ))}
                        </select>
                      </div>

                      {/* Temperature */}
                      <div>
                        <label className="block text-[10px] text-white/30 mb-1">Temperature: {stage.temperature}</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={stage.temperature}
                          onChange={(e) => updatePipelineStage(stage.stage, "temperature", parseFloat(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer"
                          style={{ background: `linear-gradient(to right, #0071E3 ${stage.temperature * 100}%, rgba(255,255,255,0.06) ${stage.temperature * 100}%)` }}
                        />
                      </div>

                      {/* Max tokens */}
                      <div>
                        <label className="block text-[10px] text-white/30 mb-1">Max Tokens</label>
                        <input
                          type="number"
                          value={stage.maxTokens}
                          onChange={(e) => updatePipelineStage(stage.stage, "maxTokens", parseInt(e.target.value) || 4096)}
                          className="w-full px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white outline-none focus:ring-1 focus:ring-[#0071E3]/30"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Fallback config */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#FF9500]" />
                <h3 className="text-sm font-medium text-white">故障回退模型</h3>
              </div>
              <button onClick={() => setFallback(!fallbackEnabled, fallbackProvider, fallbackModel)} className="cursor-pointer">
                {fallbackEnabled
                  ? <ToggleRight className="w-8 h-8 text-[#34C759]" />
                  : <ToggleLeft className="w-8 h-8 text-white/20" />
                }
              </button>
            </div>
            {fallbackEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-white/30 mb-1">回退供应商</label>
                  <select
                    value={fallbackProvider}
                    onChange={(e) => setFallback(true, e.target.value, fallbackModel)}
                    className="w-full px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white outline-none focus:ring-1 focus:ring-[#0071E3]/30 appearance-none cursor-pointer"
                  >
                    {providers.filter(p => p.enabled).map(p => (
                      <option key={p.id} value={p.id} className="bg-[#1a1d23]">{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-white/30 mb-1">回退模型</label>
                  <select
                    value={fallbackModel}
                    onChange={(e) => setFallback(true, fallbackProvider, e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white outline-none focus:ring-1 focus:ring-[#0071E3]/30 appearance-none cursor-pointer"
                  >
                    {(providers.find(p => p.id === fallbackProvider)?.models || []).map(m => (
                      <option key={m} value={m} className="bg-[#1a1d23]">{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab: Quota ─── */}
      {activeTab === "quota" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">生成配额</h3>
                <p className="text-[11px] text-white/25 mt-0.5">修改后实时下发到前端账户，用户剩余次数立即更新</p>
              </div>
              {quotaSaved && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#34C759]/10 border border-[#34C759]/20 text-[10px] text-[#34C759]">
                  <Check className="w-3 h-3" /> 已实时下发
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-white/40 mb-1.5">免费用户 (次/天)</label>
                <input
                  type="number"
                  value={freeQuota}
                  onChange={(e) => setFreeQuota(parseInt(e.target.value) || 0)}
                  onBlur={() => saveQuotaConfig(freeQuota, proQuota)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white outline-none focus:ring-1 focus:ring-[#0071E3]/30"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-white/40 mb-1.5">Pro 用户 (次/天)</label>
                <input
                  type="number"
                  value={proQuota}
                  onChange={(e) => setProQuota(parseInt(e.target.value) || 0)}
                  onBlur={() => saveQuotaConfig(freeQuota, proQuota)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white outline-none focus:ring-1 focus:ring-[#0071E3]/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-white/[0.04]">
              <div>
                <p className="text-sm text-white/60">自动优化循环</p>
                <p className="text-[11px] text-white/25 mt-0.5">QA 分数低于 90% 时自动重新生成代码</p>
              </div>
              <button onClick={() => setAutoOptimize(!autoOptimize)} className="cursor-pointer">
                {autoOptimize
                  ? <ToggleRight className="w-8 h-8 text-[#34C759]" />
                  : <ToggleLeft className="w-8 h-8 text-white/20" />
                }
              </button>
            </div>
          </div>

          {/* 实时用户配额用量 */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">用户配额用量（实时）</h3>
              <span className="text-[11px] text-white/25 tabular-nums">{quotaUsers.length} 名用户</span>
            </div>
            {quotaUsers.length === 0 ? (
              <div className="px-5 py-10 text-center text-xs text-white/30">暂无登录用户 — 用户登录后会实时出现在这里</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-5 py-3 font-medium text-white/35 text-xs">用户</th>
                    <th className="px-5 py-3 font-medium text-white/35 text-xs">套餐</th>
                    <th className="px-5 py-3 font-medium text-white/35 text-xs">今日用量</th>
                    <th className="px-5 py-3 font-medium text-white/35 text-xs">剩余</th>
                    <th className="px-5 py-3 font-medium text-white/35 text-xs">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {quotaUsers.map((u) => (
                    <tr key={u.email} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <div className="text-xs text-white/70">{u.name}</div>
                        <div className="text-[10px] text-white/25">{u.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => toggleUserTier(u.email, u.tier)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors cursor-pointer ${
                            u.tier === "pro"
                              ? "bg-[#AF52DE]/10 text-[#AF52DE] border-[#AF52DE]/20 hover:bg-[#AF52DE]/15"
                              : "bg-white/[0.04] text-white/40 border-white/[0.08] hover:bg-white/[0.07]"
                          }`}
                          title="点击切换套餐"
                        >
                          {u.isAdmin ? "Admin" : u.tier === "pro" ? "Pro" : "免费"}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-xs text-white/60 tabular-nums">
                        {u.used} {u.limit !== -1 && <span className="text-white/25">/ {u.limit}</span>}
                      </td>
                      <td className="px-5 py-3 text-xs tabular-nums">
                        {u.limit === -1
                          ? <span className="text-[#0071E3]">无限</span>
                          : <span className={u.remaining > 0 ? "text-white/60" : "text-[#FF3B30]"}>{u.remaining}</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] ${u.allowed ? "text-[#34C759]" : "text-[#FF9F0A]"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.allowed ? "bg-[#34C759]" : "bg-[#FF9F0A]"}`} />
                          {u.allowed ? "可用" : "已用完"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Cost overview */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-medium text-white">今日模型费用</h3>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {COST_DATA.map((row) => (
                <div key={row.provider} className="px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white/60 w-28">{row.provider}</span>
                    <span className="text-xs text-white/30">{row.today} 次调用</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-xs text-white/30">{row.tokens} tokens</span>
                    <span className="text-xs font-medium text-white/60">¥{row.cost.toFixed(2)}</span>
                    {row.successRate > 0 && (
                      <span className="text-[10px] text-[#34C759]">{row.successRate}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab: Maintenance ─── */}
      {activeTab === "maintenance" && (
        <div className="space-y-4">
          {/* ─── 网页生成总开关 ─── */}
          <div className={`rounded-xl border px-5 py-5 transition-colors ${
            genEnabled
              ? "border-[#34C759]/25 bg-[#34C759]/[0.04]"
              : "border-[#FF9F0A]/25 bg-[#FF9F0A]/[0.04]"
          }`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                  genEnabled
                    ? "bg-[#34C759]/10 border-[#34C759]/20"
                    : "bg-[#FF9F0A]/10 border-[#FF9F0A]/20"
                }`}>
                  <Power className={`w-5 h-5 ${genEnabled ? "text-[#34C759]" : "text-[#FF9F0A]"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">网页生成总开关</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      genEnabled
                        ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20"
                        : "bg-[#FF9F0A]/10 text-[#FF9F0A] border-[#FF9F0A]/20"
                    }`}>
                      {genEnabled ? "运行中" : "已暂停"}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/35 mt-1 leading-relaxed max-w-md">
                    一键开启或关闭全平台的网页生成功能。关闭后，前台「开始生成」按钮将被禁用，所有 AI 生成请求（/api/mimo、/api/workflow）会返回 503。
                  </p>
                </div>
              </div>
              <button
                onClick={toggleGeneration}
                disabled={genToggling}
                className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer disabled:opacity-60 ${
                  genEnabled
                    ? "bg-[#FF9F0A]/10 text-[#FF9F0A] border-[#FF9F0A]/25 hover:bg-[#FF9F0A]/15"
                    : "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/25 hover:bg-[#34C759]/15"
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                {genToggling ? "切换中…" : genEnabled ? "暂停服务" : "恢复服务"}
              </button>
            </div>
          </div>

          {[
            { title: "数据库备份", desc: "上次备份: 2026-07-19 03:00 UTC", action: "立即备份", icon: Database },
            { title: "日志清理", desc: "保留 30 天 · 当前 2.3GB", action: "清理日志", icon: Trash2 },
            { title: "缓存清理", desc: "Redis 缓存 · 当前 128MB", action: "清理缓存", icon: RotateCcw },
            { title: "队列管理", desc: "BullMQ · 0 个排队任务", action: "查看队列", icon: Zap },
          ].map(({ title, desc, action, icon: Icon }) => (
            <div key={title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="text-[11px] text-white/25 mt-0.5">{desc}</p>
                </div>
              </div>
              <button className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 border border-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer">
                {action}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
