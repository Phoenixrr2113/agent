import { createAgentRuntime, type AgentSession } from '@agent/core';
import { logger } from '@agent/shared';

import type { BenchmarkResult } from '../types.js';

export interface GAIATask {
  task_id: string;
  Question: string;
  Level: 1 | 2 | 3;
  'Final answer'?: string;
  file_name?: string;
  file_path?: string;
  'Annotator Metadata'?: {
    Steps: string;
    'How long did this take?': string;
    Tools: string[];
    'Number of steps': number;
  };
}

export interface GAIAConfig {
  level?: 1 | 2 | 3 | 'all';
  split?: 'validation' | 'test';
  maxMessages?: number;
  workspace?: string;
  dataDir?: string;
}

export interface GAIAResult extends BenchmarkResult {
  level: number;
  expectedAnswer?: string;
  isCorrect?: boolean;
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

export async function runGAIATask(
  config: GAIAConfig,
  task: GAIATask
): Promise<GAIAResult> {
  const startTime = Date.now();

  try {
    logger.info('GAIA adapter: Starting task', {
      taskId: task.task_id,
      level: task.Level,
    });

    const agentSession = await getOrCreateSession(config.workspace);

    let prompt = task.Question;

    if (task.file_path && config.dataDir) {
      prompt = `${prompt}\n\n[Associated file: ${task.file_path}]`;
    }

    const result = await agentSession.send(prompt);

    const history = result.messages.map((msg) => ({
      role: msg.role as string,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));

    const durationMs = Date.now() - startTime;

    const expectedAnswer = task['Final answer'];
    let isCorrect: boolean | undefined;

    if (expectedAnswer !== undefined) {
      const agentAnswer = result.text.trim().toLowerCase();
      const expected = expectedAnswer.trim().toLowerCase();
      isCorrect = agentAnswer.includes(expected) || expected.includes(agentAnswer);
    }

    logger.info('GAIA adapter: Task completed', {
      taskId: task.task_id,
      level: task.Level,
      success: result.completed,
      durationMs,
      isCorrect,
    });

    return {
      taskId: task.task_id,
      success: result.completed,
      response: result.text,
      messages: history,
      cost: 0,
      durationMs,
      toolsUsed: result.toolsUsed,
      level: task.Level,
      expectedAnswer,
      isCorrect,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('GAIA adapter: Task failed', {
      taskId: task.task_id,
      error: errorMessage,
    });

    return {
      taskId: task.task_id,
      success: false,
      response: '',
      messages: [],
      cost: 0,
      durationMs: Date.now() - startTime,
      toolsUsed: [],
      level: task.Level,
      error: errorMessage,
    };
  }
}

export async function resetSession(): Promise<void> {
  if (session) {
    session.clearHistory();
  }
  session = null;
}

export async function shutdown(): Promise<void> {
  if (runtime) {
    await runtime.shutdown();
    runtime = null;
    session = null;
  }
}

export function scoreGAIAResults(results: GAIAResult[]): {
  overall: number;
  byLevel: Record<number, number>;
} {
  const byLevel: Record<number, { correct: number; total: number }> = {
    1: { correct: 0, total: 0 },
    2: { correct: 0, total: 0 },
    3: { correct: 0, total: 0 },
  };

  for (const result of results) {
    byLevel[result.level]!.total++;
    if (result.isCorrect) {
      byLevel[result.level]!.correct++;
    }
  }

  const totalCorrect = Object.values(byLevel).reduce((sum, l) => sum + l.correct, 0);
  const totalTasks = Object.values(byLevel).reduce((sum, l) => sum + l.total, 0);

  return {
    overall: totalTasks > 0 ? totalCorrect / totalTasks : 0,
    byLevel: {
      1: (byLevel[1]?.total ?? 0) > 0 ? (byLevel[1]?.correct ?? 0) / (byLevel[1]?.total ?? 1) : 0,
      2: (byLevel[2]?.total ?? 0) > 0 ? (byLevel[2]?.correct ?? 0) / (byLevel[2]?.total ?? 1) : 0,
      3: (byLevel[3]?.total ?? 0) > 0 ? (byLevel[3]?.correct ?? 0) / (byLevel[3]?.total ?? 1) : 0,
    },
  };
}

