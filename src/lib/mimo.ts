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
interface AiCredentials {
  apiKey: string;
  endpoint: string;
  model: string;
}

async function resolveCredentialCandidates(modelConfig?: ModelConfig): Promise<AiCredentials[]> {
  // 从数据库读取配置（失败时静默返回 null，走环境变量兜底）
  const dbConfig = await getAiConfig();

  const MIMO_URL = dbConfig.mimoApiUrl || process.env.MIMO_API_URL || 'https://api.xiaomimimo.com/v1';
  const ALIBABA_URL = dbConfig.alibabaApiUrl || process.env.ALIBABA_API_URL || '';
  const MIMO_KEY = dbConfig.mimoApiKey || process.env.MIMO_API_KEY || '';
  const ALIBABA_KEY = dbConfig.alibabaApiKey || process.env.ALIBABA_API_KEY || '';
  const DEFAULT_MODEL = dbConfig.mimoModel || process.env.MIMO_MODEL || 'mimo-v2.5';

  const model = modelConfig?.model || DEFAULT_MODEL;
  const requestedEndpoint = modelConfig?.endpoint;

  // 仅允许 http/https 协议
  if (requestedEndpoint) {
    let protocol = '';
    try {
      protocol = new URL(requestedEndpoint).protocol;
    } catch {
      throw new Error('Invalid model endpoint URL.');
    }
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new Error('Model endpoint must use http or https.');
    }
  }

  // 注意：前端对平台端点也会一并传 endpoint（见 use-workflow.ts），
  // 因此这里必须先判断它是不是"已知平台端点"——平台端点的 Key 由服务端
  // .env 提供，不能当成 BYOK 第三方端点处理，否则会因缺少 apiKey 直接报错。
  const isMimoPlatform = requestedEndpoint ? requestedEndpoint === MIMO_URL : true;
  const isAlibabaPlatform = requestedEndpoint ? requestedEndpoint === ALIBABA_URL : false;
  const isPlatformEndpoint = isMimoPlatform || isAlibabaPlatform;

  // 第三方 endpoint（BYOK）：必须自带 key，且不参与平台间降级
  if (requestedEndpoint && !isPlatformEndpoint) {
    const apiKey = modelConfig?.apiKey || '';
    if (!apiKey) {
      throw new Error('A custom endpoint requires its own API key (BYOK). The platform key is never sent to third-party endpoints.');
    }
    return [{ apiKey, endpoint: requestedEndpoint, model }];
  }

  // 平台 endpoint：按请求（或模型名）判断主用哪一个，另一个自动作为降级备用。
  // 这样当主 provider 返回 403（百炼 workspace endpoint access denied 等）
  // 或 401 / 5xx 时，callMiMo 会切到备用平台继续，而不是直接失败。
  const mimo: AiCredentials | null =
    MIMO_KEY && MIMO_URL ? { apiKey: MIMO_KEY, endpoint: MIMO_URL, model } : null;
  const alibaba: AiCredentials | null =
    ALIBABA_KEY && ALIBABA_URL ? { apiKey: ALIBABA_KEY, endpoint: ALIBABA_URL, model } : null;

  const preferAlibaba = requestedEndpoint
    ? isAlibabaPlatform
    : !/^mimo/i.test(model) && !!ALIBABA_KEY;
  const ordered = (preferAlibaba ? [alibaba, mimo] : [mimo, alibaba]).filter(
    (c): c is AiCredentials => c !== null
  );

  if (ordered.length === 0) {
    throw new Error(
      'No AI provider configured. Set MIMO_API_KEY or ALIBABA_API_KEY, or supply an endpoint together with its own apiKey.'
    );
  }

  return ordered;
}

// ---------------------------------------------------------------------------
// Resilience: model fallback + rate-limit backoff
// ---------------------------------------------------------------------------
// 已知可用模型（按优先级尝试）。当 DB/客户端配置的模型名拼错或被下线时，
// 自动回退到这些模型，避免整条生成流水线因一个无效模型名而硬失败。
// 实测可用（2026-09-10）：仅这两个模型名有效。
// - mimo-v2.5：文本 + 图像输入都支持
// - mimo-v2.5-pro：仅文本，传图会返回 404 "No endpoints found that support image input"
// 已移除 mimo-v2.5-pro-ultraspeed / -lite / -vision —— 实测均返回 400 "Unsupported model"。
const MIMO_FALLBACK_MODELS = ['mimo-v2.5', 'mimo-v2.5-pro'];

// 429 (Too many requests) 时的最大自动重试次数（指数退避）。
const RATE_LIMIT_MAX_RETRIES = 4;

// 上游「建连」硬超时：dashscope 在限流时可能直接挂起 TCP/TLS 连接而不返回 429，
// 必须有超时，否则会卡到 route 的 maxDuration(300s)。仅约束「建连」阶段（连接
// 建立后由下方 no-data 看门狗接管）。
const UPSTREAM_CONNECT_TIMEOUT_MS = 30_000;
// 流式「无数据」超时：连接已建立、但超过该时间未收到任何 token，判定为被限流挂起，
// 主动 abort 并触发重试 / 报错。正常生成会持续吐字，不会被误杀。
const UPSTREAM_NO_DATA_TIMEOUT_MS = 45_000;

// 控制 MiMo 推理模型是否走长链思考（chain-of-thought）。
// 'none' = 关闭思考、直接出答案（最快，单阶段从 10min+ 降到分钟级）；
// 'low'  = 轻量思考（仍会 reasoning_content，较慢）。MiMo 不接受 'minimal'（400）。
// 可用环境变量 MIMO_REASONING_EFFORT 覆盖，默认 'none' 以修复长阶段延迟。
const REASONING_EFFORT = process.env.MIMO_REASONING_EFFORT || 'none';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 构造要尝试的模型名顺序。
 * 始终先试 `primary`；若 primary 是 MiMo 系列，则追加已知可用的回退模型，
 * 这样 `mimo-v2.5-pro-ultrarapid`（多一个 r 的笔误）等问题会自动降级而不是直接报错。
 */
function buildModelCandidates(primary: string, endpoint: string, hasImages = false): string[] {
  const isMimo = /xiaomimimo/i.test(endpoint);

  if (isMimo) {
    // 图像输入只有 mimo-v2.5 支持，直接锁定，不再尝试 pro（否则 404）
    if (hasImages) return ['mimo-v2.5'];
    // primary 可能不是 mimo-*（例如从百炼降级过来时模型名仍为 qwen-*），
    // 此时直接用已知可用的 MiMo 模型，避免过滤后候选列表为空。
    const seeded = /^mimo/i.test(primary) ? [primary] : [];
    return [...new Set([...seeded, ...MIMO_FALLBACK_MODELS])];
  }

  // 百炼等 OpenAI 兼容端点：mimo-* 模型名对它无效，降级时换成该端点的默认模型
  if (/^mimo/i.test(primary)) {
    return [hasImages ? 'qwen-vl-plus' : 'qwen-plus'];
  }
  return [primary];
}

/**
 * 判断一个失败是否属于"provider 级"故障，应切换到备用供应商重试。
 * 401/403 通常是 key 或 endpoint 无权访问（如百炼 workspace access denied），
 * 5xx 是供应商侧故障；这两类换 provider 才可能成功，换模型名没有意义。
 */
function isProviderFailure(status: number | undefined): boolean {
  if (status === undefined) return false;
  return status === 401 || status === 403 || (status >= 500 && status <= 599);
}

interface MiMoFetchArgs {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: MiMoMessage[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
  stream?: boolean;
}

/**
 * 发起一次 chat completion 请求，返回原始 Response。
 * 非 2xx 时抛出携带状态码与服务器报文的 Error，供上层决定如何重试/降级。
 */
async function fetchMiMo(args: MiMoFetchArgs): Promise<Response> {
  const bodyObj: Record<string, unknown> = {
    model: args.model,
    messages: args.messages,
    temperature: args.temperature,
    max_tokens: args.maxTokens,
    ...(args.stream ? { stream: true } : {}),
  };
  // 仅 MiMo 端点支持 reasoning_effort；'none' 关闭长链思考以修复单阶段 >10min 延迟。
  if (/xiaomimimo/i.test(args.endpoint)) {
    bodyObj.reasoning_effort = REASONING_EFFORT;
  }
  // 连接超时「必须可撤销」：用 AbortController + setTimeout 而非 AbortSignal.timeout。
  // 原因：AbortSignal.timeout 创建的计时器不可清除，且其 signal 会约束整个 fetch
  // 请求——含流式 body。一旦生成超过 30s，body 仍在吐字时该信号就会命中 fetch 的
  // signal，把整个请求 abort，向浏览器发出伪造的 "The operation was aborted due to
  // timeout"（err-in-stream），使阶段被 use-workflow.ts:152 误判为失败。
  // 修复：连接建立（响应头返回）后立即 clearTimeout 撤销计时器，body 此后只受调用方
  // signal 约束（callMiMoStream 的 45s 无数据看门狗 / callMiMo 的 5min 总超时）。
  const connectCtrl = new AbortController();
  const connectTimer = setTimeout(() => connectCtrl.abort(), UPSTREAM_CONNECT_TIMEOUT_MS);
  const signal = args.signal
    ? AbortSignal.any([args.signal, connectCtrl.signal])
    : connectCtrl.signal;
  const response = await fetch(`${args.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(bodyObj),
    signal,
  });

  if (!response.ok) {
    clearTimeout(connectTimer);
    const text = await response.text();
    const err = new Error(`API error (${response.status}) [${args.model}]: ${text}`);
    (err as any).status = response.status;
    (err as any).body = text;
    throw err;
  }
  // 连接已建立：撤销「连接超时」，避免其误杀流式 body（关键修复）。
  clearTimeout(connectTimer);
  return response;
}

/**
 * Call MiMo API with system prompt + user message.
 * Supports optional multimodal images (base64 PNG) for vision models.
 * When images are present, automatically switches to VL model (qwen-vl-plus).
 *
 * Resilience:
 *  - On HTTP 429 (rate limit) it retries with exponential backoff.
 *  - On HTTP 400 "Unsupported model" it falls back to a known-good model.
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
  // 默认改为 mimo-v2.5：原默认值 qwen-vl-plus 走百炼，而百炼 workspace endpoint
  // 实测 403；且模型名非 mimo-* 会让降级逻辑误判主 provider 为百炼。
  const VL_MODEL = dbConfig.vlModel || process.env.VL_MODEL || 'mimo-v2.5';
  const effectiveModelConfig = hasImages && !options?.modelConfig?.model
    ? { ...options?.modelConfig, model: VL_MODEL }
    : options?.modelConfig;

  // Resolve credentials from database first, then env vars.
  // 返回候选列表：主 provider 失败时可自动切到备用 provider。
  const credentialsList = await resolveCredentialCandidates(effectiveModelConfig);

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

  let lastErr: unknown;

  // provider 级降级：主 provider 因 401/403/5xx 不可用时，整体切到下一个
  for (const cred of credentialsList) {
    const candidates = buildModelCandidates(cred.model, cred.endpoint, hasImages);
    let switchProvider = false;

    for (const attemptModel of candidates) {
      for (let attempt = 0; attempt < RATE_LIMIT_MAX_RETRIES; attempt++) {
        try {
          const response = await fetchMiMo({
            endpoint: cred.endpoint,
            apiKey: cred.apiKey,
            model: attemptModel,
            messages,
            temperature: options?.temperature ?? 0.3,
            maxTokens: options?.maxTokens ?? 8192,
            signal: controller.signal,
          });

          const data: MiMoResponse = await response.json();
          clearTimeout(timeoutId);
          return data.choices[0]?.message?.content || '';
        } catch (err: any) {
          lastErr = err;
          const status = err?.status;
          const isTimeout =
            err?.name === 'AbortError' ||
            err?.name === 'TimeoutError' ||
            /timed out|aborted|UPSTREAM_NO_DATA/i.test(String(err?.message || ''));
          if (status === 429 || isTimeout) {
            // 限流或上游挂起：指数退避后重试同一模型
            const backoff = Math.min(15_000 * (attempt + 1), 60_000);
            await sleep(backoff);
            continue;
          }
          if (status === 400 && /Unsupported model/i.test(err?.body ?? '')) {
            // 模型名无效：跳出到下一个回退模型
            break;
          }
          if (isProviderFailure(status)) {
            // 供应商不可用（403 workspace denied / 401 / 5xx）：切到备用 provider
            console.warn(
              `[AI] provider ${cred.endpoint} returned ${status}, switching to next provider`
            );
            switchProvider = true;
            break;
          }
          clearTimeout(timeoutId);
          throw err; // 其他错误不重试
        }
      }
      if (switchProvider) break;
    }
  }

  clearTimeout(timeoutId);
  throw lastErr instanceof Error ? lastErr : new Error('All AI providers and models failed');
}

/**
 * Call MiMo with streaming. Supports optional modelConfig override and multimodal images.
 *
 * Same resilience as {@link callMiMo}: 429 backoff + unsupported-model fallback +
 * provider-level fallback. When `images` are present, auto-switches to the VL model
 * (mimo-v2.5) and sends a multimodal content array, mirroring {@link callMiMo}.
 */
export async function callMiMoStream(
  systemPrompt: string,
  userMessage: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    modelConfig?: ModelConfig;
    /** Base64-encoded PNG images (without data: prefix) for multimodal input */
    images?: string[];
  },
): Promise<ReadableStream<{ content?: string; reasoning?: string }>> {
  const hasImages = options?.images && options.images.length > 0;

  // When images are present, auto-switch to vision model (mirrors callMiMo)
  const dbConfig = await getAiConfig();
  const VL_MODEL = dbConfig.vlModel || process.env.VL_MODEL || 'mimo-v2.5';
  const effectiveModelConfig =
    hasImages && !options?.modelConfig?.model
      ? { ...options?.modelConfig, model: VL_MODEL }
      : options?.modelConfig;

  const credentialsList = await resolveCredentialCandidates(effectiveModelConfig);

  // Build user message: plain text or multimodal array
  let userContent: string | MultimodalContent[];
  if (hasImages) {
    const parts: MultimodalContent[] = [{ type: 'text', text: userMessage }];
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

  let lastErr: unknown;

  // 与 callMiMo 一致：provider 级降级 + 模型级降级
  for (const cred of credentialsList) {
    const candidates = buildModelCandidates(cred.model, cred.endpoint, hasImages);
    let switchProvider = false;

    for (const attemptModel of candidates) {
      for (let attempt = 0; attempt < RATE_LIMIT_MAX_RETRIES; attempt++) {
        const bodyAbort = new AbortController();
        let noDataTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          const response = await fetchMiMo({
            endpoint: cred.endpoint,
            apiKey: cred.apiKey,
            model: attemptModel,
            messages,
            temperature: options?.temperature ?? 0.3,
            maxTokens: options?.maxTokens ?? 4096,
            stream: true,
            signal: bodyAbort.signal,
          });

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        // 无数据看门狗：连接已建立但长时间无 token → 主动中断，fail-fast 而非挂起 34min
        const armWatchdog = () => {
          if (noDataTimer) clearTimeout(noDataTimer);
          noDataTimer = setTimeout(() => bodyAbort.abort(), UPSTREAM_NO_DATA_TIMEOUT_MS);
        };
        armWatchdog();

        return new ReadableStream<{ content?: string; reasoning?: string }>({
          async start(controller) {
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                armWatchdog(); // 收到数据 → 重置看门狗
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
                    const delta = parsed.choices?.[0]?.delta;
                    if (delta?.content) controller.enqueue({ content: delta.content });
                    if (delta?.reasoning_content) controller.enqueue({ reasoning: delta.reasoning_content });
                  } catch {
                    // skip malformed JSON chunks
                  }
                }
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            } finally {
              if (noDataTimer) clearTimeout(noDataTimer);
            }
          },
        });
      } catch (err: any) {
        if (noDataTimer) clearTimeout(noDataTimer);
        lastErr = err;
        const status = err?.status;
        // 限流(429)或被上游挂起(无数据超时 / abort)→ 退避后重试同一模型，而非挂起 34min
        const isTimeout =
          err?.name === 'AbortError' ||
          err?.name === 'TimeoutError' ||
          /timed out|aborted|UPSTREAM_NO_DATA/i.test(String(err?.message || ''));
        if (status === 429 || isTimeout) {
          const backoff = Math.min(15_000 * (attempt + 1), 60_000);
          if (isTimeout) {
            console.warn(
              `[AI] provider ${cred.endpoint} model ${attemptModel} hung (no data ${UPSTREAM_NO_DATA_TIMEOUT_MS}ms) — retry ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES} in ${backoff}ms`
            );
          }
          await sleep(backoff);
          continue;
        }
        if (status === 400 && /Unsupported model/i.test(err?.body ?? '')) {
          break;
        }
        if (isProviderFailure(status)) {
          console.warn(
            `[AI] provider ${cred.endpoint} returned ${status}, switching to next provider`
          );
          switchProvider = true;
          break;
        }
        throw err;
      }
      }
      if (switchProvider) break;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('All AI providers and models failed');
}
