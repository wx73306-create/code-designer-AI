/**
 * diff/layout — 第一层：布局结构 diff
 * ===================================================================
 * Phase 2 / Sprint B Step 4。纯函数，不碰浏览器。
 *
 * ## 对齐策略：按 role 序列做 LCS，不按 index
 *
 * 生成页很容易多一个/少一个 section。按 index 对齐的话，中间插进一个区块
 * 就会把后面**所有**区块全部错配，得到一个荒唐的低分。
 * LCS（最长公共子序列）只要求相对顺序一致，插入/删除只影响缺失的那一个。
 *
 * 输入是 `LayoutProbeResult`（Sprint A 的实测产物）——原站一份、clone 一份，
 * 两边用**同一把尺子**量出来的，diff 才有意义。
 */

import type { LayoutDiff, LayoutDiffItem } from '@/types/reconstruction';
import type { LayoutBlock } from '@/types/website-package';
import type { LayoutProbeResult } from '@/lib/browser-intelligence/layout-probe';

// ---------------------------------------------------------------------------
// 对齐
// ---------------------------------------------------------------------------

interface RolePair {
  ai: number;
  bi: number;
}

/**
 * 按 role 做 LCS 对齐，返回配对（保持相对顺序）。
 * 同名 role（比如两个 content）按出现顺序一一配对。
 */
function alignByRole(a: LayoutBlock[], b: LayoutBlock[]): RolePair[] {
  const n = a.length;
  const m = b.length;

  // dp[i][j] = a[i..] 与 b[j..] 的 LCS 长度
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i].role === b[j].role
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const pairs: RolePair[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].role === b[j].role) {
      pairs.push({ ai: i, bi: j });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

export function diffLayout(original: LayoutProbeResult, clone: LayoutProbeResult): LayoutDiff {
  const a = original.flow;
  const b = clone.flow;
  const pairs = alignByRole(a, b);

  const matchedB = new Set(pairs.map((p) => p.bi));
  const pairByA = new Map(pairs.map((p) => [p.ai, p]));

  // roleSequenceCoverage = 2*LCS / (lenA + lenB)。
  // 两边都为空视为完全一致（1），只有一边为空视为完全不一致（0）。
  const roleSequenceCoverage =
    a.length + b.length === 0 ? 1 : (2 * pairs.length) / (a.length + b.length);

  const items: LayoutDiffItem[] = [];

  // 先按原站顺序产出 matched / missing
  for (let ai = 0; ai < a.length; ai++) {
    const pair = pairByA.get(ai);
    if (!pair) {
      items.push({ role: a[ai].role, status: 'missing', originalIndex: ai });
      continue;
    }
    const co = a[ai];
    const cc = b[pair.bi];
    items.push({
      role: co.role,
      status: 'matched',
      originalIndex: ai,
      cloneIndex: pair.bi,
      heightWeightDelta: cc.heightWeight - co.heightWeight,
      heightPxRatio:
        co.heightPx !== undefined && co.heightPx > 0 && cc.heightPx !== undefined
          ? cc.heightPx / co.heightPx
          : undefined,
      columnDelta: cc.columns - co.columns,
      originalColumns: co.columns,
      cloneColumns: cc.columns,
      alignmentMatch: cc.alignment === co.alignment,
      fullBleedMatch: cc.fullBleed === co.fullBleed,
    });
  }

  // 再按 clone 顺序补 extra
  for (let bi = 0; bi < b.length; bi++) {
    if (!matchedB.has(bi)) {
      items.push({ role: b[bi].role, status: 'extra', cloneIndex: bi });
    }
  }

  // 高度占比距离：matched 对的 |Δweight| 之和 / 原站 weight 之和。
  // 没有任何 matched 对时：两边都空 = 0（一致），否则 = 1（完全不一致）。
  let totalDelta = 0;
  let totalOriginalWeight = 0;
  for (const item of items) {
    if (item.status !== 'matched' || item.originalIndex === undefined) continue;
    const co = a[item.originalIndex];
    totalDelta += Math.abs(item.heightWeightDelta ?? 0);
    totalOriginalWeight += Math.abs(co.heightWeight);
  }
  const heightProfileDistance =
    pairs.length === 0 ? (a.length + b.length === 0 ? 0 : 1) : totalDelta / Math.max(totalOriginalWeight, 1);

  return {
    roleSequenceCoverage,
    items,
    heightProfileDistance,
  };
}
