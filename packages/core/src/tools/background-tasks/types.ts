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

export type TaskMonitorCallback = (event: 'task_completed' | 'task_failed' | 'task_orphaned', task: PersistentTaskInfo) => void;

export interface TaskFilter {
  status?: TaskStatus;
  limit?: number;
}

export interface TaskOutputOptions {
  maxBytes?: number;
  fromEnd?: boolean;
  stderr?: boolean;
}

export interface TaskOutput {
  content: string;
  size: number;
  truncated: boolean;
}

export interface TaskStartupSummary {
  running: PersistentTaskInfo[];
  recentlyCompleted: PersistentTaskInfo[];
  recentlyFailed: PersistentTaskInfo[];
}
