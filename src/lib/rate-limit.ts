// =============================================================================
// Simple in-memory rate limiter (sliding window)
// =============================================================================
// P2 安全修复：防止暴力破解和资源滥用
// 生产环境多实例部署时应替换为 Redis 实现
// =============================================================================

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();
const MAX_STORE_SIZE = 100_000;

// 定期清理过期条目（每 5 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter(t => now - t < 60_000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * 检查是否超过速率限制
 * @param key 唯一标识（通常是 IP + 端点）
 * @param maxRequests 窗口内最大请求数
 * @param windowMs 时间窗口（毫秒），默认 60 秒
 * @returns { allowed, remaining, resetMs }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000,
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    // 防止内存无限增长：超过上限时清空一半最旧条目
    if (store.size >= MAX_STORE_SIZE) {
      const keysToDelete = Array.from(store.keys()).slice(0, Math.floor(MAX_STORE_SIZE / 2));
      for (const k of keysToDelete) store.delete(k);
    }
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // 清除窗口外的记录
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0];
    return { allowed: false, remaining: 0, resetMs: windowMs - (now - oldest) };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: maxRequests - entry.timestamps.length, resetMs: windowMs };
}

/**
 * 从 NextRequest 中提取 IP + 路径作为 rate limit key
 */
export function getRateLimitKey(request: { headers: Headers }, prefix: string = ''): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return `${prefix}:${ip}`;
}
