// =====================================================================
// Run Mode — 工作区「当前显示的是真数据还是示例数据」的唯一判定源
//
// 背景（B.2.3.2）：页头原本硬编码了一枚「演示数据」徽章，文案断言
// 「分析、截图、评分与部署结果均为模拟数据」——但实测整条流水线是真实执行的
// （真浏览器截图、真模型调用、真实评分）。这造成真假不可辨认。
//
// 各区块的取数约定是 `store 值 ?? mock 兜底`（见 code-section /
// design-analysis-section / component-tree-section / qa-section），
// 因此实际存在**三种**状态，不能只用「演示 / 非演示」两态表达：
//
//   forced-demo  环境变量强制：整套部署就是演示环境 → 全链路模拟数据
//   sample       本任务尚未运行生成 → 各区块显示的是内置示例数据
//   live         本任务真实执行过   → 分析/截图/评分为真实结果
//
// 「未产生的东西不冒充已产生」——与 B.2.3.1 的四态语义是同一条原则。
// 本模块是纯函数：不读 store、不读 env，方便单测锁口径。
// =====================================================================

export type RunMode = 'forced-demo' | 'sample' | 'live';

export interface RunModeBadge {
  label: string;
  /** 徽章 hover 提示：必须如实说明当前状态的数据来源 */
  title: string;
  /** 配色语义：demo = 非真实数据（橙），live = 真实执行（蓝） */
  tone: 'demo' | 'live';
}

/** env 开关的读取方式集中在这里，避免各处自己拼 `process.env`。 */
export function isForcedDemoMode(raw: string | undefined): boolean {
  return raw === 'true';
}

/**
 * 判定当前工作区处于哪种运行模式。
 *
 * @param forcedDemo   `NEXT_PUBLIC_DEMO_MODE === 'true'`（构建期内联）
 * @param taskStatus   当前任务状态；`idle` 表示本任务从未运行过
 */
export function resolveRunMode(opts: {
  forcedDemo: boolean;
  taskStatus: string;
}): RunMode {
  if (opts.forcedDemo) return 'forced-demo';
  // 只有「跑过」的任务才可能有真实结果；idle 状态下各区块一律吃 mock 兜底。
  return opts.taskStatus === 'idle' ? 'sample' : 'live';
}

export function runModeBadge(mode: RunMode): RunModeBadge {
  switch (mode) {
    case 'forced-demo':
      return {
        label: '演示模式',
        title: '本部署由 NEXT_PUBLIC_DEMO_MODE 标记为演示环境：分析、截图、评分均为模拟数据',
        tone: 'demo',
      };
    case 'sample':
      return {
        label: '示例数据',
        title: '本任务尚未运行生成 —— 各区块当前显示的是内置示例数据',
        tone: 'demo',
      };
    case 'live':
      return {
        label: 'AI 分析模式',
        title:
          '本任务为真实执行：截图与视觉分析由真实浏览器与模型完成，分数为真实评分；未做线上部署，产物以导出包交付',
        tone: 'live',
      };
  }
}
