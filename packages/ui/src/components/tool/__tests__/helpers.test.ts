import { describe, it, expect } from 'vitest';
import {
  formatToolName,
  getStatusIcon,
  formatDuration,
  formatJson,
  shouldDefaultOpen,
} from '../helpers';

describe('formatToolName', () => {
  it('converts snake_case to Title Case', () => {
    expect(formatToolName('fetch_weather_data')).toBe('Fetch Weather Data');
  });

  it('converts kebab-case to Title Case', () => {
    expect(formatToolName('get-user-info')).toBe('Get User Info');
  });

  it('strips tool- prefix', () => {
    expect(formatToolName('tool-search_web')).toBe('Search Web');
  });

  it('handles single word', () => {
    expect(formatToolName('calculator')).toBe('Calculator');
  });
});

describe('getStatusIcon', () => {
  it('returns ⏳ for pending', () => {
    expect(getStatusIcon('pending')).toBe('⏳');
  });

  it('returns ⚙️ for running', () => {
    expect(getStatusIcon('running')).toBe('⚙️');
  });

  it('returns ✅ for completed', () => {
    expect(getStatusIcon('completed')).toBe('✅');
  });

  it('returns ❌ for error', () => {
    expect(getStatusIcon('error')).toBe('❌');
  });
});

describe('formatDuration', () => {
  it('returns ms for durations under 1 second', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(99)).toBe('99ms');
  });

  it('returns seconds with one decimal for durations >= 1 second', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(12345)).toBe('12.3s');
  });
});

describe('formatJson', () => {
  it('formats object with 2-space indentation', () => {
    const result = formatJson({ key: 'value' });
    expect(result).toBe('{\n  "key": "value"\n}');
  });

  it('handles nested objects', () => {
    const result = formatJson({ outer: { inner: 1 } });
    expect(result).toBe('{\n  "outer": {\n    "inner": 1\n  }\n}');
  });

  it('handles arrays', () => {
    const result = formatJson([1, 2, 3]);
    expect(result).toBe('[\n  1,\n  2,\n  3\n]');
  });
});

describe('shouldDefaultOpen', () => {
  it('returns true for completed state', () => {
    expect(shouldDefaultOpen('completed')).toBe(true);
  });

  it('returns true for error state', () => {
    expect(shouldDefaultOpen('error')).toBe(true);
  });

  it('returns false for pending state', () => {
    expect(shouldDefaultOpen('pending')).toBe(false);
  });

  it('returns false for running state', () => {
    expect(shouldDefaultOpen('running')).toBe(false);
  });

  it('returns false for undefined state', () => {
    expect(shouldDefaultOpen(undefined)).toBe(false);
  });
});
