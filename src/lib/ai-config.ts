// =============================================================================
// AI Config — 统一配置读取层
// 数据库 Setting 表优先，环境变量兜底
// =============================================================================

import { prisma } from "@/lib/prisma";

/**
 * 从 Setting 表读取单个配置值。
 * 兼容 value 字段为字符串或嵌套对象两种存储格式。
 */
async function readSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (!row || row.value == null) return null;

    // Json 类型归一化
    const v = row.value as unknown;
    if (typeof v === "string") return v;
    if (typeof v === "object" && v !== null) {
      const obj = v as Record<string, unknown>;
      if (typeof obj.value === "string") return obj.value;
    }
    return String(v);
  } catch {
    // 数据库不可用时静默失败，走环境变量兜底
    return null;
  }
}

/**
 * 统一入口：数据库优先，环境变量兜底。
 * 返回 AI 模型调用所需的全部配置。
 */
export async function getAiConfig() {
  const [
    mimoApiKey,
    mimoApiUrl,
    mimoModel,
    alibabaApiKey,
    alibabaApiUrl,
    vlModel,
  ] = await Promise.all([
    readSetting("mimo_api_key"),
    readSetting("mimo_api_url"),
    readSetting("mimo_model"),
    readSetting("alibaba_api_key"),
    readSetting("alibaba_api_url"),
    readSetting("vl_model"),
  ]);

  return {
    // MiMo
    mimoApiKey: mimoApiKey || process.env.MIMO_API_KEY || null,
    mimoApiUrl: mimoApiUrl || process.env.MIMO_API_URL || "https://api.xiaomimimo.com/v1",
    mimoModel: mimoModel || process.env.MIMO_MODEL || "mimo-v2.5",
    // Alibaba Bailian
    alibabaApiKey: alibabaApiKey || process.env.ALIBABA_API_KEY || null,
    alibabaApiUrl: alibabaApiUrl || process.env.ALIBABA_API_URL || null,
    // Vision Language Model
    vlModel: vlModel || process.env.VL_MODEL || null,
  };
}
