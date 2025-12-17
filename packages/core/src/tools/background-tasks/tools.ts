import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { tool } from 'ai';
import { z } from 'zod';

import { getPersistentTaskManager } from './task-manager.js';
import { success, error } from '../utils/tool-result.js';

import type { TaskStatus } from './types.js';
import { AGENT_ROLES } from '../../core/agents/roles.js';

const MAX_CONCURRENT_AGENT_TASKS = 5;
const AGENT_TASK_PREFIX = 'agent-task-';

export const startBackgroundTaskTool = tool({
  description: 'Start a long-running command in the background. Task runs detached and persists across agent restarts. Perfect for: builds (hours), tests (hours), training jobs (days), monitoring scripts (weeks). Returns task ID for tracking.',
  inputSchema: z.object({
    command: z.string().max(10000).describe('Bash command to execute in background'),
    cwd: z.string().max(1000).optional().describe('Working directory (default: project root)'),
  }),
  execute: async ({ command, cwd }: { command: string; cwd?: string }) => {
    try {
      const taskManager = getPersistentTaskManager();
      const taskId = taskManager.startTask(command, cwd);

      return success({
        taskId,
        message: 'Task started in detached background process',
        command: command.substring(0, 100),
        status: 'running',
        persistent: true,
        instructions:
          'Task will continue running even if agent restarts. Use check_task_status to monitor and get_task_output to retrieve logs.',
      });
    } catch (error_) {
      return error(error_ instanceof Error ? error_ : String(error_), {
        context: 'Failed to start background task',
      });
    }
  },
});

export const checkTaskStatusTool = tool({
  description: 'Check status of a persistent background task. Returns: running, completed, failed, cancelled, or orphaned. Works across agent restarts.',
  inputSchema: z.object({
    taskId: z.string().describe('Task ID from start_background_task'),
  }),
  execute: async ({ taskId }: { taskId: string }) => {
    const taskManager = getPersistentTaskManager();
    const task = taskManager.getTask(taskId);

    if (!task) {
      return error('Task not found', { taskId });
    }

    const durationMs = task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime;
    const durationDays = durationMs / (1000 * 60 * 60 * 24);

    return success({
      taskId: task.id,
      status: task.status,
      command: task.command.substring(0, 100),
      pid: task.pid,
      durationMs,
      durationSec: (durationMs / 1000).toFixed(2),
      durationDays: durationDays.toFixed(2),
      exitCode: task.exitCode,
      persistent: true,
    });
  },
});

export const getTaskOutputTool = tool({
  description: 'Retrieve output from a persistent background task. Can fetch stdout or stderr, from beginning or end of log. Logs persist across agent restarts.',
  inputSchema: z.object({
    taskId: z.string().describe('Task ID from start_background_task'),
    maxBytes: z.number().optional().describe('Maximum bytes to return (default: 100000)'),
    fromEnd: z.boolean().optional().describe('Read from end of log instead of beginning (default: true)'),
    stderr: z.boolean().optional().describe('Get stderr instead of stdout (default: false)'),
  }),
  execute: async ({
    taskId,
    maxBytes = 100000,
    fromEnd = true,
    stderr = false,
  }: {
    taskId: string;
    maxBytes?: number;
    fromEnd?: boolean;
    stderr?: boolean;
  }) => {
    try {
      const taskManager = getPersistentTaskManager();
      const task = taskManager.getTask(taskId);

      if (!task) {
        return error('Task not found', { taskId });
      }

      const output = taskManager.getTaskOutput(taskId, {
        maxBytes,
        fromEnd,
        stderr,
      });

      return success({
        taskId: task.id,
        command: task.command,
        status: task.status,
        exitCode: task.exitCode,
        output: output.content,
        outputSize: output.size,
        outputTruncated: output.truncated,
        outputType: stderr ? 'stderr' : 'stdout',
        fromEnd,
      });
    } catch (error_) {
      return error(error_ instanceof Error ? error_ : String(error_), {
        context: 'Failed to get task output',
        taskId,
      });
    }
  },
});

export const cancelTaskTool = tool({
  description: 'Cancel a running persistent background task. Sends SIGTERM to the process.',
  inputSchema: z.object({
    taskId: z.string().describe('Task ID from start_background_task'),
  }),
  execute: async ({ taskId }: { taskId: string }) => {
    const taskManager = getPersistentTaskManager();
    const task = taskManager.getTask(taskId);

    if (!task) {
      return error('Task not found', { taskId });
    }

    if (task.status !== 'running') {
      return error('Task is not running', { taskId, status: task.status });
    }

    const cancelled = taskManager.cancelTask(taskId);

    if (cancelled) {
      return success({
        message: 'Task cancelled successfully',
        taskId,
      });
    } else {
      return error('Failed to cancel task', { taskId });
    }
  },
});

export const listTasksTool = tool({
  description: 'List persistent background tasks. Shows tasks across agent restarts. Filter by status.',
  inputSchema: z.object({
    status: z
      .enum(['running', 'completed', 'failed', 'cancelled', 'orphaned', 'all'])
      .optional()
      .describe('Filter by status (default: all)'),
    limit: z.number().optional().describe('Maximum tasks to return (default: 50)'),
  }),
  execute: async ({
    status = 'all',
    limit = 50,
  }: {
    status?: 'running' | 'completed' | 'failed' | 'cancelled' | 'orphaned' | 'all';
    limit?: number;
  }) => {
    const taskManager = getPersistentTaskManager();

    const filter: { status?: TaskStatus; limit: number } = { limit };
    if (status !== 'all') {
      filter.status = status as TaskStatus;
    }

    const tasks = taskManager.getAllTasks(filter);

    const summary = tasks.map(task => ({
      taskId: task.id,
      command: task.command.substring(0, 50),
      status: task.status,
      pid: task.pid,
      durationMs: task.endTime
        ? task.endTime - task.startTime
        : Date.now() - task.startTime,
      exitCode: task.exitCode,
    }));

    return success({
      total: tasks.length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
      orphaned: tasks.filter(t => t.status === 'orphaned').length,
      tasks: summary,
      persistent: true,
    });
  },
});

export const cleanupOldTasksTool = tool({
  description: 'Clean up old completed/failed tasks and their logs. Useful for freeing disk space.',
  inputSchema: z.object({
    olderThanDays: z.number().describe('Delete tasks older than this many days'),
  }),
  execute: async ({ olderThanDays }: { olderThanDays: number }) => {
    const taskManager = getPersistentTaskManager();
    const olderThanMs = olderThanDays * 24 * 60 * 60 * 1000;

    const count = taskManager.cleanupOldTasks(olderThanMs);

    return success({
      message: `Cleaned up ${count} old tasks`,
      count,
      olderThanDays,
    });
  },
});

export const spawnAgentTool = tool({
  description: `Spawn an autonomous sub-agent to work on a task.
  - Default (streaming: false): Runs in background (detached). Persists across restarts. Returns taskId. Use for long builds/tests.
  - Streaming (streaming: true): Runs in-process (attached). Streams thoughts/events. Returns final result. Use for interactive sub-tasks.
  LIMIT: Maximum ${MAX_CONCURRENT_AGENT_TASKS} concurrent background agents.`,
  inputSchema: z.object({
    task: z.string().max(5000).describe('The task for the agent to complete autonomously'),
    workspaceRoot: z.string().max(1000).optional().describe('Workspace root directory (default: current)'),
    maxSteps: z.number().int().min(1).max(200).optional().describe('Maximum number of steps (default: 50)'),
    streaming: z.boolean().optional().default(false).describe('If true, runs in-process and streams events (default: false)'),
    role: z.enum(AGENT_ROLES).optional().default('generic').describe('Role specialization of the agent'),
  }),
  execute: async ({
    task,
    workspaceRoot,
    maxSteps = 50,
    streaming = false,
  }: {
    task: string;
    workspaceRoot?: string;
    maxSteps?: number;
    streaming?: boolean;
    role?: string;
  }) => {
    if (streaming) {
      throw new Error('Streaming mode requires runtime injection. This error should not be seen if AgentRuntime is configured correctly.');
    }

    try {
      const taskManager = getPersistentTaskManager();

      const runningAgentTasks = taskManager
        .getAllTasks({ status: 'running', limit: 100 })
        .filter(t => t.command.includes(AGENT_TASK_PREFIX));

      if (runningAgentTasks.length >= MAX_CONCURRENT_AGENT_TASKS) {
        return error(
          `Maximum concurrent agent tasks reached (${MAX_CONCURRENT_AGENT_TASKS}). Wait for existing agents to complete or cancel them.`,
          {
            runningAgents: runningAgentTasks.length,
            maxAllowed: MAX_CONCURRENT_AGENT_TASKS,
          }
        );
      }

      const taskJson = JSON.stringify(task);
      const workspaceRootJson = workspaceRoot ? JSON.stringify(workspaceRoot) : 'process.cwd()';

      const agentScript = `
const { createAgentRuntime } = require('@agent/core');
const { logger } = require('@agent/shared');

async function runAgentTask() {
  const TASK = ${taskJson};
  const runtime = await createAgentRuntime({
    workspaceRoot: ${workspaceRootJson},
    maxSteps: ${maxSteps},
    disableAgentSpawning: true,
    role: 'spawned_agent',
  });

  try {
    const session = runtime.createSession();

    logger.info('🤖 Agent starting autonomous task...');
    logger.info('Task: ' + TASK);
    logger.info('Max steps: ${maxSteps}');
    logger.info('');

    const result = await session.runTask({
      prompt: TASK,
    });

    logger.info('');
    logger.info('✅ Agent completed task');
    logger.info('Steps used: ' + result.stepsUsed + ' / ${maxSteps}');
    logger.info('Tools used: ' + result.toolsUsed.join(', '));
    logger.info('Completed: ' + result.completed);
    logger.info('');
    logger.info('Result:');
    logger.info(result.text);

    process.exit(result.completed ? 0 : 1);
  } catch (error) {
    logger.error('❌ Agent task failed:', { error: error.message });
    process.exit(1);
  } finally {
    await runtime.shutdown();
  }
}

runAgentTask();
      `.trim();

      const scriptPath = join(process.cwd(), '.agent', `${AGENT_TASK_PREFIX}${randomBytes(4).toString('hex')}.js`);
      writeFileSync(scriptPath, agentScript);

      const command = `node "${scriptPath}" && rm "${scriptPath}"`;
      const taskId = taskManager.startTask(command, workspaceRoot);

      return success({
        taskId,
        message: 'Autonomous agent task started',
        task: task.substring(0, 100),
        status: 'running',
        autonomous: true,
        instructions:
          'Agent will work independently. Use check_task_status and get_task_output to monitor progress.',
      });
    } catch (error_) {
      return error(error_ instanceof Error ? error_ : String(error_), {
        context: 'Failed to start agent task',
      });
    }
  },
});

export const persistentBackgroundTaskTools = {
  start_background_task: startBackgroundTaskTool,
  spawn_agent: spawnAgentTool,
  check_task_status: checkTaskStatusTool,
  get_task_output: getTaskOutputTool,
  cancel_task: cancelTaskTool,
  list_tasks: listTasksTool,
  cleanup_old_tasks: cleanupOldTasksTool,
};
