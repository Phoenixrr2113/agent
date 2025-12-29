import { describe, it, expect } from 'vitest';
import {
  getTaskStatusIcon,
  getTaskStatusColor,
  formatProgress,
} from '../helpers';

describe('getTaskStatusIcon', () => {
  it('returns ⏳ for pending', () => {
    expect(getTaskStatusIcon('pending')).toBe('⏳');
  });

  it('returns 🔄 for in_progress', () => {
    expect(getTaskStatusIcon('in_progress')).toBe('🔄');
  });

  it('returns ✅ for completed', () => {
    expect(getTaskStatusIcon('completed')).toBe('✅');
  });

  it('returns ❌ for error', () => {
    expect(getTaskStatusIcon('error')).toBe('❌');
  });
});

describe('getTaskStatusColor', () => {
  it('returns text-gray-400 for pending', () => {
    expect(getTaskStatusColor('pending')).toBe('text-gray-400');
  });

  it('returns text-blue-500 for in_progress', () => {
    expect(getTaskStatusColor('in_progress')).toBe('text-blue-500');
  });

  it('returns text-green-500 for completed', () => {
    expect(getTaskStatusColor('completed')).toBe('text-green-500');
  });

  it('returns text-red-500 for error', () => {
    expect(getTaskStatusColor('error')).toBe('text-red-500');
  });
});

describe('formatProgress', () => {
  it('formats progress as X/Y', () => {
    expect(formatProgress(2, 5)).toBe('2/5');
  });

  it('handles zero completed', () => {
    expect(formatProgress(0, 3)).toBe('0/3');
  });

  it('handles all completed', () => {
    expect(formatProgress(5, 5)).toBe('5/5');
  });

  it('handles large numbers', () => {
    expect(formatProgress(100, 500)).toBe('100/500');
  });
});
