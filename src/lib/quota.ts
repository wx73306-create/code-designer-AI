import { prisma } from "./prisma"
import { redis } from "./redis"

const QUOTA_LIMITS = {
  USER: 2,
  PRO: 100,
  ENTERPRISE: -1, // unlimited
  ADMIN: -1,
} as const

export interface QuotaResult {
  allowed: boolean
  remaining: number
  limit: number
  resetAt: Date
}

export async function checkQuota(userId: string): Promise<QuotaResult> {
  const cacheKey = `quota:${userId}`

  // Try cache first
  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      const { used, limit, resetAt } = JSON.parse(cached)
      const now = new Date()
      const resetDate = new Date(resetAt)

      // Check if quota has expired and needs reset
      if (now >= resetDate) {
        await resetQuota(userId)
        return checkQuota(userId) // Re-check after reset
      }

      const remaining = limit === -1 ? 999999 : Math.max(0, limit - used)
      return {
        allowed: limit === -1 || remaining > 0,
        remaining,
        limit,
        resetAt: resetDate,
      }
    }
  } catch {
    // Redis unavailable, fall through to DB
  }

  // Fetch from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user) {
    throw new Error("User not found")
  }

  const quota = await prisma.quota.upsert({
    where: { userId },
    create: {
      userId,
      used: 0,
      limit: QUOTA_LIMITS[user.role as keyof typeof QUOTA_LIMITS] || 2,
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    update: {},
  })

  // Check if reset is needed
  if (new Date() >= quota.resetAt) {
    await resetQuota(userId)
    return checkQuota(userId)
  }

  // Cache for 1 hour
  try {
    await redis.setex(
      cacheKey,
      3600,
      JSON.stringify({
        used: quota.used,
        limit: quota.limit,
        resetAt: quota.resetAt,
      })
    )
  } catch {
    // Redis unavailable, continue without cache
  }

  const remaining = quota.limit === -1 ? 999999 : Math.max(0, quota.limit - quota.used)
  return {
    allowed: quota.limit === -1 || remaining > 0,
    remaining,
    limit: quota.limit,
    resetAt: quota.resetAt,
  }
}

export async function consumeQuota(userId: string): Promise<void> {
  const cacheKey = `quota:${userId}`

  await prisma.quota.update({
    where: { userId },
    data: { used: { increment: 1 } },
  })

  // Invalidate cache
  try {
    await redis.del(cacheKey)
  } catch {
    // Redis unavailable
  }
}

/**
 * 原子「检查 + 扣减」配额（修复 P0-5 竞态）。
 * 在单个数据库事务内完成：确保记录存在 → 过期则重置 → 无余量则拒绝 →
 * 否则原子自增 used。事务串行化同一行的并发访问，杜绝超额扣减。
 */
export async function checkAndConsumeQuota(userId: string): Promise<QuotaResult> {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!user) throw new Error("User not found")

    const limit = QUOTA_LIMITS[user.role as keyof typeof QUOTA_LIMITS] ?? 2

    // 确保配额记录存在
    let quota = await tx.quota.upsert({
      where: { userId },
      create: {
        userId,
        used: 0,
        limit,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      update: {},
    })

    // 过期则重置
    if (new Date() >= quota.resetAt) {
      quota = await tx.quota.update({
        where: { userId },
        data: {
          used: 0,
          limit,
          resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    }

    const remaining = quota.limit === -1 ? Number.MAX_SAFE_INTEGER : quota.limit - quota.used

    // 无余量：拒绝，不扣减
    if (quota.limit !== -1 && remaining <= 0) {
      return { allowed: false, remaining: 0, limit: quota.limit, resetAt: quota.resetAt }
    }

    // 原子扣减
    await tx.quota.update({
      where: { userId },
      data: { used: { increment: 1 } },
    })

    return {
      allowed: true,
      remaining: quota.limit === -1 ? Number.MAX_SAFE_INTEGER : remaining - 1,
      limit: quota.limit,
      resetAt: quota.resetAt,
    }
  })

  // 失效缓存
  try {
    await redis.del(`quota:${userId}`)
  } catch {
    // Redis unavailable
  }

  return result
}

/** 按邮箱查用户 ID */
async function getUserIdByEmail(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

/** 按邮箱只读查询配额状态（用于展示/前端 gating），用户不存在返回 null */
export async function getQuotaStatusByEmail(email: string): Promise<QuotaResult | null> {
  const userId = await getUserIdByEmail(email)
  if (!userId) return null
  return checkQuota(userId)
}

/** 按邮箱原子「检查 + 扣减」配额（生成开始时调用一次），用户不存在返回 null */
export async function consumeQuotaByEmail(email: string): Promise<QuotaResult | null> {
  const userId = await getUserIdByEmail(email)
  if (!userId) return null
  return checkAndConsumeQuota(userId)
}

/** 按邮箱退还 1 次配额（生成失败时调用） */
export async function refundQuotaByEmail(email: string): Promise<void> {
  const userId = await getUserIdByEmail(email)
  if (!userId) return

  await prisma.quota.update({
    where: { userId },
    data: { used: { decrement: 1 } },
  })

  // 确保 used 不低于 0
  await prisma.quota.updateMany({
    where: { userId, used: { lt: 0 } },
    data: { used: 0 },
  })

  try {
    await redis.del(`quota:${userId}`)
  } catch {
    // Redis unavailable
  }
}

export async function resetQuota(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user) return

  await prisma.quota.update({
    where: { userId },
    data: {
      used: 0,
      limit: QUOTA_LIMITS[user.role as keyof typeof QUOTA_LIMITS] || 2,
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })

  try {
    await redis.del(`quota:${userId}`)
  } catch {
    // Redis unavailable
  }
}

// Daily reset job - call from cron or scheduled task
export async function dailyQuotaReset(): Promise<void> {
  await prisma.quota.updateMany({
    where: { resetAt: { lte: new Date() } },
    data: { used: 0 },
  })

  // Clear all quota caches
  try {
    const keys = await redis.keys("quota:*")
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch {
    // Redis unavailable
  }
}
