import { createAgentRuntime, type AgentSession } from '@agent/core';
import { logger } from '@agent/shared';
import type { HALRunResult, BenchmarkTask } from '../types.js';

export interface HALAgentArgs {
  model_name?: string;
  max_steps?: number;
  workspace?: string;
}

let runtime: Awaited<ReturnType<typeof createAgentRuntime>> | null = null;
let session: AgentSession | null = null;

async function getOrCreateSession(workspace?: string): Promise<AgentSession> {
  if (!runtime) {
    runtime = await createAgentRuntime({
      workspaceRoot: workspace,
    });
  }
  if (!session) {
    session = runtime.createSession();
  }
  return session;
}

export async function run(
  taskId: string,
  task: BenchmarkTask,
  agentArgs: HALAgentArgs = {}
): Promise<HALRunResult> {
  const startTime = Date.now();

  try {
    logger.info('HAL adapter: Starting task', { taskId, agentArgs });

    const agentSession = await getOrCreateSession(agentArgs.workspace);

    const prompt = task.prompt || task.instruction || '';

    if (!prompt) {
      throw new Error('Task must have either prompt or instruction');
    }

    const result = await agentSession.send(prompt);

    const history = result.messages.map(msg => ({
      role: msg.role as string,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));

    const durationMs = Date.now() - startTime;

    logger.info('HAL adapter: Task completed', {
      taskId,
      success: result.completed,
      durationMs,
      toolsUsed: result.toolsUsed,
    });

    return {
      [taskId]: {
        history,
        cost: 0.0,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('HAL adapter: Task failed', { taskId, error: errorMessage });

    return {
      [taskId]: {
        history: [
          {
            role: 'assistant',
            content: `Error: ${errorMessage}`,
          },
        ],
        cost: 0.0,
      },
    };
  }
}

export async function shutdown(): Promise<void> {
  if (runtime) {
    await runtime.shutdown();
    runtime = null;
    session = null;
  }
}

export async function resetSession(): Promise<void> {
  if (session) {
    session.clearHistory();
  }
  session = null;
}

