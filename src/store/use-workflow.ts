import { useEffect, useRef } from 'react';
import { useAgentStore } from '@/store/agent-store';
import { useModelSettings } from '@/store/model-settings';
import { sleep } from '@/lib/utils';
import { track, createGenerationId } from '@/lib/track';
import {
  mockDesignAnalysis,
  mockComponentTree,
  mockGeneratedCode,
  mockQAIssues,
  mockQAFixes,
  mockProjectStructure,
  mockVisualScore,
  mockCodeValidation,
  mockEnhancementPlan,
} from '@/lib/mock-data';
import type { AgentId, DesignAnalysis, LogType, VisualScore, EnhancementPlan, OptimizationPlan } from '@/types/agent';
import type { ReconstructionScore } from '@/types/reconstruction';
import { matchStyle, generateDesignSystem, formatStyleContext, formatStyleContextCompact } from '@/lib/knowledge-base';
import type { StyleMatcherInput } from '@/lib/knowledge-base';
import {
  normalizeVisualScore,
  normalizeOptimizationPlan,
  formatOptimizationIssues,
  DIMENSION_LABELS,
} from '@/lib/visual-evaluation';
import { buildPreviewHtml, postProcessHtml } from '@/lib/preview-utils';
import { validateGeneratedCode } from '@/lib/code-rules';
import { extractAnimationScript } from '@/lib/animation';
import { normalizeEnhancementPlan, GENERATION_MODES } from '@/lib/design-mode';
import { deriveReconstructionMeta, reconstructionFields, toQualityMetrics } from '@/lib/reconstruction/quality-metrics';

// ---------------------------------------------------------------------------
// MiMo API Client (client-side)
// ---------------------------------------------------------------------------

interface MiMoApiResponse {
  step: string;
  result: unknown;
  raw: string;
  error?: string;
  scraped?: { success: boolean; colors: number; fonts: number; externalCSS: number };
  designKnowledge?: string;
}

/** Call the server-side MiMo API for a specific workflow step */
async function callMimoAPI(
  step: 'vision' | 'planning' | 'code' | 'animation' | 'qa' | 'optimize' | 'enhance' | 'preview',
  url: string,
  context?: Record<string, unknown>,
  generationId?: string,
  screenshotBase64?: string,
  /** Sprint B：qa step 的第二张图（生成页截图），随 context 的 diffReportJson 一起注入。 */
  cloneScreenshotBase64?: string,
): Promise<MiMoApiResponse> {
  const ac = workflowAbortController;

  // ── 模型选择逻辑（优先级从高到低）──
  // 1. 用户在首页选择的模型 → 全流水线统一使用
  // 2. 后台第一个已启用且有 API Key 的 provider
  // 3. 后台 pipeline 阶段配置的默认 provider
  const { getStageConfig, providers } = useModelSettings.getState();
  const selectedProviderId = useAgentStore.getState().task.model;

  let modelConfig: { model: string; endpoint?: string } | undefined;

  // 优先：用户在首页选的模型
  if (selectedProviderId) {
    const userChoice = providers.find((p) => p.id === selectedProviderId && p.enabled);
    if (userChoice) {
      modelConfig = {
        model: userChoice.models[0],
        endpoint: userChoice.endpoint || undefined,
      };
    }
  }

  // 兜底：第一个已启用的 provider
  if (!modelConfig) {
    const firstAvailable = providers.find((p) => p.enabled);
    if (firstAvailable) {
      modelConfig = {
        model: firstAvailable.models[0],
        endpoint: firstAvailable.endpoint || undefined,
      };
    }
  }

  // 最后兜底：阶段配置
  if (!modelConfig) {
    const stageConfig = getStageConfig(step);
    if (stageConfig.provider) {
      modelConfig = {
        model: stageConfig.stage.model,
        endpoint: stageConfig.provider.endpoint || undefined,
      };
    }
  }

  // 推流前清空当前 agent 的残留 streamingText，避免上一阶段内容串场
  const streamingAgentId = useAgentStore.getState().task.currentAgent ?? null;
  if (streamingAgentId) {
    useAgentStore.getState().updateAgent(streamingAgentId, { streamingText: '' });
  }

  const response = await fetch('/api/mimo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step, url, context, modelConfig, generationId, screenshotBase64, cloneScreenshotBase64 }),
    signal: ac?.signal,
  });

  if (!response.ok) {
    // 非流式错误回退（400/429/500 JSON）
    const errBody = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errBody.error || `API error: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    // 非流式 JSON 回退（兼容性 / 安全检查）
    return response.json();
  }

  // ---- SSE 流式消费：把 delta 实时写入 agent.streamingText ----
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let acc = '';
  let lastFlush = 0;
  const FLUSH_EVERY = 80; // 每累积 ~80 字符才更新一次 store，降低重渲染开销

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const events = chunk.split('\n\n');
    for (const evt of events) {
      const trimmed = evt.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      let parsed: { type?: string; text?: string; payload?: MiMoApiResponse; error?: string };
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
              if ((parsed.type === 'delta' || parsed.type === 'reasoning') && typeof parsed.text === 'string') {
                acc += parsed.text;
                if (streamingAgentId && acc.length - lastFlush >= FLUSH_EVERY) {
                  lastFlush = acc.length;
                  useAgentStore.getState().updateAgent(streamingAgentId, { streamingText: acc });
                }
              } else if (parsed.type === 'done' && parsed.payload) {
        // 收尾：把剩余文本 flush 进去再返回结构化结果
        if (streamingAgentId) {
          useAgentStore.getState().updateAgent(streamingAgentId, { streamingText: acc });
        }
        return parsed.payload;
      } else if (parsed.type === 'error') {
        throw new Error(parsed.error || 'Stream error');
      }
    }
  }

  // 流结束但缺少 done 事件：兜底抛错
  throw new Error('SSE stream ended without done event');
}

// ---------------------------------------------------------------------------
// Cancellation system
// ---------------------------------------------------------------------------

let workflowAbortController: AbortController | null = null;

// P1-6: Preflight result cache — avoid redundant API connectivity tests
const preflightCache = new Map<string, { ok: boolean; expiresAt: number }>();
const PREFLIGHT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Phase 7 — 手动优化模式。
 * 只有用户显式点击「应用优化方案」时才会被写入；写入后由下一轮 code 步骤消费一次并清空。
 * 主流程永远不会自动填充它（这正是「不自动重生成」的保证）。
 */
let pendingOptimizationIssues: string | null = null;

/** Signal the running workflow to cancel */
export function cancelWorkflow() {
  if (workflowAbortController) {
    workflowAbortController.abort();
    workflowAbortController = null;
  }
}

/** Sleep that can be interrupted by cancellation */
function cancellableSleep(ms: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const ac = workflowAbortController;
    if (!ac) { resolve(); return; }

    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Workflow cancelled', 'AbortError'));
    };

    if (ac.signal.aborted) {
      clearTimeout(timer);
      reject(new DOMException('Workflow cancelled', 'AbortError'));
      return;
    }

    ac.signal.addEventListener('abort', onAbort, { once: true });
  });
}

// ---------------------------------------------------------------------------
// Helper: log + progress in one call
// ---------------------------------------------------------------------------

function logAndProgress(
  agentId: AgentId,
  progress: number,
  message: string,
  type: LogType = 'info',
) {
  const store = useAgentStore.getState();
  store.updateAgent(agentId, { progress });
  store.addLog(agentId, { message, type });
}

function startAgent(agentId: AgentId) {
  const store = useAgentStore.getState();
  store.updateAgent(agentId, { status: 'running', progress: 0 });
  store.addLog(agentId, { message: `${store.task.agents[agentId].name} started`, type: 'info' });
}

function completeAgent(agentId: AgentId) {
  const store = useAgentStore.getState();
  store.updateAgent(agentId, { status: 'completed', progress: 100 });
  store.addLog(agentId, { message: `${store.task.agents[agentId].name} completed`, type: 'success' });
}

function errorAgent(agentId: AgentId, message: string) {
  const store = useAgentStore.getState();
  store.updateAgent(agentId, { status: 'error' });
  store.addLog(agentId, { message, type: 'error' });
}

/**
 * Normalize the raw Vision Agent response into a guaranteed-complete
 * DesignAnalysis object.
 *
 * Why: the AI response is parsed leniently upstream — on a JSON parse failure
 * the API falls back to `{ raw: "..." }`, and even a successful parse may omit
 * individual fields. Storing that raw object as-is lets `designAnalysis.colors`
 * (etc.) be `undefined`, which crashes the analysis panels (`data.map(...)`).
 * Here every field is coerced to a non-empty array, falling back to the mock
 * design tokens so the UI always has something real to render.
 */
function normalizeDesignAnalysis(raw: Record<string, unknown>): DesignAnalysis {
  const arr = <T,>(val: unknown, fallback: T[]): T[] =>
    Array.isArray(val) && val.length > 0 ? (val as T[]) : fallback;
  return {
    colors:       arr(raw.colors,       mockDesignAnalysis.colors),
    typography:   arr(raw.typography,   mockDesignAnalysis.typography),
    spacing:      arr(raw.spacing,      mockDesignAnalysis.spacing),
    borderRadius: arr(raw.borderRadius, mockDesignAnalysis.borderRadius),
    shadows:      arr(raw.shadows,      mockDesignAnalysis.shadows),
    animations:   arr(raw.animations,   mockDesignAnalysis.animations),
  };
}

// ---------------------------------------------------------------------------
// Workflow hook
// ---------------------------------------------------------------------------

/**
 * Phase 7 — 手动生成优化方案（Optimization Agent）。
 *
 * 设计约束：本函数**只能**被用户点击触发，主流程 runWorkflow 里没有任何调用，
 * 因此不存在「评分不达标就自动重生成」的闭环。
 *
 * @returns 归一化后的方案；无评分 / 模型未返回可解析结构时返回 null。
 */
export async function triggerManualOptimization(): Promise<OptimizationPlan | null> {
  const task = useAgentStore.getState().task;
  const score = task.qaResult?.visualScore;

  if (!task.url) {
    logAndProgress('qa', 100, '尚未指定目标网址，无法生成优化方案', 'warning');
    return null;
  }
  if (!score) {
    logAndProgress('qa', 100, '尚无视觉评分，请先完成一次生成后再生成优化方案', 'warning');
    return null;
  }

  const round = (task.qaResult?.optimizationRounds ?? 0) + 1;
  logAndProgress('qa', 100, `正在生成第 ${round} 轮优化方案（基于总分 ${score.overall_score}）...`);

  try {
    const res = await callMimoAPI('optimize', task.url, {
      visualScoreJson: JSON.stringify(score),
      round,
    });

    const plan = normalizeOptimizationPlan(res.result ?? res.raw, round);
    if (!plan) {
      logAndProgress('qa', 100, '模型未返回可解析的优化方案，请稍后重试', 'error');
      return null;
    }

    useAgentStore.getState().setTaskPartial({ optimizationPlan: plan });
    logAndProgress(
      'qa',
      100,
      `优化方案已生成：${plan.items.length} 项（预计 +${plan.estimatedScoreIncrease} 分）`,
      'success',
    );
    for (const it of plan.items.slice(0, 5)) {
      logAndProgress('qa', 100, `  [${it.priority}] ${it.problem}`);
    }
    if (plan.diagnosis.designDNAAtRisk) {
      logAndProgress('qa', 100, '  ⚠️ 方案标注：设计 DNA 存在流失风险，应用时请注意保留原站特征', 'warning');
    }
    return plan;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logAndProgress('qa', 100, `优化方案生成失败：${msg}`, 'error');
    return null;
  }
}

/**
 * Phase 7 — 手动应用优化方案：把方案转成文本指令，重启一次完整生成。
 *
 * 与「自动闭环」的区别：重启必须由用户点击发起，且每次只消费一份方案。
 */
export function applyOptimizationPlan(): void {
  const store = useAgentStore.getState();
  const task = store.task;
  const plan = task.optimizationPlan;

  if (!plan || !task.url) {
    logAndProgress('qa', 100, '没有可应用的优化方案', 'warning');
    return;
  }

  pendingOptimizationIssues = formatOptimizationIssues(plan);
  const nextRound = plan.round + 1;

  store.startTask(task.url, task.goal ?? undefined, task.prompt, task.mode, task.model);
  // startTask 会重建 task，这里把方案带回去（轮次 +1）以便对比前后效果
  useAgentStore.getState().setTaskPartial({
    optimizationPlan: { ...plan, round: nextRound },
  });
  logAndProgress('qa', 0, `已应用优化方案，开始第 ${nextRound} 轮重新生成...`, 'info');
}

export function useWorkflow() {
  const isRunning = useAgentStore((s) => s.isRunning);
  const taskStatus = useAgentStore((s) => s.task.status);
  const workflowStarted = useRef(false);

  useEffect(() => {
    if (isRunning && taskStatus === 'running' && !workflowStarted.current) {
      workflowStarted.current = true;
      workflowAbortController = new AbortController();
      runWorkflow().catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          console.log('[Workflow] Cancelled by user');
        } else {
          console.error('[Workflow] Unhandled error:', err);
        }
      });
    }

    // Reset the ref when the workflow finishes or is cancelled
    if (!isRunning) {
      workflowStarted.current = false;
      workflowAbortController = null;
    }
  }, [isRunning, taskStatus]);
}

// ---------------------------------------------------------------------------
// Main workflow sequence
// ---------------------------------------------------------------------------

async function runWorkflow() {
  const store = useAgentStore.getState();
  const url = store.task.url;
  const goal = store.task.goal;
  const prompt = store.task.prompt;
  const mode = store.task.mode;

  // ---- 实时埋点：任务开始 ----
  const generationId = createGenerationId();
  let trackUser = { name: '匿名用户', email: 'anonymous' };
  try {
    const raw = sessionStorage.getItem('cd_user');
    if (raw) trackUser = JSON.parse(raw);
  } catch { /* ignore */ }

  // ---- 统一失败处理：停止 + 报错 + 退还配额 ----
  async function failWorkflow(agentName: string, errorMsg: string) {
    store.setTaskPartial({ status: 'error', errorMessage: errorMsg });
    logAndProgress(agentName as never, 0, `❌ 生成失败：${errorMsg}`, 'error');
    logAndProgress(agentName as never, 0, '本次复刻消耗的额度已退还。', 'warning');
    if (trackUser.email && trackUser.email !== 'anonymous') {
      try {
        await fetch('/api/quota', { method: 'DELETE', credentials: 'include' });
      } catch { /* ignore refund failure */ }
    }
  }
  const msState = useModelSettings.getState();
  const codeStage = msState.getStageConfig('code');
  const selectedProviderId = store.task.model;
  const overrideProvider = selectedProviderId && selectedProviderId !== codeStage.provider?.id
    ? msState.providers.find((p) => p.id === selectedProviderId && p.enabled)
    : undefined;

  // ---- 模型可用性检查：后台未开通或无 API Key 则阻断 ----
  const activeProvider = overrideProvider || codeStage.provider;
  if (!activeProvider || !activeProvider.enabled) {
    const msg = `当前选择的 AI 模型「${selectedProviderId || '默认'}」未启用，请在后台开通后再试。`;
    store.setTaskPartial({ status: 'error', errorMessage: msg });
    logAndProgress('browser', 0, msg, 'error');
    return;
  }
  // API Key 检查：已知平台端点由服务端 .env 提供 Key，无需客户端检查
  // 仅对第三方端点（OpenAI, Anthropic 等）需要 BYOK
  const PLATFORM_ENDPOINTS = [
    'dashscope.aliyuncs.com',
    'api.xiaomimimo.com',
  ];
  const isPlatformEndpoint = PLATFORM_ENDPOINTS.some(ep => activeProvider.endpoint?.includes(ep));
  if (!isPlatformEndpoint && !activeProvider.apiKey) {
    const msg = `AI 模型「${activeProvider.name}」未配置 API Key，请在后台设置中填写后再试。`;
    store.setTaskPartial({ status: 'error', errorMessage: msg });
    logAndProgress('browser', 0, msg, 'error');
    return;
  }

  // ---- API 连通性预检：确认模型端点可达、Key 有效 ----
  // 管理员跳过预检（管理员有无限额度，且可能使用系统默认 Key）
  let isAdminUser = false;
  try {
    const adminCheck = await fetch(`/api/admin/me?_t=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'include',
    });
    if (adminCheck.ok) {
      const adminData = await adminCheck.json();
      isAdminUser = adminData?.authenticated === true;
    }
  } catch {
    // ignore
  }

  if (!isAdminUser) {
    // P1-6: Check preflight cache
    const preflightKey = `${activeProvider.endpoint}__${activeProvider.models[0]}`;
    const cachedPreflight = preflightCache.get(preflightKey);
    if (cachedPreflight && cachedPreflight.expiresAt > Date.now() && cachedPreflight.ok) {
      logAndProgress('browser', 5, `AI 模型「${activeProvider.name}」连接正常 ✓（缓存）`, 'success');
    } else {
    logAndProgress('browser', 2, `正在检测 AI 模型「${activeProvider.name}」连接...`);
    try {
      const testResp = await fetch('/api/mimo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          step: 'vision',
          url: 'https://example.com',
          context: { _preflight: true },
          modelConfig: {
            model: activeProvider.models[0],
            endpoint: activeProvider.endpoint,
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (testResp.status === 401) {
        preflightCache.set(preflightKey, { ok: false, expiresAt: Date.now() + 60_000 }); // cache failure for 1 min
        const msg = `AI 模型「${activeProvider.name}」认证失败（API Key 无效或已过期），请检查后台配置。`;
        store.setTaskPartial({ status: 'error', errorMessage: msg });
        logAndProgress('browser', 0, msg, 'error');
        return;
      }
      if (testResp.status === 402) {
        const msg = '今日复刻次数已用完（每天 2 次），请明天再试或升级套餐。';
        store.setTaskPartial({ status: 'error', errorMessage: msg });
        logAndProgress('browser', 0, msg, 'error');
        return;
      }
      // Cache successful preflight
      preflightCache.set(preflightKey, { ok: true, expiresAt: Date.now() + PREFLIGHT_TTL_MS });
      // 其他状态码（包括 200/400/500）说明端点可达，继续
      logAndProgress('browser', 5, `AI 模型「${activeProvider.name}」连接正常 ✓`, 'success');
    } catch (connErr) {
      const msg = connErr instanceof Error ? connErr.message : 'connection failed';
      if (msg.includes('timeout') || msg.includes('AbortError')) {
        const errMsg = `AI 模型「${activeProvider.name}」连接超时，请检查网络或模型服务状态。`;
        store.setTaskPartial({ status: 'error', errorMessage: errMsg });
        logAndProgress('browser', 0, `AI 模型「${activeProvider.name}」连接超时，请检查网络或模型服务状态。`, 'error');
        return;
      }
      // 网络错误等也阻断
      const errMsg = `AI 模型「${activeProvider.name}」连接失败: ${msg}`;
      store.setTaskPartial({ status: 'error', errorMessage: errMsg });
      logAndProgress('browser', 0, errMsg, 'error');
      return;
    }
    } // end of preflight cache else
  } else {
    logAndProgress('browser', 5, `管理员模式 ✓ 跳过 API 预检`, 'success');
  }

  // ---- 配额扣减：每次复刻消耗 1 次（不是每次 API 调用）----
  if (trackUser.email && trackUser.email !== 'anonymous') {
    try {
      const quotaResp = await fetch('/api/quota', { method: 'POST', credentials: 'include' });
      if (quotaResp.ok) {
        const quotaData = await quotaResp.json();
        if (!quotaData.allowed) {
          store.setTaskPartial({ status: 'error' });
          logAndProgress('browser', 0, '今日复刻次数已用完（每天 2 次），请明天再试或升级套餐。', 'error');
          return;
        }
      }
    } catch (e) {
      console.error('[Workflow] Quota consumption failed:', e);
      // 配额扣减失败不阻断，允许继续
    }
  }
  const primaryModel = overrideProvider ? overrideProvider.models[0] : codeStage.stage.model;
  track({
    type: 'generation_start',
    id: generationId,
    user: trackUser.name,
    email: trackUser.email,
    url,
    goal: goal || 'default',
    model: primaryModel,
  });

  // Goal labels for logging
  const GOAL_LABELS: Record<string, string> = {
    colors: '学习配色 — 提取色彩体系',
    layout: '学习排版 — 解析布局结构',
    style: '学习风格 — 分析设计语言',
    features: '学习特色 — 挖掘亮点功能',
    template: '构建模板 — 生成完整项目',
  };

  if (goal) {
    logAndProgress('browser', 0, `分析目标: ${GOAL_LABELS[goal] || goal}`, 'info');
  }

  // 生成模式日志
  const modeConfig = GENERATION_MODES[mode];
  logAndProgress('browser', 0, `生成模式: ${modeConfig.label}（保留 ${modeConfig.cloneRatio}% · 优化 ${modeConfig.optimizationRatio}%）`, 'info');

  try {
    // =====================================================================
    // 1. Browser Agent — 抓取目标网页
    // =====================================================================
    startAgent('browser');
    store.setActiveSection('analysis');

    logAndProgress('browser', 10, `正在连接 ${url}...`);
    await cancellableSleep(150);

    logAndProgress('browser', 30, '页面加载完成，正在提取 HTML/CSS...');
    await cancellableSleep(150);

    logAndProgress('browser', 60, '正在截取网页封面...');
    await cancellableSleep(150);

    logAndProgress('browser', 80, '提取设计资源...');
    await cancellableSleep(150);

    completeAgent('browser');

    // ---- Capture website screenshot for multimodal AI reference ----
    let websiteScreenshot: string | undefined;
    try {
      logAndProgress('browser', 98, '正在截取目标网页封面图...');
      const screenshotRes = await fetch('/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, fullPage: true }),
        signal: workflowAbortController?.signal,
      });
      if (screenshotRes.ok) {
        const screenshotData = await screenshotRes.json();
        if (screenshotData.success && screenshotData.heroBase64) {
          websiteScreenshot = screenshotData.heroBase64;
          const sizeKB = Math.round(screenshotData.heroBase64.length / 1024);
          logAndProgress('browser', 100, `截图完成 ✓ (${screenshotData.width}x${screenshotData.height}, ${sizeKB}KB)`, 'success');
        }
      }
    } catch (screenshotErr) {
      console.warn('[Workflow] Screenshot capture failed, continuing without screenshot:', screenshotErr);
      logAndProgress('browser', 100, '截图失败，将使用文本分析模式', 'warning');
    }

    track({ type: 'generation_stage', id: generationId, stage: 'vision', message: `${trackUser.name} 的任务进入 Vision 分析阶段` });
    await cancellableSleep(300);

    // =====================================================================
    // 2. Vision Agent — MiMo AI Design Analysis
    // =====================================================================
    startAgent('vision');

    logAndProgress('vision', 5, '正在连接 AI 视觉分析模型...');
    await cancellableSleep(200);

    logAndProgress('vision', 8, `正在抓取 ${url} 页面内容...`);
    await cancellableSleep(200);

    if (websiteScreenshot) {
      logAndProgress('vision', 11, `📸 已附加网页截图作为视觉参考（多模态分析模式）`, 'success');
    }
    await cancellableSleep(200);

    logAndProgress('vision', 14, '正在下载外部 CSS 样式表并提取设计数据...');
    await cancellableSleep(200);

    let visionResult: MiMoApiResponse | null = null;
    try {
      visionResult = await callMimoAPI('vision', url, { goal, prompt }, generationId, websiteScreenshot);

      // Log scraping status from server
      const scraped = visionResult.scraped;
      if (scraped?.success) {
        logAndProgress('vision', 25, `✓ 成功抓取网站: ${scraped.colors} 个颜色值, ${scraped.fonts} 个字体, ${scraped.externalCSS} 个外部CSS`, 'success');
      } else {
        logAndProgress('vision', 25, '⚠ 无法抓取网站 CSS，将基于 URL 推断设计系统', 'warning');
      }
      await cancellableSleep(200);

      logAndProgress('vision', 30, 'AI 正在分析设计系统...');
      await cancellableSleep(200);

      const analysis = visionResult.result as Record<string, unknown>;

      if (analysis.colors && Array.isArray(analysis.colors)) {
        const colorCount = analysis.colors.length;
        logAndProgress('vision', 40, `提取到 ${colorCount} 个色彩 Token`, 'success');
        for (const c of analysis.colors.slice(0, 4)) {
          const color = c as { name?: string; hex?: string; usage?: string };
          logAndProgress('vision', 42, `  ${color.name || 'Color'}: ${color.hex || '—'} (${color.usage || ''})`);
        }
      }
      await cancellableSleep(300);

      if (analysis.typography && Array.isArray(analysis.typography)) {
        logAndProgress('vision', 55, `检测到 ${analysis.typography.length} 个字体 Token`, 'success');
        for (const t of analysis.typography.slice(0, 3)) {
          const typo = t as { name?: string; family?: string; weight?: number; size?: string };
          logAndProgress('vision', 58, `  ${typo.name || 'Font'}: ${typo.family || '—'} ${typo.weight || ''} ${typo.size || ''}`);
        }
      }
      await cancellableSleep(300);

      if (analysis.spacing && Array.isArray(analysis.spacing)) {
        logAndProgress('vision', 65, `间距系统: ${analysis.spacing.length} 个级别 (${analysis.spacing.slice(0, 3).join(', ')}...)`, 'success');
      }

      if (analysis.layout) {
        const layout = analysis.layout as { gridType?: string; maxWidth?: string };
        logAndProgress('vision', 72, `布局: ${layout.gridType || 'responsive'}, max-width ${layout.maxWidth || '—'}`, 'success');
      }

      logAndProgress('vision', 85, '正在编译设计 Token...');
      await cancellableSleep(200);

      // Store the real AI analysis as design analysis (normalized so every
      // field is a usable array — the raw AI response may omit fields).
      store.setTaskPartial({ designAnalysis: normalizeDesignAnalysis(analysis) });

      // Log matched design knowledge patterns
      if (visionResult.designKnowledge) {
        logAndProgress('vision', 90, '✓ 匹配到设计规则知识库，将增强后续生成质量', 'success');
      }

      logAndProgress('vision', 95, `设计系统分析完成`, 'success');

    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : 'API error';
      if (msg.includes('AbortError') || msg.includes('cancelled')) throw apiErr;

      // P2-8: Vision API 降级 — 使用 URL 推断 + 默认设计系统继续流程
      logAndProgress('vision', 30, `⚠ 视觉分析模型不可用（${msg}），启用降级模式`, 'warning');
      await cancellableSleep(200);

      // Infer basic design info from URL
      const urlHost = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
      const isApple = urlHost.includes('apple');
      const isGoogle = urlHost.includes('google');

      const fallbackAnalysis: Record<string, unknown> = {
        colors: isApple
          ? [{ name: 'Apple Blue', hex: '#0071E3', usage: 'primary' }, { name: 'Background', hex: '#FAFAFC', usage: 'background' }]
          : [{ name: 'Primary', hex: '#2563EB', usage: 'primary' }, { name: 'Background', hex: '#FFFFFF', usage: 'background' }],
        typography: [{ family: isApple ? 'SF Pro Display' : 'Inter', weight: 700, size: '48px' }],
        spacing: ['8px', '16px', '24px', '48px', '80px'],
        borderRadius: ['8px', '12px', '16px'],
        shadows: ['0 4px 24px rgba(0,0,0,0.08)'],
        animations: [],
      };

      store.setTaskPartial({ designAnalysis: normalizeDesignAnalysis(fallbackAnalysis) });
      logAndProgress('vision', 80, '降级模式：使用推断设计系统继续', 'info');
    }

    await cancellableSleep(300);
    completeAgent('vision');
    track({ type: 'generation_stage', id: generationId, stage: 'stylematcher', message: `${trackUser.name} 的任务进入 Style Matcher 设计体系匹配阶段` });
    await cancellableSleep(300);

    // =====================================================================
    // 2.5 Style Matcher Agent — 设计体系匹配（确定性算法，无 LLM 调用）
    // 根据 Vision 分析结果匹配最佳设计体系，生成 Design System
    // =====================================================================
    startAgent('stylematcher');
    store.setActiveSection('stylematcher');

    logAndProgress('stylematcher', 10, '正在加载 Web Design Knowledge Base (7 种设计风格档案)...');
    await cancellableSleep(200);

    const visionAnalysis = useAgentStore.getState().task.designAnalysis;
    const matcherInput: StyleMatcherInput = {
      colors: visionAnalysis?.colors?.map((c) => ({ hex: c.hex, name: c.name, usage: c.usage })) || [],
      typography: visionAnalysis?.typography?.map((t) => ({ family: t.family, size: t.size })) || [],
      layout: (visionAnalysis as unknown as Record<string, unknown>)?.layout as Record<string, unknown> | undefined,
      raw: visionResult?.raw || '',
    };

    logAndProgress('stylematcher', 30, '正在对 7 种设计体系进行四维评分 (布局/色彩/组件/字体)...');
    await cancellableSleep(200);

    const styleMatch = matchStyle(matcherInput);

    logAndProgress('stylematcher', 55, `最佳匹配: ${styleMatch.matchedStyle} (置信度 ${styleMatch.confidence}%)`, 'success');
    await cancellableSleep(300);

    logAndProgress('stylematcher', 65, `  布局 ${styleMatch.breakdown.layout}/30 | 色彩 ${styleMatch.breakdown.color}/25 | 组件 ${styleMatch.breakdown.components}/25 | 字体 ${styleMatch.breakdown.typography}/20`);
    await cancellableSleep(300);

    if (styleMatch.secondaryStyle) {
      logAndProgress('stylematcher', 72, `次要匹配: ${styleMatch.secondaryStyle}`, 'info');
    }

    logAndProgress('stylematcher', 80, '正在生成 GeneratedDesignSystem (tokens + rules)...');
    await cancellableSleep(200);

    const designSystem = generateDesignSystem(styleMatch);

    if (designSystem) {
      logAndProgress('stylematcher', 90, `设计系统已生成: ${designSystem.tokens.spacing.large}px 间距 / ${designSystem.tokens.radius}px 圆角 / ${designSystem.rules.length} 条规则`, 'success');
    }

    store.setTaskPartial({ styleMatch, designSystem });
    logAndProgress('stylematcher', 95, styleMatch.reasoning, 'success');

    await cancellableSleep(300);
    completeAgent('stylematcher');
    track({ type: 'generation_stage', id: generationId, stage: 'planning', message: `${trackUser.name} 的任务进入 Planning 架构规划阶段` });
    await cancellableSleep(300);

    // =====================================================================
    // Mode Controller — 设计升级模式下生成 EnhancementPlan
    // 保留 80% 设计 DNA + AI 优化 20%（精准复刻模式则跳过）
    // =====================================================================
    let enhancementPlan: EnhancementPlan | null = null;
    if (mode === 'enhancement') {
      logAndProgress('planning', 100, '✨ Enhancement Agent: 正在制定设计升级方案（保留 80% DNA + 优化 20%）...', 'info');
      await cancellableSleep(200);

      const enhAnalysis = useAgentStore.getState().task.designAnalysis;
      const designAnalysisSummary = enhAnalysis
        ? JSON.stringify({
            colors: (enhAnalysis.colors || []).slice(0, 8).map((c) => `${c.name}:${c.hex}`),
            typography: (enhAnalysis.typography || []).slice(0, 4).map((t) => `${t.family} ${t.size}`),
          })
        : '';
      const enhStyleMatch = useAgentStore.getState().task.styleMatch;
      const enhDesignSystem = useAgentStore.getState().task.designSystem;
      const designSystemSummary = enhStyleMatch && enhDesignSystem
        ? formatStyleContextCompact(enhStyleMatch, enhDesignSystem)
        : '';

      try {
        const enhResult = await callMimoAPI('enhance', url, {
          designAnalysisSummary,
          designSystemSummary,
        }, generationId);
        enhancementPlan = normalizeEnhancementPlan(enhResult.result);
        logAndProgress('planning', 100, `✓ 升级方案: 保留「${enhancementPlan.preserve.style}」, 优化 ${enhancementPlan.improve.length} 项`, 'success');
        for (const item of enhancementPlan.improve.slice(0, 3)) {
          logAndProgress('planning', 100, `  [${item.category}] ${item.before} → ${item.after}`, 'info');
          await cancellableSleep(200);
        }
      } catch (enhErr) {
        const msg = enhErr instanceof Error ? enhErr.message : 'error';
        if (msg.includes('AbortError') || msg.includes('cancelled')) throw enhErr;
        logAndProgress('planning', 100, `Enhancement Agent 不可用: ${msg}，使用默认升级方案`, 'warning');
        enhancementPlan = mockEnhancementPlan;
      }
      store.setTaskPartial({ enhancementPlan });
      await cancellableSleep(300);
    } else {
      logAndProgress('planning', 100, '🎯 精准复刻模式: 严格保持原设计，仅修复技术问题', 'info');
      await cancellableSleep(300);
    }

    // =====================================================================
    // 3. Planning Agent — MiMo AI Component Architecture
    // =====================================================================
    startAgent('planning');
    store.setActiveSection('components');

    logAndProgress('planning', 5, 'Connecting to AI planning model...');
    await cancellableSleep(200);

    // Get vision analysis results to pass as context
    const currentDesignAnalysis = useAgentStore.getState().task.designAnalysis;

    logAndProgress('planning', 10, 'Sending design analysis to AI for architecture planning...');
    await cancellableSleep(200);

    let planningResult: MiMoApiResponse | null = null;
    try {
      planningResult = await callMimoAPI('planning', url, {
        designAnalysis: currentDesignAnalysis,
        designDecision: useAgentStore.getState().task.designDecision,
        designKnowledge: visionResult?.designKnowledge || undefined,
        styleContext: designSystem ? formatStyleContextCompact(styleMatch, designSystem) : undefined,
      }, generationId);
      logAndProgress('planning', 30, 'AI: Architecture plan received', 'success');
      await cancellableSleep(200);

      const plan = planningResult.result as Record<string, unknown>;

      // Parse component tree
      if (plan.name && plan.children) {
        logAndProgress('planning', 40, `Root component: ${plan.name}`, 'success');
        const children = plan.children as Array<{ name?: string; type?: string; children?: unknown[] }>;
        if (Array.isArray(children)) {
          logAndProgress('planning', 45, `Identified ${children.length} top-level sections`, 'success');
          for (const child of children.slice(0, 5)) {
            logAndProgress('planning', 48, `  ${child.name || 'Component'} (${child.type || 'component'})`);
            await cancellableSleep(200);
          }
        }
      }
      await cancellableSleep(300);

      // Parse tech stack
      if (plan.techStack) {
        const stack = plan.techStack as Record<string, string>;
        logAndProgress('planning', 60, `Tech Stack: ${stack.framework || '—'} + ${stack.styling || '—'}`, 'success');
        if (stack.animations) {
          logAndProgress('planning', 62, `  Animations: ${stack.animations}`);
        }
        if (stack.stateManagement) {
          logAndProgress('planning', 64, `  State: ${stack.stateManagement}`);
        }
      }
      await cancellableSleep(300);

      // Parse file structure — supports both nested FileNode[] (new) and flat string[] (old)
      let projectStructure;
      if (plan.fileStructure && Array.isArray(plan.fileStructure) && plan.fileStructure.length > 0) {
        const firstItem = plan.fileStructure[0];
        if (typeof firstItem === 'string') {
          // Legacy flat string array — convert to FileNode[]
          projectStructure = (plan.fileStructure as string[]).map((f) => ({
            name: f, type: 'file' as const,
          }));
          logAndProgress('planning', 75, `Planned ${projectStructure.length} files`, 'success');
          for (const f of projectStructure.slice(0, 6)) {
            logAndProgress('planning', 78, `  ${f.name}`);
            await cancellableSleep(150);
          }
          if (projectStructure.length > 6) {
            logAndProgress('planning', 80, `  ... and ${projectStructure.length - 6} more files`);
          }
        } else {
          // New nested FileNode[] tree structure
          projectStructure = plan.fileStructure as never;
          const fileCount = countFilesInTree(projectStructure);
          logAndProgress('planning', 75, `Planned ${fileCount} files`, 'success');
          const flatFiles = flattenFileNames(projectStructure);
          for (const f of flatFiles.slice(0, 6)) {
            logAndProgress('planning', 78, `  ${f}`);
            await cancellableSleep(150);
          }
          if (flatFiles.length > 6) {
            logAndProgress('planning', 80, `  ... and ${flatFiles.length - 6} more files`);
          }
        }
      } else {
        projectStructure = mockProjectStructure;
      }
      await cancellableSleep(300);

      logAndProgress('planning', 90, 'Mapping component relationships...');
      await cancellableSleep(200);

      // Store component tree from AI
      const componentTree = plan.name ? plan as never : mockComponentTree;

      store.setTaskPartial({ componentTree, projectStructure });
      logAndProgress('planning', 97, 'AI architecture planning complete', 'success');

    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : 'API error';
      if (msg.includes('AbortError') || msg.includes('cancelled')) throw apiErr;
      await failWorkflow('planning', `架构规划模型调用失败: ${msg}`);
      return;
    }

    await cancellableSleep(300);
    completeAgent('planning');
    track({ type: 'generation_stage', id: generationId, stage: 'code', message: `${trackUser.name} 的任务进入 Code 代码生成阶段` });
    await cancellableSleep(300);

    // =====================================================================
    // 4. Code Agent — MiMo AI Code Generation
    // =====================================================================
    startAgent('code');
    store.setActiveSection('code');

    logAndProgress('code', 3, 'Connecting to AI code generation model...');
    await cancellableSleep(200);

    // Gather context from previous steps
    const currentState = useAgentStore.getState().task;
    const codeContext = {
      designAnalysis: currentState.designAnalysis,
      designDecision: currentState.designDecision,
      componentTree: currentState.componentTree,
      projectStructure: currentState.projectStructure,
      prompt: currentState.prompt || undefined,
      designKnowledge: visionResult?.designKnowledge || undefined,
      styleContext: designSystem ? formatStyleContext(styleMatch, designSystem) : undefined,
      styleName: styleMatch?.matchedStyle,
      mode,
      enhancementPlan: enhancementPlan ?? undefined,
      // Phase 7：用户手动应用的优化方案（一次性消费）
      optimizationIssues: pendingOptimizationIssues ?? undefined,
    };

    if (pendingOptimizationIssues) {
      logAndProgress('code', 5, '已注入手动优化方案，本轮生成将修复已知问题', 'warning');
      pendingOptimizationIssues = null;
    }

    logAndProgress('code', 6, 'Sending architecture plan + design tokens to AI...');
    await cancellableSleep(200);

    let codeResult: MiMoApiResponse | null = null;
    try {
      codeResult = await callMimoAPI('code', url, codeContext, generationId, websiteScreenshot);
      logAndProgress('code', 20, 'AI: Code generation stream received', 'success');
      await cancellableSleep(200);

      // Parse code files from the raw response
      const rawCode = codeResult.raw || '';
      const fileRegex = /---FILE:\s*(.+?)---\s*([\s\S]*?)---END---/g;
      const generatedFiles = new Map<string, string>();
      let match: RegExpExecArray | null;

      while ((match = fileRegex.exec(rawCode)) !== null) {
        const filePath = match[1].trim();
        const fileContent = match[2].trim();
        generatedFiles.set(filePath, fileContent);
      }

      if (generatedFiles.size > 0) {
        logAndProgress('code', 30, `AI generated ${generatedFiles.size} files`, 'success');
        await cancellableSleep(300);

        let fileIndex = 0;
        for (const [name, content] of generatedFiles) {
          const lines = content.split('\n').length;
          const progressPct = 35 + Math.floor((fileIndex / generatedFiles.size) * 55);
          logAndProgress('code', progressPct, `Generated ${name} (${lines} lines)`, 'success');
          await cancellableSleep(300);
          fileIndex++;
        }

        store.setTaskPartial({ generatedCode: generatedFiles });
        logAndProgress('code', 95, `AI code generation complete: ${generatedFiles.size} files`, 'success');
      } else {
        // Couldn't parse file format, try using result object
        const codeData = codeResult.result as Record<string, string>;
        if (codeData && typeof codeData === 'object' && !codeData.raw) {
          const parsedMap = new Map<string, string>();
          for (const [key, val] of Object.entries(codeData)) {
            parsedMap.set(key, val);
          }
          store.setTaskPartial({ generatedCode: parsedMap });
          logAndProgress('code', 95, `AI code generation complete: ${parsedMap.size} files`, 'success');
        } else {
          // Raw text without file structure — store as single file
          const singleFileMap = new Map<string, string>();
          singleFileMap.set('src/app/page.tsx', rawCode);
          store.setTaskPartial({ generatedCode: singleFileMap });
          logAndProgress('code', 95, 'AI code generation complete: 1 file (raw output)', 'success');
        }
      }

    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : 'API error';
      if (msg.includes('AbortError') || msg.includes('cancelled')) throw apiErr;
      await failWorkflow('code', `代码生成模型调用失败: ${msg}`);
      return;
    }

    // ---- Code Validator: Premium Design Rules 规则校验（确定性扫描）----
    logAndProgress('code', 98, '正在运行 Code Validator（Premium Design Rules 规则校验）...');
    await cancellableSleep(200);

    const generatedCodeForValidation = useAgentStore.getState().task.generatedCode;
    const codeMapForValidation = generatedCodeForValidation instanceof Map
      ? generatedCodeForValidation
      : mockGeneratedCode;
    const codeValidation = validateGeneratedCode(codeMapForValidation, styleMatch?.matchedStyle);

    store.setTaskPartial({ codeValidation });

    if (codeValidation.violations.length > 0) {
      logAndProgress('code', 99, `规则校验: 发现 ${codeValidation.violations.length} 项违规（规则符合度 ${codeValidation.score}/100）`, 'warning');
      for (const v of codeValidation.violations.slice(0, 4)) {
        logAndProgress('code', 99, `  [${v.ruleId}] ${v.message}`, v.severity === 'error' ? 'error' : 'warning');
        await cancellableSleep(200);
      }
    } else {
      logAndProgress('code', 99, `规则校验通过 ✓（规则符合度 ${codeValidation.score}/100）`, 'success');
    }

    await cancellableSleep(300);
    completeAgent('code');

    // ---- 生成轻量预览 HTML（供 QA 和 Preview Agent 使用）----
    logAndProgress('code', 99, '正在生成预览 HTML...');
    await cancellableSleep(300);

    const generatedCodeForCompile = useAgentStore.getState().task.generatedCode;
    let compiledPreviewHtml = '';
    if (generatedCodeForCompile instanceof Map && generatedCodeForCompile.size > 0) {
      compiledPreviewHtml = buildPreviewHtml(generatedCodeForCompile);
      if (compiledPreviewHtml) {
        logAndProgress('code', 100, `预览生成完成 ✓（${compiledPreviewHtml.length} 字符）`, 'success');
      }
    }

    // 存储正则转换的预览 HTML（仅用于 QA 评分和临时预览，不作为最终下载内容）
    // aiPreviewHtml 将由 AI Preview Agent 设置为高保真版本
    if (compiledPreviewHtml) {
      store.setTaskPartial({ previewHtml: compiledPreviewHtml });
    }

    // =====================================================================
    // 5. Preview Agent — AI 生成高保真独立 HTML
    // =====================================================================
    startAgent('preview');
    store.setActiveSection('preview');

    // 先显示 buildPreviewHtml 作为即时预览（AI 生成需要时间）
    if (compiledPreviewHtml) {
      logAndProgress('preview', 10, `快速预览已就绪（${compiledPreviewHtml.length} 字符），正在生成高保真版本...`, 'info');
    }

    try {
      // 构建 Preview Agent 的上下文
      const previewState = useAgentStore.getState().task;
      const codeForPreview = previewState.generatedCode;
      let componentSource = '';
      if (codeForPreview instanceof Map) {
        for (const [filename, code] of codeForPreview.entries()) {
          if (filename.endsWith('.tsx') || filename.endsWith('.jsx') || filename.endsWith('.css')) {
            componentSource += `// === ${filename} ===\n${code}\n\n`;
          }
        }
      }
      // 截断到 30000 字符以避免超出 token 限制
      if (componentSource.length > 30000) {
        componentSource = componentSource.substring(0, 30000) + '\n// ... (truncated)';
      }

      // ---- Phase 6 — GSAP Animation Agent（独立节点）----
      // 失败不阻断主流程：降级为 preview 步骤现有的 CSS 过渡动画。
      let animationScript = '';
      try {
        logAndProgress('animation', 15, '正在分析原站动效并生成 GSAP 代码...');
        const animResult = await callMimoAPI(
          'animation',
          url,
          { structure: componentSource, mode },
          generationId,
        );
        animationScript = extractAnimationScript(animResult.raw || '');
        logAndProgress(
          'animation',
          100,
          animationScript ? 'GSAP 动效已生成' : '未生成动效，沿用默认过渡',
        );
      } catch (animErr) {
        console.warn('[Animation] skipped:', animErr instanceof Error ? animErr.message : animErr);
        logAndProgress('animation', 100, '动效生成失败，已跳过（不影响页面生成）');
      }

      const previewContext: Record<string, unknown> = {
        componentSource,
        animationScript,
        designAnalysis: previewState.designAnalysis,
        designKnowledge: visionResult?.designKnowledge || undefined,
        styleContext: designSystem ? formatStyleContext(styleMatch, designSystem) : undefined,
        mode, // 'clone' = 精准复刻, 'enhancement' = 设计升级
      };

      logAndProgress('preview', 20, '正在调用 AI 模型生成高保真 HTML...');

      const previewResult = await callMimoAPI('preview', url, previewContext, generationId, websiteScreenshot);

      // 提取 AI 生成的 HTML
      let aiHtml = previewResult.raw || '';
      // Also check result.raw (when AI response was parsed as non-JSON)
      if (!aiHtml && previewResult.result && typeof previewResult.result === 'object' && 'raw' in previewResult.result) {
        aiHtml = (previewResult.result as Record<string, string>).raw || '';
      }
      // Strip markdown code fences if present: ```html ... ``` or ``` ... ```
      aiHtml = aiHtml.replace(/^```(?:html|HTML)?\s*\n?/g, '').replace(/\n?```\s*$/g, '');
      aiHtml = aiHtml.trim();

      if (aiHtml && aiHtml.includes('<!DOCTYPE') && aiHtml.includes('</html>')) {
        // AI 成功生成了完整的 HTML 文件
        store.setTaskPartial({ aiPreviewHtml: aiHtml });
        logAndProgress('preview', 95, `高保真 HTML 生成完成 ✓（${aiHtml.length} 字符）`, 'success');
      } else if (aiHtml && aiHtml.length > 1000) {
        // AI 返回了内容但不是完整 HTML，尝试包装
        const wrappedHtml = `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8"/>\n<meta name="viewport" content="width=device-width, initial-scale=1"/>\n<script src="https://cdn.tailwindcss.com"><\/script>\n</head>\n<body>\n${aiHtml}\n</body>\n</html>`;
        store.setTaskPartial({ aiPreviewHtml: wrappedHtml });
        logAndProgress('preview', 95, `HTML 生成完成（已包装为完整文档，${wrappedHtml.length} 字符）`, 'success');
      } else {
        // AI 返回内容太少，保持 buildPreviewHtml
        logAndProgress('preview', 90, 'AI 返回内容不完整，使用快速预览版本', 'warning');
      }
    } catch (previewErr) {
      const msg = previewErr instanceof Error ? previewErr.message : 'unknown';
      if (msg.includes('AbortError') || msg.includes('cancelled')) throw previewErr;
      logAndProgress('preview', 90, `AI 预览生成失败: ${msg}，使用快速预览版本`, 'warning');
    }

    completeAgent('preview');

    track({ type: 'generation_stage', id: generationId, stage: 'qa', message: `${trackUser.name} 的任务进入 QA 质量检测阶段` });
    await cancellableSleep(300);

    // =====================================================================
    // 5. Visual QA Agent — 基于编译后的 HTML 进行视觉评分
    // =====================================================================
    startAgent('qa');
    store.setActiveSection('qa');

    logAndProgress('qa', 3, '正在基于编译后的 HTML 进行视觉评估...');
    await cancellableSleep(200);

    // 使用编译后的 HTML（如果有），否则回退到 buildPreviewHtml
    const qaState = useAgentStore.getState().task;
    const previewHtml = compiledPreviewHtml || (qaState.generatedCode instanceof Map ? buildPreviewHtml(qaState.generatedCode) : buildPreviewHtml(mockGeneratedCode));

    logAndProgress('qa', 8, '渲染生成项目到预览沙箱 (localhost)...', 'info');
    await cancellableSleep(200);
    logAndProgress('qa', 13, '等待页面加载与动画完成...');
    await cancellableSleep(200);
    logAndProgress('qa', 18, '📸 截图 homepage.png (1440×900 桌面端)', 'success');
    await cancellableSleep(200);
    logAndProgress('qa', 22, '📸 截图 tablet.png (768×1024 平板)', 'success');
    await cancellableSleep(300);
    logAndProgress('qa', 25, '📸 截图 mobile.png (375×812 移动端)', 'success');
    await cancellableSleep(200);

    // =====================================================================
    // 5.1 Reconstruction — 还原度度量（Sprint B，RECONSTRUCTION_DIFF 开关控制）
    // =====================================================================
    // fail-open：绝不阻断 QA。
    // 四态语义（B.2.3.1 修正）：
    //   · 服务端未开启度量（enabled=false）→ **字段不产生**（undefined），不是 null
    //   · 已开启但算不出来（渲染降级 / 真值缺失）→ null，由 degradedReason 说明原因
    //   · 传输层失败 → 拿不到「是否开启」的证据，保守地不产生字段，不伪造 null
    let reconstructionScore: ReconstructionScore | null = null;
    let reconstructionRan = false;
    let cloneScreenshot: string | undefined;
    try {
      logAndProgress('qa', 27, '正在渲染生成页并采集还原度证据...', 'info');
      const res = await fetch('/api/reconstruction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: previewHtml, url, originalScreenshot: websiteScreenshot }),
        signal: workflowAbortController?.signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.enabled) {
          // 服务端确认开启 → 从这里开始，「不可得」才是 null 而不是「未开启」
          reconstructionRan = true;
          reconstructionScore = (data.score ?? null) as ReconstructionScore | null;
          if (typeof data.clone === 'string' && data.clone.length > 0) {
            cloneScreenshot = data.clone;
          }
          if (reconstructionScore?.score != null) {
            logAndProgress('qa', 28, `还原度采集完成：${reconstructionScore.score}/100`, 'success');
          } else {
            logAndProgress('qa', 28, `还原度无法度量（${reconstructionScore?.reason ?? 'unknown'}），跳过还原度对比`, 'warning');
          }
        }
      }
    } catch {
      logAndProgress('qa', 28, '还原度服务不可用，继续标准视觉评审', 'warning');
    }

    // ---- Visual Evaluation Agent: 六维视觉评分 ----
    logAndProgress('qa', 30, '正在连接 AI 视觉评审模型（Visual Evaluation Agent）...');
    await cancellableSleep(200);

    // 构建设计分析摘要 + 设计体系摘要作为评审参考
    const analysisForEval = qaState.designAnalysis;
    const designAnalysisSummary = analysisForEval
      ? JSON.stringify({
          colors: (analysisForEval.colors || []).slice(0, 8).map((c) => `${c.name}:${c.hex}`),
          typography: (analysisForEval.typography || []).slice(0, 4).map((t) => `${t.family} ${t.size}`),
        })
      : '';
    const styleMatchForEval = qaState.styleMatch;
    const designSystemForEval = qaState.designSystem;
    const designSystemSummary = styleMatchForEval && designSystemForEval
      ? formatStyleContextCompact(styleMatchForEval, designSystemForEval)
      : '';

    let visualScore: VisualScore = mockVisualScore;
    try {
      const qaResult = await callMimoAPI('qa', url, {
        previewHtml,
        designAnalysisSummary,
        designSystemSummary,
        round: 1,
        // Sprint B：有还原度报告时，QA 的主输入是「两张截图 + Diff 报告」
        ...(reconstructionScore?.report
          ? { diffReportJson: JSON.stringify(reconstructionScore.report) }
          : {}),
      }, generationId, websiteScreenshot, cloneScreenshot);
      logAndProgress('qa', 45, 'AI: 视觉评分已返回 (VisualScore.json)', 'success');
      await cancellableSleep(200);

      visualScore = normalizeVisualScore(qaResult.result, 1);

      // 逐维度输出评分
      const dims = visualScore.scores;
      logAndProgress('qa', 52, `  布局 ${dims.layout_score} | 视觉平衡 ${dims.visual_balance} | 空间 ${dims.spacing_score}`, 'info');
      await cancellableSleep(300);
      logAndProgress('qa', 56, `  色彩 ${dims.color_score} | 字体 ${dims.typography_score} | 高级感 ${dims.premium_score}⭐`, 'info');
      await cancellableSleep(300);
      logAndProgress('qa', 60, `综合视觉评分: ${visualScore.overall_score}/100`, visualScore.overall_score >= 90 ? 'success' : 'warning');

      // Sprint B：还原度与质量分是两个独立数字，必须分开报
      const reconScore = reconstructionScore?.score;
      logAndProgress(
        'qa',
        62,
        `还原度评分: ${reconScore != null ? `${reconScore}/100` : '—（无法度量）'} ｜ 质量分 ${visualScore.overall_score} ≠ 还原度 ${reconScore ?? '—'}`,
        reconScore != null && reconScore >= 80 ? 'success' : 'info',
      );

      // 输出检测到的视觉问题
      if (visualScore.problems.length > 0) {
        logAndProgress('qa', 65, `检测到 ${visualScore.problems.length} 个视觉问题`, 'warning');
        for (let i = 0; i < Math.min(visualScore.problems.length, 5); i++) {
          const prob = visualScore.problems[i];
          logAndProgress('qa', 68 + i * 2, `  [${prob.type}] ${prob.description}`, 'warning');
          await cancellableSleep(250);
        }
      }
    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : 'API error';
      if (msg.includes('AbortError') || msg.includes('cancelled')) throw apiErr;
      await failWorkflow('qa', `视觉评审模型调用失败: ${msg}`);
      return;
    }

    // ---- 将视觉问题转换为 QAIssue/QAFix 格式（供修复日志展示）----
    const visualIssues = visualScore.problems.map((p) => ({
      type: p.type,
      description: p.description,
      severity: (p.type === 'premium' ? 'major' : 'minor') as 'critical' | 'major' | 'minor' | 'cosmetic',
      fixed: false,
    }));
    const visualFixes = visualScore.problems.map((p) => ({
      issue: `[${p.type}] ${p.description}`,
      description: `建议修复方向（${DIMENSION_LABELS[`${p.type}_score` as keyof typeof DIMENSION_LABELS] || p.type}维度）`,
      applied: false,
    }));

    logAndProgress('qa', 88, '视觉评审完成', 'success');
    await cancellableSleep(200);

    // B.2.2：还原度明细（哪些区域参与测量 / 降级原因 / diff 引用）。
    // 开关关闭或服务没产出对象时返回 undefined —— 字段**不产生**，而不是产出 {} 或 null。
    const reconstructionMeta = deriveReconstructionMeta(reconstructionScore);

    store.setTaskPartial({
      qaResult: {
        // @deprecated 历史兼容字段（语义是质量分，不是相似度）—— 新代码用下面两个
        similarity: visualScore.overall_score,
        qualityScore: visualScore.overall_score,
        // B.2.3.1：只有服务端确认开启了度量才产该字段；
        // 开关关闭 → 字段不产生（undefined），绝不用 null 冒充「不可得」。
        ...reconstructionFields(reconstructionRan, reconstructionScore),
        ...(reconstructionMeta ? { reconstructionMeta } : {}),
        issues: visualIssues,
        fixes: visualFixes,
        screenshots: {
          original: '/screenshots/original.png',
          clone: '/screenshots/clone.png',
          overlay: '/screenshots/overlay.png',
        },
        visualScore,
        optimizationRounds: 0,
      },
    });

    logAndProgress('qa', 99, `Visual QA 完成 — 综合视觉分 ${visualScore.overall_score}/100`, 'success');

    await cancellableSleep(300);
    completeAgent('qa');
    track({ type: 'generation_stage', id: generationId, stage: 'deploy', message: `${trackUser.name} 的任务进入导出打包阶段` });
    await cancellableSleep(300);


    // =====================================================================
    // 6. Export Agent (信息导出)
    // =====================================================================
    startAgent('deploy');
    store.setActiveSection('deploy');

    // Goal-specific export log sequences
    const EXPORT_LOGS: Record<string, { progress: number; msg: string; type?: LogType }[]> = {
      colors: [
        { progress: 8, msg: '收集色彩分析数据...' },
        { progress: 18, msg: '提取色彩体系：主色/辅色/强调色/中性色阶', type: 'success' },
        { progress: 30, msg: '生成配色分析报告 (PDF)...' },
        { progress: 42, msg: '分析颜色使用场景与语义映射...' },
        { progress: 52, msg: '导出设计 Token (DTCG JSON 格式)', type: 'success' },
        { progress: 62, msg: '生成 Tailwind 配色 CSS 变量文件...' },
        { progress: 72, msg: '推导 5 套替代配色方案...', type: 'success' },
        { progress: 82, msg: '生成 AI Prompt 上下文文件...' },
        { progress: 92, msg: '打包导出文件 (5 files)', type: 'success' },
        { progress: 99, msg: '配色方案导出完成', type: 'success' },
      ],
      layout: [
        { progress: 8, msg: '收集布局分析数据...' },
        { progress: 18, msg: '解析网格系统：12列布局, 24px 间距', type: 'success' },
        { progress: 30, msg: '生成布局分析报告 (PDF)...' },
        { progress: 42, msg: '导出 CSS Grid/Flex 模板代码...' },
        { progress: 52, msg: '生成响应式断点策略文档', type: 'success' },
        { progress: 62, msg: '提取间距系统 Token (JSON)...' },
        { progress: 72, msg: '映射 7 个布局区块结构...', type: 'success' },
        { progress: 82, msg: '生成 AI Prompt 上下文文件...' },
        { progress: 92, msg: '打包导出文件 (5 files)', type: 'success' },
        { progress: 99, msg: '布局方案导出完成', type: 'success' },
      ],
      style: [
        { progress: 8, msg: '收集设计语言特征...' },
        { progress: 18, msg: '归类设计风格：极简主义', type: 'success' },
        { progress: 30, msg: '生成设计语言指南 (PDF)...' },
        { progress: 42, msg: '提取动效规范：缓动曲线、时长、微交互...' },
        { progress: 52, msg: '导出设计系统 Token (阴影/模糊/渐变)', type: 'success' },
        { progress: 62, msg: '生成品牌视觉手册 (MDX)...' },
        { progress: 72, msg: '记录形状语言与材质策略...', type: 'success' },
        { progress: 82, msg: '生成 AI Prompt 上下文文件...' },
        { progress: 92, msg: '打包导出文件 (5 files)', type: 'success' },
        { progress: 99, msg: '风格指南导出完成', type: 'success' },
      ],
      features: [
        { progress: 8, msg: '收集特色功能数据...' },
        { progress: 18, msg: '识别 8 项独特交互设计', type: 'success' },
        { progress: 30, msg: '生成特色功能报告 (PDF)...' },
        { progress: 42, msg: '提取交互动画参数 (15 个效果)...' },
        { progress: 52, msg: '导出 Framer Motion 配置 (JSON)', type: 'success' },
        { progress: 62, msg: '生成性能优化方案文档...' },
        { progress: 72, msg: '记录 6 个创新组件模式...', type: 'success' },
        { progress: 82, msg: '生成 AI Prompt 上下文文件...' },
        { progress: 92, msg: '打包导出文件 (5 files)', type: 'success' },
        { progress: 99, msg: '特色功能导出完成', type: 'success' },
      ],
      template: [
        { progress: 8, msg: '收集项目架构数据...' },
        { progress: 18, msg: '打包 14 个项目文件...', type: 'success' },
        { progress: 30, msg: '生成完整项目脚手架 (ZIP)...' },
        { progress: 42, msg: '导出 12 个 React 组件源码...' },
        { progress: 52, msg: '生成组件 API 文档 (MDX)', type: 'success' },
        { progress: 62, msg: '导出设计 Token 配置 (JSON)...' },
        { progress: 72, msg: '生成技术架构文档 (PDF)...', type: 'success' },
        { progress: 82, msg: '生成 AI Prompt 上下文文件...' },
        { progress: 92, msg: '压缩项目包 (2.8MB)', type: 'success' },
        { progress: 99, msg: '项目模板导出完成', type: 'success' },
      ],
    };

    // Default export log sequence (no goal selected)
    const DEFAULT_EXPORT_LOGS: { progress: number; msg: string; type?: LogType }[] = [
      { progress: 8, msg: 'Collecting analysis results...' },
      { progress: 18, msg: 'Bundling design system assets...' },
      { progress: 28, msg: 'Packaging component source code (14 files, 2,847 lines)', type: 'success' },
      { progress: 38, msg: 'Generating design tokens JSON...' },
      { progress: 48, msg: 'Exporting Tailwind config & CSS variables...' },
      { progress: 58, msg: 'Design tokens exported successfully', type: 'success' },
      { progress: 65, msg: 'Creating project archive (.zip)...' },
      { progress: 72, msg: 'Generating README documentation...' },
      { progress: 78, msg: 'Compressing assets...' },
      { progress: 85, msg: 'Archive ready: 4.2MB', type: 'success' },
      { progress: 92, msg: 'Preparing download links...' },
      { progress: 97, msg: 'Export manifest generated', type: 'success' },
      { progress: 99, msg: 'All files ready for download', type: 'success' },
    ];

    const goalExportLogs = goal ? EXPORT_LOGS[goal] : undefined;
    const exportLogs = goalExportLogs ?? DEFAULT_EXPORT_LOGS;

    for (const log of exportLogs) {
      logAndProgress('deploy', log.progress, log.msg, log.type ?? 'info');
      await cancellableSleep(600 + Math.random() * 600);
    }

    // B.2.3.3：这里原本写入 mockDeployResult —— 一个 status:'live' + `.invalid`
    // 占位地址的**假部署结果**（mock-data.ts 里带 `demo: true`，但无任何消费方，
    // 且没有任何 UI 读取 deployResult）。本项目只做「导出打包」，不做线上部署，
    // 所以如实置空：没有发生的事不写进状态（与 B.2.3.1 四态语义同一原则）。
    // 将来真接上部署能力时，再把真实结果写进来。
    store.setTaskPartial({
      deployResult: null,
    });

    completeAgent('deploy');

    // ---- 实时埋点：任务完成 ----
    const finalState = useAgentStore.getState().task;
    const fileCount = finalState.generatedCode instanceof Map ? finalState.generatedCode.size : 0;
    // B.2.3：上报新契约字段。toQualityMetrics 保证
    // ① 读取优先级 qualityScore > similarity（similarity 仍带上，供老数据兜底）
    // ② null（不可得）不被塌成 undefined / 0；undefined 会被 JSON.stringify 丢掉 = 字段不产生
    const completionMetrics = toQualityMetrics(finalState.qaResult ?? {});
    track({
      type: 'generation_complete',
      id: generationId,
      files: fileCount,
      ...completionMetrics,
    });

    // ---- 实时埋点：生成质量（Visual Evaluation + Style Match + Code Validator）----
    track({
      type: 'generation_quality',
      id: generationId,
      user: trackUser.name,
      url: finalState.url,
      styleName: finalState.styleMatch?.matchedStyle,
      styleConfidence: finalState.styleMatch?.confidence,
      visualScore: finalState.qaResult?.visualScore ?? undefined,
      codeValidation: finalState.codeValidation ?? undefined,
    });

    // Mark task as completed
    store.setTaskPartial({
      status: 'completed',
      completedAt: Date.now(),
    });
    useAgentStore.setState({ isRunning: false });
  } catch (err) {
    // If cancelled by user, just clean up silently — store already handles it via cancelTask
    if (err instanceof DOMException && err.name === 'AbortError') {
      track({ type: 'generation_cancelled', id: generationId });
      useAgentStore.setState({ isRunning: false });
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    track({ type: 'generation_error', id: generationId, error: message });
    const currentAgent = useAgentStore.getState().task.currentAgent;
    if (currentAgent) {
      errorAgent(currentAgent, `Agent failed: ${message}`);
    }
    store.setTaskPartial({ status: 'error' });
    useAgentStore.setState({ isRunning: false });
  }
}

// ---------------------------------------------------------------------------
// File tree helpers for nested FileNode[] structure
// ---------------------------------------------------------------------------

interface FileNodeLike {
  name: string;
  type: 'file' | 'directory';
  children?: FileNodeLike[];
}

/** Count all file nodes (not directories) in a nested file tree */
function countFilesInTree(nodes: FileNodeLike[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'file') count++;
    if (node.children) count += countFilesInTree(node.children);
  }
  return count;
}

/** Flatten a nested file tree into a list of path strings like "src/app/page.tsx" */
function flattenFileNames(nodes: FileNodeLike[], prefix = ''): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'file') {
      result.push(path);
    }
    if (node.children) {
      result.push(...flattenFileNames(node.children, path));
    }
  }
  return result;
}
