'use client';

import { useEffect, useState } from 'react';

/**
 * 轮询 Hook — 定时从 API 拉取实时数据
 * 后台所有页面共用，保证数据与前端活动保持同步
 */
export function usePoll<T>(url: string, intervalMs = 3000) {
  const [data, setData] = useState<T | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as T;
        if (alive) {
          setData(json);
          setLastUpdated(Date.now());
        }
      } catch {
        // 网络抖动时静默跳过，下一轮重试
      }
    };

    load();
    const id = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, intervalMs]);

  return { data, lastUpdated };
}

// ---- 格式化工具 ----

export function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5000) return '刚刚';
  if (diff < 60000) return `${Math.floor(diff / 1000)} 秒前`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
}

export function formatNumber(n?: number): string {
  if (n === undefined || n === null) return '—';
  return n.toLocaleString('zh-CN');
}

export function truncateUrl(url: string, max = 32): string {
  const clean = url.replace(/^https?:\/\//, '');
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}
