import { tool } from 'ai';
import { z } from 'zod';
import { spawn, type ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, unlinkSync, statSync, readFileSync, openSync, closeSync, readSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { logger } from '@agent/shared';

export type TaskStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'orphaned';

export interface PersistentTaskInfo {
  id: string;
  command: string;
  status: TaskStatus;
  pid?: number;
  startTime: number;
  endTime?: number;
  exitCode?: number;
  cwd?: string;
  logFile?: string;
  errorLogFile?: string;
}

const TASK_DB_SCHEMA = `
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    command TEXT NOT NULL,
    status TEXT NOT NULL,
    pid INTEGER,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    exit_code INTEGER,
    cwd TEXT,
    log_file TEXT,
    error_log_file TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_pid ON tasks(pid);
`;

export interface TaskMonitorCallback {
  (event: 'task_completed' | 'task_failed' | 'task_orphaned', task: PersistentTaskInfo): void;
}

class PersistentTaskManager {
  private db: Database.Database;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private logsDir: string;
  private dbPath: string;
  private checkInterval: NodeJS.Timeout;
  private monitorInterval: NodeJS.Timeout | null = null;
  private maxLogSize = 100 * 1024 * 1024;
  private monitorCallback: TaskMonitorCallback | null = null;
  private lastKnownStates: Map<string, TaskStatus> = new Map();
  private readonly MAX_CONCURRENT_TASKS = 50;

  constructor(workspaceRoot?: string) {
    const baseDir = workspaceRoot || process.cwd();
    const agentDir = join(baseDir, '.agent');

    if (!existsSync(agentDir)) {
      mkdirSync(agentDir, { recursive: true });
    }

    this.logsDir = join(agentDir, 'task-logs');
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
    }

    this.dbPath = join(agentDir, 'tasks.db');
    this.db = new Database(this.dbPath);
    this.db.exec(TASK_DB_SCHEMA);

    this.checkInterval = setInterval(() => {
      this.checkOrphanedTasks();
    }, 30000);

    this.resumeRunningTasks();
  }

  private resumeRunningTasks(): void {
    const runningTasks = this.db
      .prepare('SELECT * FROM tasks WHERE status = ?')
      .all('running') as any[];

    for (const task of runningTasks) {
      const isRunning = this.isProcessRunning(task.pid);

      if (!isRunning) {
        logger.info('Orphaned task detected', {
          taskId: task.id,
          pid: task.pid,
        });

        this.db
          .prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?')
          .run('orphaned', new Date().toISOString(), task.id);
      } else {
        logger.info('Reconnected to running task', {
          taskId: task.id,
          pid: task.pid,
        });
      }
    }
  }

  private checkOrphanedTasks(): void {
    const runningTasks = this.db
      .prepare('SELECT * FROM tasks WHERE status = ?')
      .all('running') as any[];

    for (const task of runningTasks) {
      if (task.pid && !this.isProcessRunning(task.pid)) {
        logger.info('Task process no longer running', {
          taskId: task.id,
          pid: task.pid,
        });

        this.db
          .prepare('UPDATE tasks SET status = ?, end_time = ?, updated_at = ? WHERE id = ?')
          .run('orphaned', Date.now(), new Date().toISOString(), task.id);
      }
    }

    this.truncateOversizedLogs();
  }

  private truncateOversizedLogs(): void {
    const allTasks = this.db
      .prepare('SELECT * FROM tasks WHERE status = ?')
      .all('running') as any[];

    for (const task of allTasks) {
      this.truncateLogIfNeeded(task.log_file);
      this.truncateLogIfNeeded(task.error_log_file);
    }
  }

  private truncateLogIfNeeded(logFile: string | null): void {
    if (!logFile || !existsSync(logFile)) return;

    try {
      const stats = statSync(logFile);
      if (stats.size <= this.maxLogSize) return;

      const keepBytes = Math.floor(this.maxLogSize * 0.9);
      const buffer = Buffer.alloc(keepBytes);
      const fd = openSync(logFile, 'r');

      try {
        const position = stats.size - keepBytes;
        readSync(fd, buffer, 0, keepBytes, position);
      } finally {
        closeSync(fd);
      }

      const { writeFileSync } = require('fs');
      writeFileSync(logFile, buffer);

      logger.info('Truncated oversized log file', {
        logFile,
        originalSize: stats.size,
        newSize: keepBytes,
      });
    } catch (err) {
      logger.debug('Could not truncate log file', { logFile, error: String(err) });
    }
  }

  private isProcessRunning(pid: number | null | undefined): boolean {
    if (!pid) return false;

    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return false;
    }
  }

  generateTaskId(): string {
    return `task_${randomBytes(8).toString('hex')}`;
  }

  startTask(command: string, cwd?: string): string {
    const running = this.getAllTasks({ status: 'running' });
    if (running.length >= this.MAX_CONCURRENT_TASKS) {
      throw new Error(`Maximum concurrent tasks (${this.MAX_CONCURRENT_TASKS}) reached`);
    }

    const taskId = this.generateTaskId();
    const now = Date.now();
    const isoNow = new Date().toISOString();

    const logFile = join(this.logsDir, `${taskId}.log`);
    const errorLogFile = join(this.logsDir, `${taskId}.error.log`);

    const stdoutFd = openSync(logFile, 'a');
    const stderrFd = openSync(errorLogFile, 'a');

    const proc = spawn('bash', ['-c', command], {
      cwd: cwd || process.cwd(),
      env: { ...process.env, TERM: 'dumb' },
      detached: true,
      stdio: ['ignore', stdoutFd, stderrFd],
    });

    closeSync(stdoutFd);
    closeSync(stderrFd);

    const pid = proc.pid;

    proc.unref();

    this.db
      .prepare(
        `INSERT INTO tasks (id, command, status, pid, start_time, cwd, log_file, error_log_file, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        taskId,
        command,
        'running',
        pid,
        now,
        cwd || process.cwd(),
        logFile,
        errorLogFile,
        isoNow,
        isoNow
      );

    this.activeProcesses.set(taskId, proc);

    proc.on('error', (err) => {
      logger.error('Process error', { taskId, error: String(err) });
    });

    proc.on('exit', (code: number | null) => {
      const exitCode = code ?? 1;
      const status = exitCode === 0 ? 'completed' : 'failed';

      try {
        if (this.db.open) {
          this.db
            .prepare(
              'UPDATE tasks SET status = ?, exit_code = ?, end_time = ?, updated_at = ? WHERE id = ?'
            )
            .run(status, exitCode, Date.now(), new Date().toISOString(), taskId);
        }
      } catch (err) {
        logger.debug('Could not update task status on exit', { taskId, error: String(err) });
      }

      this.activeProcesses.delete(taskId);

      logger.info('Background task completed', {
        taskId,
        status,
        exitCode,
        pid,
      });
    });

    logger.info('Started detached background task', {
      taskId,
      command: command.substring(0, 100),
      pid,
      cwd: cwd || process.cwd(),
    });

    return taskId;
  }

  getTask(taskId: string): PersistentTaskInfo | undefined {
    const row = this.db
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(taskId) as any;

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      command: row.command,
      status: row.status as TaskStatus,
      pid: row.pid,
      startTime: row.start_time,
      endTime: row.end_time,
      exitCode: row.exit_code,
      cwd: row.cwd,
      logFile: row.log_file,
      errorLogFile: row.error_log_file,
    };
  }

  getAllTasks(filter?: { status?: TaskStatus; limit?: number }): PersistentTaskInfo[] {
    let query = 'SELECT * FROM tasks';
    const params: any[] = [];

    if (filter?.status) {
      query += ' WHERE status = ?';
      params.push(filter.status);
    }

    query += ' ORDER BY start_time DESC';

    if (filter?.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      command: row.command,
      status: row.status as TaskStatus,
      pid: row.pid,
      startTime: row.start_time,
      endTime: row.end_time,
      exitCode: row.exit_code,
      cwd: row.cwd,
      logFile: row.log_file,
      errorLogFile: row.error_log_file,
    }));
  }

  getTaskOutput(
    taskId: string,
    options: {
      maxBytes?: number;
      fromEnd?: boolean;
      stderr?: boolean;
    } = {}
  ): { content: string; size: number; truncated: boolean } {
    const task = this.getTask(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    const logFile = options.stderr ? task.errorLogFile : task.logFile;

    if (!logFile || !existsSync(logFile)) {
      return { content: '', size: 0, truncated: false };
    }

    const stats = statSync(logFile);
    const fileSize = stats.size;
    const maxBytes = options.maxBytes || 100000;

    if (fileSize === 0) {
      return { content: '', size: 0, truncated: false };
    }

    if (fileSize <= maxBytes) {
      const content = readFileSync(logFile, 'utf8');
      return { content, size: fileSize, truncated: false };
    }

    const buffer = Buffer.alloc(maxBytes);
    const fd = openSync(logFile, 'r');

    try {
      let bytesRead: number;

      if (options.fromEnd) {
        const position = Math.max(0, fileSize - maxBytes);
        bytesRead = readSync(fd, buffer, 0, maxBytes, position);
      } else {
        bytesRead = readSync(fd, buffer, 0, maxBytes, 0);
      }

      const content = buffer.toString('utf8', 0, bytesRead);
      return { content, size: fileSize, truncated: true };
    } finally {
      closeSync(fd);
    }
  }

  cancelTask(taskId: string): boolean {
    const task = this.getTask(taskId);

    if (!task) {
      return false;
    }

    if (task.status !== 'running') {
      return false;
    }

    if (!task.pid) {
      return false;
    }

    try {
      process.kill(-task.pid, 'SIGTERM');

      this.db
        .prepare('UPDATE tasks SET status = ?, end_time = ?, updated_at = ? WHERE id = ?')
        .run('cancelled', Date.now(), new Date().toISOString(), taskId);

      this.activeProcesses.delete(taskId);

      logger.info('Cancelled background task', { taskId, pid: task.pid });
      return true;
    } catch (err) {
      logger.error('Failed to cancel task', {
        taskId,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  cleanupOldTasks(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;

    const oldTasks = this.db
      .prepare(
        'SELECT * FROM tasks WHERE status IN (?, ?, ?, ?) AND end_time < ?'
      )
      .all('completed', 'failed', 'cancelled', 'orphaned', cutoff) as any[];

    for (const task of oldTasks) {
      if (task.log_file && existsSync(task.log_file)) {
        unlinkSync(task.log_file);
      }
      if (task.error_log_file && existsSync(task.error_log_file)) {
        unlinkSync(task.error_log_file);
      }
    }

    const result = this.db
      .prepare(
        'DELETE FROM tasks WHERE status IN (?, ?, ?, ?) AND end_time < ?'
      )
      .run('completed', 'failed', 'cancelled', 'orphaned', cutoff);

    logger.info('Cleaned up old tasks', {
      count: result.changes,
      olderThanDays: (olderThanMs / (1000 * 60 * 60 * 24)).toFixed(1),
    });

    return result.changes;
  }

  getStartupSummary(): {
    running: PersistentTaskInfo[];
    recentlyCompleted: PersistentTaskInfo[];
    recentlyFailed: PersistentTaskInfo[];
  } {
    const running = this.getAllTasks({ status: 'running' });

    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentCompleted = this.db
      .prepare('SELECT * FROM tasks WHERE status = ? AND end_time > ? ORDER BY end_time DESC LIMIT 5')
      .all('completed', oneDayAgo) as any[];

    const recentFailed = this.db
      .prepare('SELECT * FROM tasks WHERE status IN (?, ?) AND end_time > ? ORDER BY end_time DESC LIMIT 5')
      .all('failed', 'orphaned', oneDayAgo) as any[];

    return {
      running,
      recentlyCompleted: recentCompleted.map(row => ({
        id: row.id,
        command: row.command,
        status: row.status as TaskStatus,
        pid: row.pid,
        startTime: row.start_time,
        endTime: row.end_time,
        exitCode: row.exit_code,
        cwd: row.cwd,
        logFile: row.log_file,
        errorLogFile: row.error_log_file,
      })),
      recentlyFailed: recentFailed.map(row => ({
        id: row.id,
        command: row.command,
        status: row.status as TaskStatus,
        pid: row.pid,
        startTime: row.start_time,
        endTime: row.end_time,
        exitCode: row.exit_code,
        cwd: row.cwd,
        logFile: row.log_file,
        errorLogFile: row.error_log_file,
      })),
    };
  }

  startMonitoring(callback: TaskMonitorCallback, intervalMs: number = 60000): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.monitorCallback = callback;

    const runningTasks = this.getAllTasks({ status: 'running' });
    for (const task of runningTasks) {
      this.lastKnownStates.set(task.id, task.status);
    }

    this.monitorInterval = setInterval(() => {
      this.checkTaskStateChanges();
    }, intervalMs);

    logger.info('Started task monitoring', { intervalMs });
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.monitorCallback = null;
    this.lastKnownStates.clear();
    logger.info('Stopped task monitoring');
  }

  private checkTaskStateChanges(): void {
    if (!this.monitorCallback) return;

    const allTasks = this.getAllTasks();

    for (const task of allTasks) {
      const lastState = this.lastKnownStates.get(task.id);

      if (lastState === 'running' && task.status !== 'running') {
        try {
          if (task.status === 'completed') {
            this.monitorCallback('task_completed', task);
          } else if (task.status === 'failed') {
            this.monitorCallback('task_failed', task);
          } else if (task.status === 'orphaned') {
            this.monitorCallback('task_orphaned', task);
          }
        } catch (err) {
          logger.error('Monitoring callback error', { error: String(err), taskId: task.id });
        }
      }

      this.lastKnownStates.set(task.id, task.status);
    }
  }

  shutdown(): void {
    clearInterval(this.checkInterval);

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    for (const [taskId, proc] of this.activeProcesses.entries()) {
      logger.info('Detaching from task on shutdown', { taskId });
    }

    this.activeProcesses.clear();

    this.db.close();
  }
}

let taskManagerInstance: PersistentTaskManager | null = null;

export function getPersistentTaskManager(workspaceRoot?: string): PersistentTaskManager {
  if (!taskManagerInstance) {
    taskManagerInstance = new PersistentTaskManager(workspaceRoot);
  }
  return taskManagerInstance;
}

export function resetPersistentTaskManager(): void {
  if (taskManagerInstance) {
    taskManagerInstance.shutdown();
    taskManagerInstance = null;
  }
}

export const startBackgroundTaskTool = tool({
  description: 'Start a long-running command in the background. Task runs detached and persists across agent restarts. Perfect for: builds (hours), tests (hours), training jobs (days), monitoring scripts (weeks). Returns task ID for tracking.',
  inputSchema: z.object({
    command: z.string().describe('Bash command to execute in background'),
    cwd: z.string().optional().describe('Working directory (default: project root)'),
  }),
  execute: async ({ command, cwd }: { command: string; cwd?: string }) => {
    try {
      const taskManager = getPersistentTaskManager();
      const taskId = taskManager.startTask(command, cwd);

      return JSON.stringify({
        taskId,
        message: 'Task started in detached background process',
        command: command.substring(0, 100),
        status: 'running',
        persistent: true,
        instructions:
          'Task will continue running even if agent restarts. Use check_task_status to monitor and get_task_output to retrieve logs.',
      });
    } catch (err) {
      return JSON.stringify({
        error: 'Failed to start background task',
        message: err instanceof Error ? err.message : String(err),
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
      return JSON.stringify({
        error: 'Task not found',
        taskId,
      });
    }

    const durationMs = task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime;
    const durationDays = durationMs / (1000 * 60 * 60 * 24);

    return JSON.stringify({
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
        return JSON.stringify({
          error: 'Task not found',
          taskId,
        });
      }

      const output = taskManager.getTaskOutput(taskId, {
        maxBytes,
        fromEnd,
        stderr,
      });

      return JSON.stringify({
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
    } catch (err) {
      return JSON.stringify({
        error: 'Failed to get task output',
        message: err instanceof Error ? err.message : String(err),
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
      return JSON.stringify({
        error: 'Task not found',
        taskId,
      });
    }

    if (task.status !== 'running') {
      return JSON.stringify({
        error: 'Task is not running',
        taskId,
        status: task.status,
      });
    }

    const cancelled = taskManager.cancelTask(taskId);

    if (cancelled) {
      return JSON.stringify({
        message: 'Task cancelled successfully',
        taskId,
      });
    } else {
      return JSON.stringify({
        error: 'Failed to cancel task',
        taskId,
      });
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

    return JSON.stringify({
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

    return JSON.stringify({
      message: `Cleaned up ${count} old tasks`,
      count,
      olderThanDays,
    });
  },
});

export const startAgentTaskTool = tool({
  description: 'Start an autonomous agent session as a background task. The agent will work on the given task independently, using all available tools. Perfect for: complex research, multi-step builds, code generation, testing workflows. The agent runs until task completion or max steps.',
  inputSchema: z.object({
    task: z.string().describe('The task for the agent to complete autonomously'),
    workspaceRoot: z.string().optional().describe('Workspace root directory (default: current)'),
    maxSteps: z.number().optional().describe('Maximum number of steps (default: 50)'),
  }),
  execute: async ({
    task,
    workspaceRoot,
    maxSteps = 50,
  }: {
    task: string;
    workspaceRoot?: string;
    maxSteps?: number;
  }) => {
    try {
      const taskManager = getPersistentTaskManager();

      const taskJson = JSON.stringify(task);
      const workspaceRootJson = workspaceRoot ? JSON.stringify(workspaceRoot) : 'process.cwd()';

      const agentScript = `
const { createAgentRuntime } = require('@agent/core');

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

    console.log('🤖 Agent starting autonomous task...');
    console.log('Task:', TASK);
    console.log('Max steps: ${maxSteps}');
    console.log('');

    const result = await session.runTask({
      prompt: TASK,
    });

    console.log('');
    console.log('✅ Agent completed task');
    console.log('Steps used:', result.stepsUsed, '/ ${maxSteps}');
    console.log('Tools used:', result.toolsUsed.join(', '));
    console.log('Completed:', result.completed);
    console.log('');
    console.log('Result:');
    console.log(result.text);

    process.exit(result.completed ? 0 : 1);
  } catch (error) {
    console.error('❌ Agent task failed:', error.message);
    process.exit(1);
  } finally {
    await runtime.shutdown();
  }
}

runAgentTask();
      `.trim();

      const scriptPath = join(process.cwd(), '.agent', `agent-task-${randomBytes(4).toString('hex')}.js`);
      const { writeFileSync } = require('fs');
      writeFileSync(scriptPath, agentScript);

      const command = `node "${scriptPath}" && rm "${scriptPath}"`;
      const taskId = taskManager.startTask(command, workspaceRoot);

      return JSON.stringify({
        taskId,
        message: 'Autonomous agent task started',
        task: task.substring(0, 100),
        status: 'running',
        autonomous: true,
        instructions:
          'Agent will work independently. Use check_task_status and get_task_output to monitor progress.',
      });
    } catch (err) {
      return JSON.stringify({
        error: 'Failed to start agent task',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
});

export const persistentBackgroundTaskTools = {
  start_background_task: startBackgroundTaskTool,
  start_agent_task: startAgentTaskTool,
  check_task_status: checkTaskStatusTool,
  get_task_output: getTaskOutputTool,
  cancel_task: cancelTaskTool,
  list_tasks: listTasksTool,
  cleanup_old_tasks: cleanupOldTasksTool,
};
