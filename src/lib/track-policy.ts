// =====================================================================
// Track Policy — 埋点事件的写入策略（哪些必须来自已登录会话）
//
// 背景（2026-09-24）：/api/track 原先零鉴权。它不只是"写点统计"：
//   · generation_start / complete 会写入**持久化观察账本**（Phase 3 样本）
//   · 全部 generation_* 会写内存统计（后台看板）
// 于是任何人都能伪造 { type:'generation_complete', qualityScore:.. }，
// 往观察账本里注入假样本，污染 Phase 4（停用 similarity）的准入判断 ——
// 而 Phase 4 是不可逆变更，判断依据必须可信。
//
// 为什么可以要求会话：生成本身就必须登录（前台未登录会弹登录框，
// /api/mimo 也走 getRequestAuth 校验），所以 generation_* 事件
// **本来就只会来自已登录客户端**，加鉴权不会丢掉任何合法数据。
//
// 为什么不动其它事件：page_visit / heartbeat / user_login 是纯分析埋点，
// 未登录访客也会产生，要求会话会把它们全部丢掉。
// =====================================================================

/**
 * 该埋点事件是否必须来自已登录会话。
 *
 * 判定规则刻意保持简单可解释：**所有生成生命周期事件**（`generation_` 前缀）
 * 都需要会话 —— 生成离不开登录，这类事件没有合法的匿名来源。
 */
export function requiresAuthenticatedSession(eventType: string): boolean {
  return eventType.startsWith('generation_');
}
