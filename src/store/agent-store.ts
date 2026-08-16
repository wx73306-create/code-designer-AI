import { create } from 'zustand';
import type {
  Agent,
  AgentId,
  AgentStoreState,
  ActiveSection,
  LogEntry,
  Task,
} from '@/types/agent';

// ---------------------------------------------------------------------------
// Agent definitions
// ---------------------------------------------------------------------------

const AGENT_DEFINITIONS: Record<AgentId, { name: string; icon: string }> = {
  browser: { name: 'Browser Agent', icon: 'Globe' },
  vision: { name: 'Vision Agent', icon: 'Eye' },
  stylematcher: { name: 'Style Matcher Agent', icon: 'Palette' },
  critic: { name: 'Design Critic Agent', icon: 'Sparkles' },
  planning: { name: 'Planning Agent', icon: 'Brain' },
  code: { name: 'Code Agent', icon: 'Code2' },
  qa: { name: 'QA Agent', icon: 'ShieldCheck' },
  deploy: { name: 'Export Agent', icon: 'Download' },
  preview: { name: 'Preview Agent', icon: 'MonitorPlay' },
};

const AGENT_IDS: AgentId[] = [
  'browser',
  'vision',
  'stylematcher',
  'critic',
  'planning',
  'code',
  'qa',
  'deploy',
  'preview',
];

function createAgent(id: AgentId): Agent {
  const def = AGENT_DEFINITIONS[id];
  return {
    id,
    name: def.name,
    icon: def.icon,
    status: 'idle',
    progress: 0,
    logs: [],
    startTime: null,
    endTime: null,
  };
}

function createAgents(): Record<AgentId, Agent> {
  const agents = {} as Record<AgentId, Agent>;
  for (const id of AGENT_IDS) {
    agents[id] = createAgent(id);
  }
  return agents;
}

// ---------------------------------------------------------------------------
// Initial task factory
// ---------------------------------------------------------------------------

function createInitialTask(): Task {
  return {
    id: '',
    url: '',
    goal: null,
    mode: 'enhancement',
    model: '',
    prompt: '',
    status: 'idle',
    currentAgent: null,
    agents: createAgents(),
    designAnalysis: null,
    designDecision: null,
    styleMatch: null,
    designSystem: null,
    enhancementPlan: null,
    codeValidation: null,
    componentTree: null,
    generatedCode: null,
    qaResult: null,
    deployResult: null,
    projectStructure: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    aiPreviewHtml: null,
    previewHtml: null,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  task: createInitialTask(),
  activeSection: 'home',
  isRunning: false,

  // ---- Actions ----

  startTask: (url: string, goal?: import('@/types/agent').GoalType, prompt?: string, mode?: import('@/types/agent').ModeType, model?: string) => {
    const now = Date.now();
    set({
      task: {
        ...createInitialTask(),
        id: `task_${now.toString(36)}`,
        url,
        goal: goal ?? null,
        mode: mode ?? 'enhancement',
        model: model ?? '',
        prompt: prompt ?? '',
        status: 'running',
        startedAt: now,
      },
      activeSection: 'analysis',
      isRunning: true,
    });
  },

  cancelTask: () => {
    const state = get();
    const currentAgent = state.task.currentAgent;

    // Mark the currently running agent as errored (cancelled)
    if (currentAgent) {
      const agent = state.task.agents[currentAgent];
      if (agent && agent.status === 'running') {
        state.updateAgent(currentAgent, { status: 'error' });
        state.addLog(currentAgent, { message: '任务已被用户取消', type: 'warning' });
      }
    }

    set((s) => ({
      isRunning: false,
      task: { ...s.task, status: 'idle' as const },
    }));
  },

  resetTask: () => {
    set({
      task: createInitialTask(),
      activeSection: 'home',
      isRunning: false,
    });
  },

  updateAgent: (agentId: AgentId, partial: Partial<Agent>) => {
    set((state) => {
      const current = state.task.agents[agentId];
      if (!current) return state;

      const updatedAgent: Agent = { ...current, ...partial };

      // Auto-derive timing fields based on status transitions
      if (partial.status === 'running' && !current.startTime) {
        updatedAgent.startTime = Date.now();
      }
      if (
        (partial.status === 'completed' || partial.status === 'error') &&
        !current.endTime
      ) {
        updatedAgent.endTime = Date.now();
      }

      // Clamp progress
      if (partial.progress !== undefined) {
        updatedAgent.progress = Math.min(100, Math.max(0, partial.progress));
      }

      return {
        task: {
          ...state.task,
          currentAgent: agentId,
          agents: {
            ...state.task.agents,
            [agentId]: updatedAgent,
          },
        },
      };
    });
  },

  addLog: (agentId: AgentId, entry: Omit<LogEntry, 'timestamp'>) => {
    set((state) => {
      const current = state.task.agents[agentId];
      if (!current) return state;

      const newLog: LogEntry = {
        ...entry,
        timestamp: Date.now(),
      };

      return {
        task: {
          ...state.task,
          agents: {
            ...state.task.agents,
            [agentId]: {
              ...current,
              logs: [...current.logs, newLog],
            },
          },
        },
      };
    });
  },

  setActiveSection: (section: ActiveSection) => {
    set({ activeSection: section });
  },

  setTaskPartial: (partial: Partial<Task>) => {
    set((state) => ({
      task: { ...state.task, ...partial },
    }));
  },
}));

// ---------------------------------------------------------------------------
// Selectors (for use outside of React components or to reduce re-renders)
// ---------------------------------------------------------------------------

export const selectAgent = (id: AgentId) => (state: AgentStoreState) =>
  state.task.agents[id];

export const selectAllAgents = (state: AgentStoreState) => state.task.agents;

export const selectIsRunning = (state: AgentStoreState) => state.isRunning;

export const selectActiveSection = (state: AgentStoreState) =>
  state.activeSection;

export const selectTask = (state: AgentStoreState) => state.task;
