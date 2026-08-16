// =====================================================================
// /api/admin/settings — 后台系统设置（读取 + 切换总开关 + 模型配置）
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import { liveStats } from '@/lib/live-stats';
import { isAdminAuthenticatedServer } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** 读取当前系统设置（含数据库中的模型配置） */
export async function GET(request: NextRequest) {
  // P0-1：服务端鉴权，匿名请求一律 401
  if (!isAdminAuthenticatedServer(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = liveStats.getSystemSettings() as Record<string, unknown>;

  // 从数据库读取模型配置
  try {
    const modelKeys = ['mimo_api_key', 'mimo_api_url', 'mimo_model', 'alibaba_api_key', 'alibaba_api_url', 'vl_model'];
    const rows = await prisma.setting.findMany({ where: { key: { in: modelKeys } } });
    const modelConfig: Record<string, string> = {};
    for (const row of rows) {
      const v = row.value as unknown;
      modelConfig[row.key] = typeof v === 'string' ? v : typeof v === 'object' && v !== null ? String((v as Record<string, unknown>).value ?? '') : String(v);
    }
    settings.modelConfig = modelConfig;
  } catch {
    // 数据库不可用时静默跳过
  }

  return NextResponse.json(settings);
}

/** 更新系统设置：支持 generationEnabled 总开关、quotaConfig 配额、userTier 用户套餐、modelConfig 模型配置 */
export async function POST(request: NextRequest) {
  // P0-1：服务端鉴权，匿名请求一律 401
  if (!isAdminAuthenticatedServer(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { generationEnabled, quotaConfig, userTier, modelConfig } = body as {
      generationEnabled?: boolean;
      quotaConfig?: { free?: number; pro?: number };
      userTier?: { email?: string; tier?: 'free' | 'pro' };
      modelConfig?: Record<string, string>;
    };

    const messages: string[] = [];

    // 总开关
    if (typeof generationEnabled === 'boolean') {
      liveStats.setGenerationEnabled(generationEnabled);
      messages.push(generationEnabled ? '网页生成服务已开启' : '网页生成服务已暂停');
    }

    // 配额配置
    if (quotaConfig && typeof quotaConfig === 'object') {
      liveStats.setQuotaConfig(quotaConfig);
      messages.push('生成配额已更新');
    }

    // 用户套餐调整
    if (userTier && userTier.email && (userTier.tier === 'free' || userTier.tier === 'pro')) {
      liveStats.setUserTier(userTier.email, userTier.tier);
      messages.push(`用户套餐已调整为 ${userTier.tier === 'pro' ? 'Pro' : '免费'}`);
    }

    // 模型配置 → 写入数据库 Setting 表
    if (modelConfig && typeof modelConfig === 'object') {
      const validKeys = ['mimo_api_key', 'mimo_api_url', 'mimo_model', 'alibaba_api_key', 'alibaba_api_url', 'vl_model'];
      let savedCount = 0;
      for (const [key, value] of Object.entries(modelConfig)) {
        if (!validKeys.includes(key)) continue;
        try {
          await prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value, description: `AI model configuration: ${key}` },
          });
          savedCount++;
        } catch {
          // 单个 key 保存失败不影响其他
        }
      }
      if (savedCount > 0) {
        messages.push(`模型配置已保存（${savedCount} 项）`);
      }
    }

    if (messages.length === 0) {
      return NextResponse.json(
        { error: '未提供任何有效的设置项' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      ...liveStats.getSystemSettings(),
      message: messages.join('；'),
    });
  } catch {
    return NextResponse.json(
      { error: '无效的请求体' },
      { status: 400 },
    );
  }
}
