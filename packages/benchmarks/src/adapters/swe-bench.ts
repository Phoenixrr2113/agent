import { createAgentRuntime, type AgentSession } from '@agent/core';
import { logger } from '@agent/shared';
import type { BenchmarkResult } from '../types.js';

export interface SWEBenchTask {
  instance_id: string;
  problem_statement: string;
  repo: string;
  base_commit: string;
  patch?: string;
  test_patch?: string;
  hints_text?: string;
  created_at?: string;
  version?: string;
  environment_setup_commit?: string;
  FAIL_TO_PASS?: string;
  PASS_TO_PASS?: string;
}

export interface SWEBenchConfig {
  workspace?: string;
  includeHints?: boolean;
  maxMessages?: number;
}

export interface SWEBenchResult extends BenchmarkResult {
  repo: string;
  baseCommit: string;
  generatedPatch?: string;
  expectedPatch?: string;
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

export async function runSWEBenchTask(
  config: SWEBenchConfig,
  task: SWEBenchTask
): Promise<SWEBenchResult> {
  const startTime = Date.now();

  try {
    logger.info('SWE-bench adapter: Starting task', {
      instanceId: task.instance_id,
      repo: task.repo,
    });

    const agentSession = await getOrCreateSession(config.workspace);

    let prompt = `You are working on the repository: ${task.repo}

The following GitHub issue needs to be resolved:

${task.problem_statement}

Please analyze the issue and provide a solution. Generate a git patch that resolves this issue.`;

    if (config.includeHints && task.hints_text) {
      prompt += `\n\nHints from issue comments:\n${task.hints_text}`;
    }

    const result = await agentSession.send(prompt);

    const history = result.messages.map((msg) => ({
      role: msg.role as string,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));

    const durationMs = Date.now() - startTime;

    const patchMatch = result.text.match(/```(?:diff|patch)?\n([\s\S]*?)```/);
    const generatedPatch = patchMatch ? patchMatch[1].trim() : undefined;

    logger.info('SWE-bench adapter: Task completed', {
      instanceId: task.instance_id,
      repo: task.repo,
      success: result.completed,
      durationMs,
      hasPatch: !!generatedPatch,
    });

    return {
      taskId: task.instance_id,
      success: result.completed,
      response: result.text,
      messages: history,
      cost: 0,
      durationMs,
      toolsUsed: result.toolsUsed,
      repo: task.repo,
      baseCommit: task.base_commit,
      generatedPatch,
      expectedPatch: task.patch,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('SWE-bench adapter: Task failed', {
      instanceId: task.instance_id,
      error: errorMessage,
    });

    return {
      taskId: task.instance_id,
      success: false,
      response: '',
      messages: [],
      cost: 0,
      durationMs: Date.now() - startTime,
      toolsUsed: [],
      repo: task.repo,
      baseCommit: task.base_commit,
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

export function scoreSWEBenchResults(results: SWEBenchResult[]): {
  resolved: number;
  total: number;
  resolveRate: number;
} {
  const resolved = results.filter((r) => r.success && r.generatedPatch).length;
  const total = results.length;

  return {
    resolved,
    total,
    resolveRate: total > 0 ? resolved / total : 0,
  };
}

