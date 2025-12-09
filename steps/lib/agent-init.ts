import { initializeAgent, models, systemPrompts, type InitializationResult } from '@agent/core';

export interface MotiaStateAdapter {
  get(groupId: string, key: string): Promise<unknown>;
  set(groupId: string, key: string, value: unknown): Promise<void>;
}

export interface AgentContextOptions {
  sessionId: string;
  state: MotiaStateAdapter;
}

interface SessionState {
  activatedTools?: string[];
}

const STATE_GROUP = 'agent-sessions';

export async function getAgentContext(options: AgentContextOptions): Promise<InitializationResult> {
  const { sessionId, state } = options;

  const sessionState = (await state.get(STATE_GROUP, sessionId)) as SessionState | null;
  const initialActiveTools = sessionState?.activatedTools || [];

  const activationCallbacks = {
    onActivate: async (_toolName: string, allActiveTools: string[]) => {
      const current = (await state.get(STATE_GROUP, sessionId)) as SessionState | null;
      await state.set(STATE_GROUP, sessionId, {
        ...current,
        activatedTools: allActiveTools,
      });
    },
    onDeactivate: async (_toolName: string, allActiveTools: string[]) => {
      const current = (await state.get(STATE_GROUP, sessionId)) as SessionState | null;
      await state.set(STATE_GROUP, sessionId, {
        ...current,
        activatedTools: allActiveTools,
      });
    },
  };

  const result = await initializeAgent({
    workspaceRoot: process.env.WORKSPACE_ROOT,
    enableReadline: false,
    enableSemanticSearch: false,
    initialActiveTools,
    activationCallbacks,
  });

  return result;
}

export function getModel(tier: 'fast' | 'standard' | 'reasoning' | 'powerful' = 'standard') {
  return models[tier]();
}

export function getSystemPrompt(role: 'generic' | 'researcher' | 'coder' | 'analyst' = 'generic') {
  return systemPrompts[role];
}

export async function getActiveTools(options: AgentContextOptions): Promise<Record<string, any>> {
  const ctx = await getAgentContext(options);
  return ctx.tools;
}

