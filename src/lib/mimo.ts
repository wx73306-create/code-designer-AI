// =====================================================================
// MiMo-V2.5 API Client — Server-side only
// =====================================================================
// 优先级：数据库 Setting 表 > 环境变量 process.env > 客户端 modelConfig
// =====================================================================

import { getAiConfig } from "@/lib/ai-config";

interface MiMoMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MultimodalContent[];
}

interface MultimodalContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'low' | 'high' | 'auto' };
}

interface MiMoResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Optional model config override from admin settings */
export interface ModelConfig {
  model?: string;
  apiKey?: string;
  endpoint?: string;
}

/**
 * 安全解析调用凭据。
 * 优先级：数据库 Setting 表 > 环境变量 process.env > 客户端 modelConfig（BYOK）
 * 核心原则：平台 API_KEY 只能发往平台 endpoint，
 * 任何自定义（非平台）endpoint 必须自带 apiKey（BYOK）。
 */
async function resolveCredentials(modelConfig?: ModelConfig): Promise<{ apiKey: string; endpoint: string; model: string }> {
  // 从数据库读取配置（失败时静默返回 null，走环境变量兜底）
  const dbConfig = await getAiConfig();

  const MIMO_URL = dbConfig.mimoApiUrl || process.env.MIMO_API_URL || 'https://api.xiaomimimo.com/v1';
  const ALIBABA_URL = dbConfig.alibabaApiUrl || process.env.ALIBABA_API_URL || '';
  const MIMO_KEY = dbConfig.mimoApiKey || process.env.MIMO_API_KEY || '';
  const ALIBABA_KEY = dbConfig.alibabaApiKey || process.env.ALIBABA_API_KEY || '';
  const DEFAULT_MODEL = dbConfig.mimoModel || process.env.MIMO_MODEL || 'mimo-v2.5';
  const DEFAULT_VL_MODEL = dbConfig.vlModel || process.env.VL_MODEL || 'qwen-vl-plus';

  const model = modelConfig?.model || DEFAULT_MODEL;
  const endpoint = modelConfig?.endpoint || (MIMO_KEY ? MIMO_URL : ALIBABA_URL || MIMO_URL);

  // 仅允许 http/https 协议
  let protocol = '';
  try {
    protocol = new URL(endpoint).protocol;
  } catch {
    throw new Error('Invalid model endpoint URL.');
  }
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('Model endpoint must use http or https.');
  }

  // 根据 endpoint 匹配对应的 Key
  const isMimoEndpoint = endpoint === MIMO_URL;
  const isAlibabaEndpoint = endpoint === ALIBABA_URL;
  const isPlatformEndpoint = isMimoEndpoint || isAlibabaEndpoint;

  let apiKey: string;
  if (isMimoEndpoint && MIMO_KEY) {
    apiKey = MIMO_KEY;
  } else if (isAlibabaEndpoint && ALIBABA_KEY) {
    apiKey = ALIBABA_KEY;
  } else if (isPlatformEndpoint) {
    apiKey = MIMO_KEY || ALIBABA_KEY;
  } else {
    // 自定义 endpoint 必须自带 Key（BYOK）
    apiKey = modelConfig?.apiKey || '';
  }

  if (!apiKey) {
    throw new Error('A custom endpoint requires its own API key (BYOK). The platform key is never sent to third-party endpoints.');
  }

  return { apiKey, endpoint, model };
}

/**
 * Call MiMo API with system prompt + user message.
 * Supports optional multimodal images (base64 PNG) for vision models.
 * When images are provided, automatically switches to VL model (qwen-vl-plus).
 */
export async function callMiMo(
  systemPrompt: string,
  userMessage: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    modelConfig?: ModelConfig;
    /** Base64-encoded PNG images (without data: prefix) for multimodal input */
    images?: string[];
  }
): Promise<string> {
  const hasImages = options?.images && options.images.length > 0;

  // When images are present, auto-switch to vision model
  const dbConfig = await getAiConfig();
  const VL_MODEL = dbConfig.vlModel || process.env.VL_MODEL || 'qwen-vl-plus';
  const effectiveModelConfig = hasImages && !options?.modelConfig?.model
    ? { ...options?.modelConfig, model: VL_MODEL }
    : options?.modelConfig;

  // Resolve credentials from database first, then env vars
  const { apiKey, endpoint, model } = await resolveCredentials(effectiveModelConfig);

  // Build user message: plain text or multimodal array
  let userContent: string | MultimodalContent[];
  if (hasImages) {
    const parts: MultimodalContent[] = [
      { type: 'text', text: userMessage },
    ];
    for (const base64 of options!.images!) {
      parts.push({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${base64}`,
          detail: 'high',
        },
      });
    }
    userContent = parts;
  } else {
    userContent = userMessage;
  }

  const messages: MiMoMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300_000); // 5 min timeout

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 8192,
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error (${response.status}) [${model}]: ${text}`);
  }

  const data: MiMoResponse = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Call MiMo with streaming. Supports optional modelConfig override.
 */
export async function callMiMoStream(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number; modelConfig?: ModelConfig }
): Promise<ReadableStream<string>> {
  const { apiKey, endpoint, model } = await resolveCredentials(options?.modelConfig);

  const messages: MiMoMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error (${response.status}) [${model}]: ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();

  return new ReadableStream<string>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(content);
            }
          } catch {
            // skip malformed JSON chunks
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
