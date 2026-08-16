// =====================================================================
// 前端埋点工具 — fire-and-forget 上报到 /api/track
// =====================================================================

type TrackPayload = Record<string, unknown> & { type: string };

/** 异步上报事件，失败静默（不影响主流程） */
export function track(payload: TrackPayload): void {
  if (typeof window === 'undefined') return;
  try {
    // sendBeacon 优先（页面关闭时也能送达），降级到 fetch
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      const queued = navigator.sendBeacon('/api/track', blob);
      if (queued) return;
    }
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never break the app because of tracking
  }
}

/** 客户端生成任务 ID（无需等待服务端响应，整个生命周期复用） */
export function createGenerationId(): string {
  return `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
