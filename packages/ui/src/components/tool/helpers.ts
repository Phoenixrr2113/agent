import type { ToolState } from './types';

const STATUS_ICONS: Record<ToolState, string> = {
  pending: '⏳',
  running: '⚙️',
  completed: '✅',
  error: '❌',
};

export function getStatusIcon(state: ToolState): string {
  return STATUS_ICONS[state];
}

export function formatToolName(type: string): string {
  const name = type.replace(/^tool-/, '');
  return name
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function shouldDefaultOpen(state?: ToolState): boolean {
  return state === 'completed' || state === 'error';
}
