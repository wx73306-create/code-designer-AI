import { create } from "zustand"
import { persist } from "zustand/middleware"

// ─── Provider & Pipeline Types ───────────────────────────────────────────────

export interface ModelProvider {
  id: string
  name: string
  models: string[]
  icon: string
  color: string
  apiKey: string
  endpoint: string
  enabled: boolean
}

export interface PipelineStage {
  stage: string
  provider: string
  model: string
  temperature: number
  maxTokens: number
}

// ─── Default Providers ───────────────────────────────────────────────────────

const DEFAULT_PROVIDERS: ModelProvider[] = [
  { id: "alibaba", name: "阿里云百炼", models: ["qwen-plus", "qwen-max", "qwen-turbo", "qwen-long", "qwen-vl-plus", "qwen-vl-max"], icon: "☁️", color: "#FF6A00", apiKey: "", endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1", enabled: true },
  // 只保留实测可用的模型：mimo-v2.5-pro-ultraspeed / -lite / -vision 已被证实返回
  // 400 "Unsupported model"。其中 vision 阶段必须用 mimo-v2.5 —— mimo-v2.5-pro
  // 不支持图像输入，会返回 404 "No endpoints found that support image input"。
  { id: "mimo", name: "MiMo API", models: ["mimo-v2.5", "mimo-v2.5-pro"], icon: "🤖", color: "#0071E3", apiKey: "", endpoint: "https://api.xiaomimimo.com/v1", enabled: true },
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-preview", "o1-mini"], icon: "🧠", color: "#10a37f", apiKey: "", endpoint: "https://api.openai.com/v1", enabled: false },
  { id: "anthropic", name: "Anthropic", models: ["claude-3.5-sonnet", "claude-3.5-haiku", "claude-3-opus", "claude-4-sonnet"], icon: "🟠", color: "#d97706", apiKey: "", endpoint: "https://api.anthropic.com/v1", enabled: false },
  { id: "google", name: "Google Gemini", models: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-pro", "gemini-1.5-flash"], icon: "💎", color: "#4285f4", apiKey: "", endpoint: "https://generativelanguage.googleapis.com/v1beta", enabled: false },
  { id: "deepseek", name: "DeepSeek", models: ["deepseek-chat", "deepseek-coder", "deepseek-v3", "deepseek-r1"], icon: "🔮", color: "#6366f1", apiKey: "", endpoint: "https://api.deepseek.com/v1", enabled: false },
  { id: "ollama", name: "Ollama (Local)", models: ["llama3.1:70b", "codellama:34b", "qwen2.5:72b", "deepseek-coder:33b"], icon: "🦙", color: "#6b7280", apiKey: "", endpoint: "http://localhost:11434/api", enabled: false },
]

// ── v9 默认主链路（全走百炼 dashscope 公共端点）──
// 根因复盘：原 v8 把 vision 留在 mimo-v2.5，而 mimo.ts 实测吞吐仅 ~1-2 tok/s，
// vision 阶段 maxTokens=4096 → 4096/1.5 ≈ 45min，正是用户「设计评审卡了 34 分钟」的真因
// （旧配置全链路都在 MiMo 上，更慢）。同时 v8 把 code/preview 设为 qwen-plus，但浏览器对
// vision/code/preview 三阶段都会带 websiteScreenshot（截图），route 会把截图作为 image_url 注入，
// qwen-plus 是纯文本模型、不支持图像输入 → 那两阶段在真实浏览器里会报错。
// 因此 v9 规则：带图阶段（vision/code/preview）用多模态 qwen-vl-plus；纯文本阶段用 qwen-plus。
// 两者都是 dashscope 公共端点（实测 preflight：qwen-vl-plus 0.3s / qwen-plus 0.6s），全链路秒级出字。
// MiMo 已完全移出默认链路，仅作为手动可启用的 fallback provider 保留（速率恢复后可后台切回）。
const DEFAULT_PIPELINE: PipelineStage[] = [
  { stage: "vision", provider: "alibaba", model: "qwen-vl-plus", temperature: 0.3, maxTokens: 4096 },
  { stage: "planning", provider: "alibaba", model: "qwen-plus", temperature: 0.2, maxTokens: 8192 },
  { stage: "code", provider: "alibaba", model: "qwen-vl-plus", temperature: 0.1, maxTokens: 8192 },
  { stage: "qa", provider: "alibaba", model: "qwen-plus", temperature: 0.2, maxTokens: 4096 },
  { stage: "optimize", provider: "alibaba", model: "qwen-plus", temperature: 0.2, maxTokens: 4096 },
  { stage: "enhance", provider: "alibaba", model: "qwen-plus", temperature: 0.2, maxTokens: 4096 },
  { stage: "preview", provider: "alibaba", model: "qwen-vl-plus", temperature: 0.1, maxTokens: 12288 },
]

// ─── Store ───────────────────────────────────────────────────────────────────

interface ModelSettingsState {
  providers: ModelProvider[]
  pipeline: PipelineStage[]
  fallbackEnabled: boolean
  fallbackProvider: string
  fallbackModel: string

  // Actions
  setProviders: (providers: ModelProvider[]) => void
  setPipeline: (pipeline: PipelineStage[]) => void
  setFallback: (enabled: boolean, provider: string, model: string) => void

  // Helpers — used by the workflow to get the right model config
  getStageConfig: (stage: string) => {
    provider: ModelProvider | undefined
    stage: PipelineStage
    fallback?: { provider: ModelProvider | undefined; model: string }
  }
}

export const useModelSettings = create<ModelSettingsState>()(
  persist(
    (set, get) => ({
      providers: DEFAULT_PROVIDERS,
      pipeline: DEFAULT_PIPELINE,
      fallbackEnabled: true,
      fallbackProvider: "alibaba",
      fallbackModel: "qwen-plus",

      setProviders: (providers) => set({ providers }),
      setPipeline: (pipeline) => set({ pipeline }),
      setFallback: (enabled, provider, model) =>
        set({ fallbackEnabled: enabled, fallbackProvider: provider, fallbackModel: model }),

      getStageConfig: (stage: string) => {
        const state = get()
        const stageConfig = state.pipeline.find((p) => p.stage === stage) || state.pipeline[0]
        const provider = state.providers.find((p) => p.id === stageConfig.provider)
        const fallbackProvider = state.fallbackEnabled
          ? state.providers.find((p) => p.id === state.fallbackProvider)
          : undefined

        return {
          provider,
          stage: stageConfig,
          fallback: fallbackProvider
            ? { provider: fallbackProvider, model: state.fallbackModel }
            : undefined,
        }
      },
    }),
    {
      name: "code-designer-model-settings",
      // v9：默认链路全部改走百炼 dashscope（快）。带图阶段 vision/code/preview 用多模态
      // qwen-vl-plus；纯文本阶段用 qwen-plus。MiMo(~1-2 tok/s)已移出默认链路，根治
      // 「vision 4096 tokens ≈ 45min 卡死」。版本号递增以重置浏览器旧缓存。
      version: 9,
      migrate: (persistedState: any) => {
        const cached = persistedState as ModelSettingsState;
        const cachedIds = new Set(cached.providers.map((p: ModelProvider) => p.id));
        // Add new providers not in cache
        const newProviders = [
          ...cached.providers,
          ...DEFAULT_PROVIDERS.filter(p => !cachedIds.has(p.id)),
        ];
        // Update existing providers with latest config from defaults, STRIP apiKey
        const merged = newProviders.map((p: ModelProvider) => {
          const def = DEFAULT_PROVIDERS.find(d => d.id === p.id);
          if (def) return { ...p, models: def.models, icon: def.icon, color: def.color, endpoint: def.endpoint, apiKey: "" };
          return { ...p, apiKey: "" }; // Strip apiKey from ALL providers
        });
        // Reorder to match DEFAULT_PROVIDERS order
        const ordered = DEFAULT_PROVIDERS.map(def => merged.find((p: ModelProvider) => p.id === def.id)!).filter(Boolean);
        // Append any cached-only providers not in defaults
        const extras = merged.filter((p: ModelProvider) => !DEFAULT_PROVIDERS.find(d => d.id === p.id));
        // 强制重置 pipeline 和 fallback，清除旧缓存的硬编码 provider
        return {
          ...cached,
          providers: [...ordered, ...extras],
          pipeline: DEFAULT_PIPELINE,
          fallbackProvider: "alibaba",
          fallbackModel: "qwen-plus",
        } as ModelSettingsState;
      },
    }
  )
)
