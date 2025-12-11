import { spawn, type ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import {
  existsSync,
  mkdirSync,
  unlinkSync,
  statSync,
  readFileSync,
  openSync,
  closeSync,
  readSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { logger } from '@agent/shared';
import type {
  TaskStatus,
  PersistentTaskInfo,
  TaskMonitorCallback,
  TaskFilter,
  TaskOutputOptions,
  TaskOutput,
  TaskStartupSummary,
} from './types.js';
import { TASK_DB_SCHEMA, mapRowToTaskInfo, type TaskRow } from './task-database.js';

export class PersistentTaskManager {
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
      .all('running') as TaskRow[];

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
      .all('running') as TaskRow[];

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
      .all('running') as TaskRow[];

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
    } catch {
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
      .get(taskId) as TaskRow | undefined;

    if (!row) {
      return undefined;
    }

    return mapRowToTaskInfo(row);
  }

  getAllTasks(filter?: TaskFilter): PersistentTaskInfo[] {
    let query = 'SELECT * FROM tasks';
    const params: (string | number)[] = [];

    if (filter?.status) {
      query += ' WHERE status = ?';
      params.push(filter.status);
    }

    query += ' ORDER BY start_time DESC';

    if (filter?.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
    }

    const rows = this.db.prepare(query).all(...params) as TaskRow[];

    return rows.map(mapRowToTaskInfo);
  }

  getTaskOutput(taskId: string, options: TaskOutputOptions = {}): TaskOutput {
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
      .all('completed', 'failed', 'cancelled', 'orphaned', cutoff) as TaskRow[];

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

  getStartupSummary(): TaskStartupSummary {
    const running = this.getAllTasks({ status: 'running' });

    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentCompleted = this.db
      .prepare('SELECT * FROM tasks WHERE status = ? AND end_time > ? ORDER BY end_time DESC LIMIT 5')
      .all('completed', oneDayAgo) as TaskRow[];

    const recentFailed = this.db
      .prepare('SELECT * FROM tasks WHERE status IN (?, ?) AND end_time > ? ORDER BY end_time DESC LIMIT 5')
      .all('failed', 'orphaned', oneDayAgo) as TaskRow[];

    return {
      running,
      recentlyCompleted: recentCompleted.map(mapRowToTaskInfo),
      recentlyFailed: recentFailed.map(mapRowToTaskInfo),
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

    for (const [taskId] of this.activeProcesses.entries()) {
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
