import { createAgentRuntime, type AgentSession } from '@agent/core';
import { logger } from '@agent/shared';

import type { TauBenchAction, TauBenchMessage, BenchmarkResult } from '../types';

export interface TauBenchConfig {
  domain: 'retail' | 'airline';
  taskId?: string;
  maxTurns?: number;
}

let runtime: Awaited<ReturnType<typeof createAgentRuntime>> | null = null;

async function getOrCreateRuntime(): Promise<typeof runtime> {
  if (!runtime) {
    runtime = await createAgentRuntime({});
  }
  return runtime;
}

export async function createTauBenchAgent(config: TauBenchConfig) {
  const agentRuntime = await getOrCreateRuntime();

  return async function tauBenchAgentCallable(
    messages: TauBenchMessage[],
    tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>
  ): Promise<TauBenchAction> {
    const session = agentRuntime!.createSession();

    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m: TauBenchMessage) => m.role === 'user');

    if (!lastUserMessage) {
      return {
        type: 'message',
        content: 'No user message provided.',
      };
    }

    const systemContext = `You are a ${config.domain} customer service agent. Available tools: ${tools.map(t => t.name).join(', ')}`;

    const fullPrompt = `${systemContext}\n\nUser: ${lastUserMessage.content}`;

    const result = await session.send(fullPrompt);

    const hasToolCalls = result.toolsUsed.length > 0;

    if (hasToolCalls) {
      return {
        type: 'tool_call',
        toolCalls: result.toolsUsed.map(toolName => ({
          name: toolName,
          arguments: {},
        })),
      };
    }

    return {
      type: 'message',
      content: result.text,
    };
  };
}

export async function runTauBenchTask(
  config: TauBenchConfig,
  task: { id: string; messages: TauBenchMessage[]; tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }> }
): Promise<BenchmarkResult> {
  const startTime = Date.now();

  try {
    const agent = await createTauBenchAgent(config);
    const action = await agent(task.messages, task.tools);

    const durationMs = Date.now() - startTime;

    return {
      taskId: task.id,
      success: true,
      response: action.content || JSON.stringify(action.toolCalls),
      messages: task.messages.map(m => ({ role: m.role, content: m.content })),
      cost: 0,
      durationMs,
      toolsUsed: action.toolCalls?.map(tc => tc.name) || [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Tau-bench task failed', { taskId: task.id, error: errorMessage });

    return {
      taskId: task.id,
      success: false,
      response: '',
      messages: [],
      cost: 0,
      durationMs: Date.now() - startTime,
      toolsUsed: [],
      error: errorMessage,
    };
  }
}

export async function shutdown(): Promise<void> {
  if (runtime) {
    await runtime.shutdown();
    runtime = null;
  }
}

