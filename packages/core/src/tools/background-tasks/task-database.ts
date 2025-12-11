import type { TaskStatus, PersistentTaskInfo } from './types.js';

export const TASK_DB_SCHEMA = `
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

export interface TaskRow {
  id: string;
  command: string;
  status: string;
  pid: number | null;
  start_time: number;
  end_time: number | null;
  exit_code: number | null;
  cwd: string | null;
  log_file: string | null;
  error_log_file: string | null;
  created_at: string;
  updated_at: string;
}

export function mapRowToTaskInfo(row: TaskRow): PersistentTaskInfo {
  return {
    id: row.id,
    command: row.command,
    status: row.status as TaskStatus,
    pid: row.pid ?? undefined,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    exitCode: row.exit_code ?? undefined,
    cwd: row.cwd ?? undefined,
    logFile: row.log_file ?? undefined,
    errorLogFile: row.error_log_file ?? undefined,
  };
}
