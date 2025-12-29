import type { TaskStatus } from './types';

const STATUS_ICONS: Record<TaskStatus, string> = {
  pending: '⏳',
  in_progress: '🔄',
  completed: '✅',
  error: '❌',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'text-gray-400',
  in_progress: 'text-blue-500',
  completed: 'text-green-500',
  error: 'text-red-500',
};

export function getTaskStatusIcon(status: TaskStatus): string {
  return STATUS_ICONS[status];
}

export function getTaskStatusColor(status: TaskStatus): string {
  return STATUS_COLORS[status];
}

export function formatProgress(completed: number, total: number): string {
  return `${completed}/${total}`;
}
