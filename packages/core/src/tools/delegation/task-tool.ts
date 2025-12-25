import { tool } from 'ai';
import { z } from 'zod';

import { logger } from '@agent/shared';
import { success, error } from '../utils/tool-result.js';
import { ToolError, ToolErrorType } from '../middleware/index.js';
import { getPersistentTaskManager } from '../background-tasks/task-manager.js';
import type { PersistentTaskInfo } from '../background-tasks/types.js';

const DESCRIPTION = `A unified tool for managing background tasks, sub-agents, and long-running processes.
Use this to monitor, retrieve output from, or cancel tasks started via the delegate tool.

When to use this tool:
- Checking if a background task or sub-agent has completed
- Retrieving output/logs from a running or completed task
- Cancelling a task that is no longer needed
- Listing all tasks to see what's running or recently completed
- Polling for task completion with efficient waiting

When NOT to use this tool:
- Starting new tasks (use delegate tool instead)
- Direct shell commands (use shell tool)
- Tasks you just started - give them time to produce output

Task states:
- running: Task is currently executing
- completed: Task finished successfully (exit code 0)
- failed: Task exited with an error (non-zero exit code)
- cancelled: Task was manually cancelled
- orphaned: Task's process was lost (e.g., after system restart)

Actions:
- status: Check if a task is running, completed, failed, etc. Use waitSeconds to poll efficiently.
- output: Get stdout/stderr from a task. Supports reading from beginning or end.
- cancel: Stop a running task. Sends SIGTERM.
- list: Show all tasks, optionally filtered by status.
- cleanup: Remove old completed/failed tasks to free disk space.

Parameters explained:
- action: Required. One of: status, output, cancel, list, cleanup
- taskId: For status/output/cancel. The ID from delegate tool.
- waitSeconds: For status. Wait this long before checking (efficient polling, 10-60s recommended).
- maxBytes: For output. Maximum bytes to return (default: 100000).
- fromEnd: For output. Read from end of log (default: true, like tail).
- stderr: For output. Get stderr instead of stdout (default: false).
- statusFilter: For list. Filter by task status.
- limit: For list. Maximum tasks to return.
- olderThanDays: For cleanup. Delete tasks older than this.

Efficient polling pattern:
1. Call status with waitSeconds: 30 (waits up to 30s for completion)
2. If still running, repeat with appropriate waitSeconds
3. Don't poll more frequently than every 10 seconds

You should:
1. Use waitSeconds to avoid rapid polling loops
2. Check status before assuming a task is done
3. Use fromEnd: true to get the latest output
4. Clean up old tasks periodically to free disk space
5. Cancel tasks you no longer need`;

const taskInputSchema = z.object({
  action: z.enum(['status', 'output', 'cancel', 'list', 'cleanup']).describe('Task management action'),
  
  taskId: z.string().optional().describe('For status/output/cancel: task ID from delegate tool'),
  waitSeconds: z.number().min(0).max(300).optional().describe('For status: wait this long before checking'),
  
  maxBytes: z.number().optional().describe('For output: max bytes to return (default: 100000)'),
  fromEnd: z.boolean().optional().describe('For output: read from end (default: true)'),
  stderr: z.boolean().optional().describe('For output: get stderr instead (default: false)'),
  
  statusFilter: z.enum(['running', 'completed', 'failed', 'cancelled', 'orphaned', 'all']).optional()
    .describe('For list: filter by status'),
  limit: z.number().optional().describe('For list: max tasks to return'),
  
  olderThanDays: z.number().optional().describe('For cleanup: delete tasks older than this'),
});

export const createTaskTool = () => {
  return tool({
    description: DESCRIPTION,
    inputSchema: taskInputSchema,
    execute: async (input) => {
      const { action } = input;
      const taskManager = getPersistentTaskManager();

      switch (action) {
        case 'status': {
          const { taskId, waitSeconds = 0 } = input;
          
          if (!taskId) {
            throw new ToolError('taskId is required for status action', ToolErrorType.INVALID_INPUT);
          }

          if (waitSeconds > 0) {
            await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
          }

          const task = taskManager.getTask(taskId);
          if (!task) {
            return error('Task not found', { taskId });
          }

          const baseInfo = {
            taskId,
            status: task.status,
            command: task.command,
            startedAt: new Date(task.startTime).toISOString(),
          };

          if (task.status === 'completed' || task.status === 'failed') {
            return success({
              ...baseInfo,
              exitCode: task.exitCode,
              endedAt: task.endTime ? new Date(task.endTime).toISOString() : undefined,
              durationMs: task.endTime ? task.endTime - task.startTime : undefined,
              hint: 'Use action: output to get the task output',
            });
          }

          if (task.status === 'running') {
            const durationMs = Date.now() - task.startTime;
            return success({
              ...baseInfo,
              runningForMs: durationMs,
              runningForFormatted: formatDuration(durationMs),
              hint: waitSeconds === 0 
                ? 'Use waitSeconds to poll efficiently instead of rapid calls'
                : 'Task still running. Call again with waitSeconds to continue polling.',
            });
          }

          return success(baseInfo);
        }

        case 'output': {
          const { taskId, maxBytes = 100000, fromEnd = true, stderr = false } = input;
          
          if (!taskId) {
            throw new ToolError('taskId is required for output action', ToolErrorType.INVALID_INPUT);
          }

          const output = taskManager.getTaskOutput(taskId, {
            maxBytes,
            fromEnd,
            stderr,
          });

          if (!output) {
            return error('Task not found or no output available', { taskId });
          }

          return success({
            taskId,
            stream: stderr ? 'stderr' : 'stdout',
            output: output.content,
            bytes: output.size,
            truncated: output.truncated,
            fromEnd,
          });
        }

        case 'cancel': {
          const { taskId } = input;
          
          if (!taskId) {
            throw new ToolError('taskId is required for cancel action', ToolErrorType.INVALID_INPUT);
          }

          const cancelled = taskManager.cancelTask(taskId);
          
          if (cancelled) {
            logger.info(`Task cancelled`, { taskId });
            return success({
              taskId,
              message: 'Task cancelled successfully',
            });
          }

          return error('Cannot cancel task - not found or not running', { taskId });
        }

        case 'list': {
          const { statusFilter = 'all', limit = 50 } = input;

          const tasks = taskManager.getAllTasks({
            status: statusFilter === 'all' ? undefined : statusFilter,
            limit,
          });

          const summary = {
            running: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            orphaned: 0,
          };

          for (const task of tasks) {
            if (task.status in summary) {
              summary[task.status as keyof typeof summary]++;
            }
          }

          return success({
            count: tasks.length,
            summary,
            tasks: tasks.map((t: PersistentTaskInfo) => ({
              taskId: t.id,
              status: t.status,
              command: t.command.slice(0, 80) + (t.command.length > 80 ? '...' : ''),
              startedAt: new Date(t.startTime).toISOString(),
            })),
          });
        }

        case 'cleanup': {
          const { olderThanDays } = input;
          
          if (!olderThanDays || olderThanDays < 1) {
            throw new ToolError('olderThanDays is required and must be >= 1', ToolErrorType.INVALID_INPUT);
          }

          const olderThanMs = olderThanDays * 24 * 60 * 60 * 1000;
          const deleted = taskManager.cleanupOldTasks(olderThanMs);

          return success({
            message: `Cleaned up old tasks`,
            deletedCount: deleted,
            olderThanDays,
          });
        }

        default:
          throw new ToolError(`Unknown action: ${action}`, ToolErrorType.INVALID_INPUT);
      }
    },
  });
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
