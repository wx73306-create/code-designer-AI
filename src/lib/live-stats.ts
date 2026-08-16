// =====================================================================
// Live Stats Tracker — 服务端实时统计中心 (内存单例)
// =====================================================================
// 所有前端埋点 + 服务端 API 调用都会汇入这里，
// 后台管理页面通过 /api/admin/* 轮询读取真实数据。
// 注意：数据保存在 Node 进程内存中，dev server 重启后清零。
// =====================================================================

import os from 'os';

// ---- Types ------------------------------------------------------------

export interface GenerationRecord {
  id: string;
  user: string;
  email: string;
  url: string;
  goal: string;
  model: string;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  currentStage: string;
  startedAt: number;
  lastUpdateAt: number;
  completedAt?: number;
  durationMs?: number;
  tokens?: number;
  cost?: number;
  files?: number;
  similarity?: number;
  error?: string;
}

export interface UserRecord {
  name: string;
  email: string;
  isAdmin: boolean;
  tier: 'free' | 'pro';
  firstSeenAt: number;
  lastActiveAt: number;
  loginCount: number;
  generationCount: number;
}

export interface UserQuotaStatus {
  email: string;
  name: string;
  tier: 'free' | 'pro';
  isAdmin: boolean;
  used: number;
  limit: number;      // -1 表示无限
  remaining: number;  // -1 表示无限
  allowed: boolean;
}

export interface ApiCallRecord {
  id: string;
  generationId?: string;
  step: string;
  model: string;
  targetUrl: string;
  status: 'success' | 'error';
  httpStatus?: number;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: number;
  error?: string;
}

export interface ErrorRecord {
  id: string;
  source: string;
  message: string;
  context?: string;
  timestamp: number;
}

export interface QualityRecord {
  id: string;
  generationId?: string;
  user: string;
  url: string;
  // Style Matcher 输出
  styleName?: string;
  styleConfidence?: number;
  // Visual Evaluation 六维评分
  overallScore?: number;
  layoutScore?: number;
  balanceScore?: number;
  spacingScore?: number;
  colorScore?: number;
  typographyScore?: number;
  premiumScore?: number;
  // Code Validator 输出
  ruleScore?: number;
  rulePassed?: boolean;
  violationCount?: number;
  // 视觉问题（用于失败案例库）
  problems?: Array<{ type: string; description: string }>;
  timestamp: number;
}

export interface SystemEvent {
  id: string;
  type: 'generation' | 'user' | 'api' | 'system' | 'error';
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

interface CpuSnapshot { idle: number; total: number; }

// ---- Cost model (估算) --------------------------------------------------

const COST_PER_1K_TOKENS = 0.002; // ¥ per 1K tokens (mimo-v2.5 估算价)

function estimateCost(tokens: number): number {
  return Math.round((tokens / 1000) * COST_PER_1K_TOKENS * 10000) / 10000;
}

// ---- Tracker ------------------------------------------------------------

class LiveStatsTracker {
  readonly startedAt = Date.now();

  generations: GenerationRecord[] = [];
  users = new Map<string, UserRecord>();
  apiCalls: ApiCallRecord[] = [];
  qualityRecords: QualityRecord[] = [];
  errors: ErrorRecord[] = [];
  events: SystemEvent[] = [];

  pageVisits = 0;
  /** 今日访问量（跨天自动重置） */
  todayVisits = 0;
  private todayVisitsDate = '';
  /** 总控制开关：是否允许网页生成（管理员可一键关停） */
  generationEnabled = true;
  /** 生成配额配置（次/天），管理员可在后台实时调整 */
  quotaConfig = { free: 2, pro: 100 };
  /** 每用户每日生成用量：email → { date(YYYY-MM-DD), count } */
  dailyUsage = new Map<string, { date: string; count: number }>();
  private lastCpuSnapshot: CpuSnapshot | null = null;
  private idCounter = 0;

  private nextId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${(this.idCounter++).toString(36)}`;
  }

  private pushEvent(type: SystemEvent['type'], message: string, level: SystemEvent['level'] = 'info') {
    this.events.unshift({ id: this.nextId('evt'), type, message, level, timestamp: Date.now() });
    if (this.events.length > 300) this.events.length = 300;
  }

  // ---- Generation lifecycle ----

  generationStart(data: { id?: string; user: string; email: string; url: string; goal: string; model: string }): string {
    const id = data.id || this.nextId('gen');
    this.generations.unshift({
      id,
      user: data.user,
      email: data.email,
      url: data.url,
      goal: data.goal || 'default',
      model: data.model,
      status: 'running',
      currentStage: 'browser',
      startedAt: Date.now(),
      lastUpdateAt: Date.now(),
    });
    if (this.generations.length > 100) this.generations.length = 100;
    this.pushEvent('generation', `${data.user} 开始生成任务 → ${data.url}`, 'info');

    // Bump user generation count
    const u = this.users.get(data.email);
    if (u) u.generationCount++;

    // Bump per-user daily usage (for quota enforcement)
    this.bumpDailyUsage(data.email);
    return id;
  }

  /** 累加某用户今日生成次数（跨天自动重置） */
  private bumpDailyUsage(email: string) {
    const today = new Date().toISOString().slice(0, 10);
    const entry = this.dailyUsage.get(email);
    if (entry && entry.date === today) {
      entry.count++;
    } else {
      this.dailyUsage.set(email, { date: today, count: 1 });
    }
  }

  /** 读取某用户今日已用次数 */
  private getDailyUsed(email: string): number {
    const today = new Date().toISOString().slice(0, 10);
    const entry = this.dailyUsage.get(email);
    return entry && entry.date === today ? entry.count : 0;
  }

  generationStage(id: string, stage: string, message?: string) {
    const gen = this.generations.find((g) => g.id === id);
    if (!gen) return;
    gen.currentStage = stage;
    gen.lastUpdateAt = Date.now();
    if (message) this.pushEvent('generation', `[${gen.user}] ${message}`, 'info');
  }

  generationComplete(id: string, data: { tokens?: number; files?: number; similarity?: number }) {
    const gen = this.generations.find((g) => g.id === id);
    if (!gen) return;
    gen.status = 'completed';
    gen.completedAt = Date.now();
    gen.durationMs = gen.completedAt - gen.startedAt;
    // 优先用客户端上报的 tokens，否则汇总该任务关联的所有 API 调用 tokens
    const linkedTokens = this.apiCalls
      .filter((c) => c.generationId === id)
      .reduce((s, c) => s + c.totalTokens, 0);
    gen.tokens = data.tokens ?? linkedTokens;
    gen.cost = estimateCost(gen.tokens);
    gen.files = data.files;
    gen.similarity = data.similarity;
    gen.currentStage = 'done';
    this.pushEvent(
      'generation',
      `${gen.user} 生成完成 → ${gen.url} (${Math.round(gen.durationMs / 1000)}s, 还原度 ${gen.similarity?.toFixed(1) ?? '—'}%)`,
      'success',
    );
  }

  generationError(id: string, error: string) {
    const gen = this.generations.find((g) => g.id === id);
    if (!gen) return;
    gen.status = 'error';
    gen.completedAt = Date.now();
    gen.durationMs = gen.completedAt - gen.startedAt;
    gen.error = error;
    this.pushEvent('generation', `${gen.user} 生成失败 → ${gen.url}: ${error}`, 'error');
    this.trackError('workflow', error, gen.url);
  }

  generationCancelled(id: string) {
    const gen = this.generations.find((g) => g.id === id);
    if (!gen) return;
    gen.status = 'cancelled';
    gen.completedAt = Date.now();
    gen.durationMs = gen.completedAt - gen.startedAt;
    this.pushEvent('generation', `${gen.user} 取消了生成任务 → ${gen.url}`, 'warning');
  }

  /** 超时阈值：running 任务超过 3 分钟无任何更新即视为被放弃（页面刷新/关闭/崩溃） */
  private static readonly STALE_MS = 3 * 60 * 1000;

  /**
   * 清扫"僵尸"生成记录：客户端中断（刷新/关闭/崩溃）后，running 任务会永远卡住。
   * 在读取统计时惰性调用，把超时无更新的 running 任务标记为 cancelled。
   */
  sweepStaleGenerations() {
    const now = Date.now();
    for (const gen of this.generations) {
      const lastActive = gen.lastUpdateAt || gen.startedAt;
      if (gen.status === 'running' && now - lastActive > LiveStatsTracker.STALE_MS) {
        gen.status = 'cancelled';
        gen.completedAt = now;
        gen.durationMs = now - gen.startedAt;
        this.pushEvent('generation', `${gen.user} 的生成任务超时中断（客户端已离开）→ ${gen.url}`, 'warning');
      }
    }
  }

  // ---- Users ----

  userLogin(data: { name: string; email: string; isAdmin?: boolean }) {
    const existing = this.users.get(data.email);
    if (existing) {
      existing.lastActiveAt = Date.now();
      existing.loginCount++;
    } else {
      this.users.set(data.email, {
        name: data.name,
        email: data.email,
        isAdmin: data.isAdmin ?? false,
        tier: data.isAdmin ? 'pro' : 'free',
        firstSeenAt: Date.now(),
        lastActiveAt: Date.now(),
        loginCount: 1,
        generationCount: 0,
      });
    }
    this.pushEvent('user', `${data.name} (${data.email}) 登录系统`, data.isAdmin ? 'warning' : 'success');
  }

  pageVisit(data?: { path?: string }) {
    this.pageVisits++;
    // 今日访问量（跨天重置）
    const today = new Date().toISOString().slice(0, 10);
    if (this.todayVisitsDate !== today) {
      this.todayVisitsDate = today;
      this.todayVisits = 0;
    }
    this.todayVisits++;
    // 低频事件不打扰事件流，每 10 次汇总一条
    if (this.pageVisits % 10 === 1) {
      this.pushEvent('system', `页面访问量 +10 (累计 ${this.pageVisits})`, 'info');
    }
    void data;
  }

  heartbeat(email: string) {
    const u = this.users.get(email);
    if (u) u.lastActiveAt = Date.now();
  }

  // ---- API calls ----

  trackApiCall(data: {
    generationId?: string;
    step: string;
    model: string;
    targetUrl: string;
    status: 'success' | 'error';
    httpStatus?: number;
    durationMs: number;
    promptChars: number;
    completionChars: number;
    error?: string;
  }) {
    const promptTokens = Math.ceil(data.promptChars / 4);
    const completionTokens = Math.ceil(data.completionChars / 4);
    const totalTokens = promptTokens + completionTokens;
    this.apiCalls.unshift({
      id: this.nextId('api'),
      generationId: data.generationId,
      step: data.step,
      model: data.model,
      targetUrl: data.targetUrl,
      status: data.status,
      httpStatus: data.httpStatus,
      durationMs: data.durationMs,
      promptTokens,
      completionTokens,
      totalTokens,
      cost: estimateCost(totalTokens),
      timestamp: Date.now(),
      error: data.error,
    });
    if (this.apiCalls.length > 200) this.apiCalls.length = 200;

    if (data.status === 'error') {
      this.pushEvent('api', `API 调用失败 [${data.step}] ${data.model}: ${data.error || data.httpStatus}`, 'error');
    } else {
      this.pushEvent('api', `API 调用 [${data.step}] ${data.model} 完成 (${(data.durationMs / 1000).toFixed(1)}s, ${totalTokens} tokens)`, 'info');
    }
  }

  // ---- Errors ----

  trackError(source: string, message: string, context?: string) {
    this.errors.unshift({ id: this.nextId('err'), source, message, context, timestamp: Date.now() });
    if (this.errors.length > 100) this.errors.length = 100;
    this.pushEvent('error', `[${source}] ${message}`, 'error');
  }

  // ---- Generation quality (Visual Evaluation + Style Match + Code Validator) ----

  trackQuality(data: Omit<QualityRecord, 'id' | 'timestamp'>) {
    this.qualityRecords.unshift({
      ...data,
      id: this.nextId('qual'),
      timestamp: Date.now(),
    });
    if (this.qualityRecords.length > 200) this.qualityRecords.length = 200;
    if (data.overallScore !== undefined) {
      const level = data.overallScore >= 90 ? 'success' : data.overallScore >= 75 ? 'info' : 'warning';
      this.pushEvent(
        'generation',
        `${data.user} 生成质量评分 ${data.overallScore}/100（高级感 ${data.premiumScore ?? '—'}）${data.styleName ? ` · ${data.styleName}` : ''}`,
        level,
      );
    }
  }

  // ---- System metrics ----

  private readCpuSnapshot(): CpuSnapshot {
    let idle = 0, total = 0;
    for (const cpu of os.cpus()) {
      for (const type of Object.keys(cpu.times)) total += cpu.times[type as keyof typeof cpu.times];
      idle += cpu.times.idle;
    }
    return { idle, total };
  }

  getCpuUsage(): number {
    const now = this.readCpuSnapshot();
    const prev = this.lastCpuSnapshot;
    this.lastCpuSnapshot = now;
    if (!prev) return 0;
    const idleDiff = now.idle - prev.idle;
    const totalDiff = now.total - prev.total;
    if (totalDiff <= 0) return 0;
    return Math.round((1 - idleDiff / totalDiff) * 1000) / 10;
  }

  getMemory() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const heap = process.memoryUsage();
    return {
      totalGB: Math.round(total / 1024 / 1024 / 1024 * 10) / 10,
      usedGB: Math.round(used / 1024 / 1024 / 1024 * 10) / 10,
      percent: Math.round(used / total * 1000) / 10,
      heapUsedMB: Math.round(heap.heapUsed / 1024 / 1024),
      rssMB: Math.round(heap.rss / 1024 / 1024),
    };
  }

  /** 5 分钟内有活跃记录的用户视为在线 */
  getOnlineCount(): number {
    const cutoff = Date.now() - 5 * 60 * 1000;
    let count = 0;
    for (const u of this.users.values()) {
      if (u.lastActiveAt > cutoff) count++;
    }
    return count;
  }

  // ---- Aggregations for admin pages ----

  getDashboardStats() {
    this.sweepStaleGenerations();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ts = todayStart.getTime();

    const todayGens = this.generations.filter((g) => g.startedAt >= ts);
    const completed = this.generations.filter((g) => g.status === 'completed');
    const todayCompleted = todayGens.filter((g) => g.status === 'completed');
    const failed = this.generations.filter((g) => g.status === 'error');
    const running = this.generations.filter((g) => g.status === 'running');

    const avgDuration = completed.length
      ? completed.reduce((s, g) => s + (g.durationMs || 0), 0) / completed.length
      : 0;

    const totalTokens = this.apiCalls.reduce((s, c) => s + c.totalTokens, 0);
    const totalCost = this.apiCalls.reduce((s, c) => s + c.cost, 0);
    const todayLogins = [...this.users.values()].filter((u) => u.lastActiveAt >= ts).length;
    const newUsers = [...this.users.values()].filter((u) => u.firstSeenAt >= ts).length;

    const finishedCount = completed.length + failed.length;
    const successRate = finishedCount > 0
      ? Math.round((completed.length / finishedCount) * 1000) / 10
      : 100;

    return {
      serverTime: Date.now(),
      uptimeMs: Date.now() - this.startedAt,
      generationEnabled: this.generationEnabled,
      todayNewUsers: newUsers,
      todayLogins,
      totalUsers: this.users.size,
      onlineCount: this.getOnlineCount(),
      totalGenerations: this.generations.length,
      todayGenerations: todayGens.length,
      runningGenerations: running.length,
      todayCompleted: todayCompleted.length,
      successRate,
      avgDurationMs: Math.round(avgDuration),
      totalTokens,
      totalCost: Math.round(totalCost * 100) / 100,
      todayApiCalls: this.apiCalls.filter((c) => c.timestamp >= ts).length,
      totalApiCalls: this.apiCalls.length,
      errorCount24h: this.errors.filter((e) => e.timestamp >= Date.now() - 86400000).length,
      pageVisits: this.pageVisits,
      todayVisits: this.todayVisits,
      cpu: this.getCpuUsage(),
      memory: this.getMemory(),
    };
  }

  getLiveSnapshot() {
    this.sweepStaleGenerations();
    const running = this.generations.filter((g) => g.status === 'running');
    return {
      serverTime: Date.now(),
      uptimeMs: Date.now() - this.startedAt,
      cpu: this.getCpuUsage(),
      memory: this.getMemory(),
      loadAvg: os.loadavg().map((l) => Math.round(l * 100) / 100),
      platform: `${os.type()} ${os.release()}`,
      nodeVersion: process.version,
      onlineCount: this.getOnlineCount(),
      pageVisits: this.pageVisits,
      todayVisits: this.todayVisits,
      runningGenerations: running.map((g) => ({
        id: g.id, user: g.user, url: g.url, stage: g.currentStage,
        elapsedMs: Date.now() - g.startedAt,
      })),
      queueLength: running.length,
      recentEvents: this.events.slice(0, 50),
      apiHealth: this.getApiHealth(),
    };
  }

  getApiHealth() {
    const recent = this.apiCalls.slice(0, 20);
    const okCount = recent.filter((c) => c.status === 'success').length;
    const avgLatency = recent.length
      ? Math.round(recent.reduce((s, c) => s + c.durationMs, 0) / recent.length)
      : 0;
    return {
      status: this.apiCalls.length === 0 ? 'idle' : okCount / recent.length >= 0.8 ? 'ok' : 'degraded',
      successRate: recent.length ? Math.round((okCount / recent.length) * 100) : 100,
      avgLatencyMs: avgLatency,
      totalCalls: this.apiCalls.length,
    };
  }

  /** Agent 监控中心：按 step 聚合每次模型调用的性能指标 */
  getAgentStats() {
    const byStep = new Map<string, {
      calls: number; success: number; totalLatency: number; totalTokens: number; totalCost: number;
    }>();

    for (const c of this.apiCalls) {
      const agg = byStep.get(c.step) || { calls: 0, success: 0, totalLatency: 0, totalTokens: 0, totalCost: 0 };
      agg.calls++;
      if (c.status === 'success') agg.success++;
      agg.totalLatency += c.durationMs;
      agg.totalTokens += c.totalTokens;
      agg.totalCost += c.cost;
      byStep.set(c.step, agg);
    }

    const agents = [...byStep.entries()].map(([step, a]) => ({
      step,
      calls: a.calls,
      successRate: a.calls ? Math.round((a.success / a.calls) * 1000) / 10 : 100,
      avgLatencyMs: a.calls ? Math.round(a.totalLatency / a.calls) : 0,
      totalTokens: a.totalTokens,
      totalCost: Math.round(a.totalCost * 100) / 100,
      status: a.calls === 0 ? 'idle' : (a.success / a.calls) >= 0.9 ? 'healthy' : (a.success / a.calls) >= 0.7 ? 'warning' : 'error',
    }));

    // 按调用次数降序
    agents.sort((x, y) => y.calls - x.calls);
    return agents;
  }

  /** 生成质量监控：聚合六维评分均值、风格分布、失败案例库 */
  getQualityStats() {
    const records = this.qualityRecords;
    const scored = records.filter((r) => r.overallScore !== undefined);

    const avg = (pick: (r: QualityRecord) => number | undefined) => {
      const vals = scored.map(pick).filter((v): v is number => v !== undefined);
      return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10 : 0;
    };

    // 风格匹配分布
    const styleCounts = new Map<string, number>();
    for (const r of records) {
      if (r.styleName) styleCounts.set(r.styleName, (styleCounts.get(r.styleName) || 0) + 1);
    }
    const totalStyled = [...styleCounts.values()].reduce((s, v) => s + v, 0);
    const styleDistribution = [...styleCounts.entries()]
      .map(([name, count]) => ({
        name,
        count,
        percent: totalStyled ? Math.round((count / totalStyled) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // 失败案例库（premium < 80 或 overall < 75 的低分项目）
    const failureCases = records
      .filter((r) => (r.premiumScore !== undefined && r.premiumScore < 80) || (r.overallScore !== undefined && r.overallScore < 75))
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        url: r.url,
        user: r.user,
        overallScore: r.overallScore,
        premiumScore: r.premiumScore,
        styleName: r.styleName,
        problems: r.problems || [],
        timestamp: r.timestamp,
      }));

    return {
      totalEvaluated: records.length,
      avgScores: {
        overall: avg((r) => r.overallScore),
        layout: avg((r) => r.layoutScore),
        balance: avg((r) => r.balanceScore),
        spacing: avg((r) => r.spacingScore),
        color: avg((r) => r.colorScore),
        typography: avg((r) => r.typographyScore),
        premium: avg((r) => r.premiumScore),
      },
      avgRuleScore: avg((r) => r.ruleScore),
      styleDistribution,
      failureCases,
      recentRecords: records.slice(0, 30),
    };
  }

  // ---- System settings (master switch) ----

  /** 一键开/关网页生成功能 */
  setGenerationEnabled(enabled: boolean) {
    if (this.generationEnabled === enabled) return;
    this.generationEnabled = enabled;
    this.pushEvent(
      'system',
      enabled ? '管理员已恢复网页生成服务' : '管理员已暂停网页生成服务（总开关关闭）',
      enabled ? 'success' : 'warning',
    );
  }

  /** 返回系统设置（供 /api/system-status 与后台读取） */
  getSystemSettings() {
    return {
      generationEnabled: this.generationEnabled,
      quotaConfig: this.quotaConfig,
    };
  }

  // ---- Quota management（生成配额，与前端账户实时连接） ----

  /** 管理员实时调整配额上限 */
  setQuotaConfig(config: { free?: number; pro?: number }) {
    if (typeof config.free === 'number' && config.free >= 0) this.quotaConfig.free = Math.floor(config.free);
    if (typeof config.pro === 'number' && config.pro >= 0) this.quotaConfig.pro = Math.floor(config.pro);
    this.pushEvent(
      'system',
      `管理员调整生成配额：免费 ${this.quotaConfig.free} 次/天 · Pro ${this.quotaConfig.pro} 次/天`,
      'info',
    );
  }

  /** 计算某用户的配额状态（按邮箱） */
  getUserQuota(email: string): UserQuotaStatus {
    const u = this.users.get(email);
    const tier = u?.tier ?? 'free';
    const isAdmin = u?.isAdmin ?? false;
    const used = this.getDailyUsed(email);
    // 管理员无限；普通用户按 tier 取 free/pro 上限
    const limit = isAdmin ? -1 : tier === 'pro' ? this.quotaConfig.pro : this.quotaConfig.free;
    const remaining = limit === -1 ? -1 : Math.max(0, limit - used);
    const allowed = limit === -1 || remaining > 0;
    return {
      email,
      name: u?.name ?? email.split('@')[0],
      tier,
      isAdmin,
      used,
      limit,
      remaining,
      allowed,
    };
  }

  /** 管理员调整某用户的套餐等级 */
  setUserTier(email: string, tier: 'free' | 'pro') {
    const u = this.users.get(email);
    if (!u) return;
    u.tier = tier;
    this.pushEvent('user', `${u.name} 的套餐已调整为 ${tier === 'pro' ? 'Pro' : '免费'}`, 'info');
  }

  /** 后台配额页总览：配置 + 每用户用量 */
  getQuotaOverview() {
    const users = [...this.users.values()]
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .map((u) => this.getUserQuota(u.email));
    return {
      quotaConfig: this.quotaConfig,
      users,
    };
  }

  /** 清空全部统计数据（演示前重置用） */
  reset() {
    this.generations = [];
    this.users.clear();
    this.apiCalls = [];
    this.qualityRecords = [];
    this.errors = [];
    this.events = [];
    this.pageVisits = 0;
    this.todayVisits = 0;
    this.todayVisitsDate = '';
    this.dailyUsage.clear();
    this.pushEvent('system', '统计数据已重置', 'warning');
  }
}

// ---- Singleton (跨 HMR 存活) ---------------------------------------------

const STATS_VERSION = 7; // 类结构变更时递增，HMR 后自动重建实例

const globalForStats = globalThis as unknown as {
  __codeDesignerLiveStats?: LiveStatsTracker;
  __codeDesignerLiveStatsVersion?: number;
};

function getOrCreateTracker(): LiveStatsTracker {
  if (
    globalForStats.__codeDesignerLiveStats &&
    globalForStats.__codeDesignerLiveStatsVersion === STATS_VERSION
  ) {
    return globalForStats.__codeDesignerLiveStats;
  }
  const instance = new LiveStatsTracker();
  globalForStats.__codeDesignerLiveStats = instance;
  globalForStats.__codeDesignerLiveStatsVersion = STATS_VERSION;
  return instance;
}

export const liveStats: LiveStatsTracker = getOrCreateTracker();
