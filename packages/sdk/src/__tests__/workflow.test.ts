/**
 * @agent/sdk - Workflow Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  wrapToolAsDurableStep,
  wrapToolsAsDurable,
  wrapSelectedToolsAsDurable,
  getDurabilityConfig,
  setDurabilityConfig,
  DURABILITY_CONFIG,
} from '../workflow/durable-tool';
import {
  createDurableAgent,
  parseDuration,
  formatDuration,
} from '../workflow/durable-agent';
import type { Tool } from 'ai';

// Mock tool helper
function createMockTool(name: string): Tool {
  return {
    description: `Mock ${name} tool`,
    parameters: {},
    execute: vi.fn().mockResolvedValue(`${name} result`),
  } as unknown as Tool;
}

describe('wrapToolAsDurableStep', () => {
  it('wraps tool execute with durability', async () => {
    const tool = createMockTool('test');
    const wrapped = wrapToolAsDurableStep(tool);

    expect(wrapped.description).toBe(tool.description);
    
    // Execute should still work
    const result = await (wrapped as any).execute({ input: 'test' }, {});
    expect((tool as any).execute).toHaveBeenCalled();
  });

  it('returns original tool if durability disabled', () => {
    const tool = createMockTool('test');
    const wrapped = wrapToolAsDurableStep(tool, { enabled: false });

    expect(wrapped).toBe(tool);
  });

  it('returns original if no execute function', () => {
    const toolWithoutExecute = {
      description: 'No execute',
      parameters: {},
    };

    const wrapped = wrapToolAsDurableStep(toolWithoutExecute as Tool);
    expect(wrapped).toBe(toolWithoutExecute);
  });
});

describe('wrapToolsAsDurable', () => {
  it('wraps all tools in set', () => {
    const tools = {
      read: createMockTool('read'),
      write: createMockTool('write'),
    };

    const wrapped = wrapToolsAsDurable(tools);

    expect(Object.keys(wrapped)).toEqual(['read', 'write']);
    expect(wrapped.read).not.toBe(tools.read);
    expect(wrapped.write).not.toBe(tools.write);
  });

  it('applies config to all tools', () => {
    const tools = { test: createMockTool('test') };
    const wrapped = wrapToolsAsDurable(tools, { retryCount: 5 });

    expect(wrapped.test).toBeDefined();
  });
});

describe('wrapSelectedToolsAsDurable', () => {
  it('only wraps selected tools', () => {
    const tools = {
      read: createMockTool('read'),
      write: createMockTool('write'),
      exec: createMockTool('exec'),
    };

    const wrapped = wrapSelectedToolsAsDurable(tools, ['read', 'write']);

    // read and write should be wrapped (different references)
    expect(wrapped.read).not.toBe(tools.read);
    expect(wrapped.write).not.toBe(tools.write);
    // exec should be unchanged
    expect(wrapped.exec).toBe(tools.exec);
  });
});

describe('durability config metadata', () => {
  it('can set and get config', () => {
    const tool = createMockTool('test');
    
    setDurabilityConfig(tool, { enabled: true, independent: false, retryCount: 3 });
    
    const config = getDurabilityConfig(tool);
    expect(config).toEqual({ enabled: true, independent: false, retryCount: 3 });
  });

  it('returns undefined if no config set', () => {
    const tool = createMockTool('test');
    expect(getDurabilityConfig(tool)).toBeUndefined();
  });

  it('uses correct symbol', () => {
    expect(typeof DURABILITY_CONFIG).toBe('symbol');
  });
});

describe('parseDuration', () => {
  it('parses seconds', () => {
    expect(parseDuration('30s')).toBe(30000);
  });

  it('parses minutes', () => {
    expect(parseDuration('5m')).toBe(300000);
  });

  it('parses hours', () => {
    expect(parseDuration('1h')).toBe(3600000);
  });

  it('parses days', () => {
    expect(parseDuration('1d')).toBe(86400000);
  });

  it('throws on invalid format', () => {
    expect(() => parseDuration('invalid')).toThrow();
    expect(() => parseDuration('10')).toThrow();
    expect(() => parseDuration('10x')).toThrow();
  });
});

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  it('formats minutes', () => {
    expect(formatDuration(300000)).toBe('5m');
  });

  it('formats hours', () => {
    expect(formatDuration(3600000)).toBe('1h');
  });

  it('formats days', () => {
    expect(formatDuration(86400000)).toBe('1d');
  });
});

describe('createDurableAgent', () => {
  it('creates agent with standard methods', () => {
    const agent = createDurableAgent({ role: 'generic' });

    expect(agent.generate).toBeDefined();
    expect(agent.durableGenerate).toBeDefined();
    expect(agent.withApproval).toBeDefined();
    expect(agent.scheduled).toBeDefined();
  });

  it('generate returns result object', async () => {
    const agent = createDurableAgent({});
    const result = await agent.generate({ prompt: 'test' });

    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('usage');
  });

  it('durableGenerate returns text string', async () => {
    const agent = createDurableAgent({});
    const text = await agent.durableGenerate('test prompt');

    expect(typeof text).toBe('string');
  });
});
