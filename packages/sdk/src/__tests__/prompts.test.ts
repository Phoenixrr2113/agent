/**
 * @agent/sdk - Prompts Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { systemPrompt, rolePrompts } from '../prompts/templates';
import { 
  buildSystemContext, 
  formatSystemContextBlock,
  buildDynamicSystemPrompt,
  type SystemContext 
} from '../prompts/context';

describe('systemPrompt', () => {
  it('should export a non-empty system prompt', () => {
    expect(systemPrompt).toBeDefined();
    expect(typeof systemPrompt).toBe('string');
    expect(systemPrompt.length).toBeGreaterThan(100);
  });

  it('should include key sections', () => {
    expect(systemPrompt).toContain('Philosophy');
    expect(systemPrompt).toContain('Tools');
    expect(systemPrompt).toContain('Completion');
  });
});

describe('rolePrompts', () => {
  it('should export role prompts object', () => {
    expect(rolePrompts).toBeDefined();
    expect(typeof rolePrompts).toBe('object');
  });

  it('should have generic role', () => {
    expect(rolePrompts.generic).toBeDefined();
    expect(rolePrompts.generic).toBe(systemPrompt);
  });

  it('should have coder role with code-specific content', () => {
    expect(rolePrompts.coder).toBeDefined();
    expect(rolePrompts.coder).toContain('code');
  });

  it('should have researcher role', () => {
    expect(rolePrompts.researcher).toBeDefined();
    expect(rolePrompts.researcher).toContain('research');
  });

  it('should have analyst role', () => {
    expect(rolePrompts.analyst).toBeDefined();
    expect(rolePrompts.analyst).toContain('analysis');
  });

  it('should extend base systemPrompt for specialized roles', () => {
    expect(rolePrompts.coder).toContain(systemPrompt);
    expect(rolePrompts.researcher).toContain(systemPrompt);
    expect(rolePrompts.analyst).toContain(systemPrompt);
  });
});

describe('buildSystemContext', () => {
  it('should return context with required fields', async () => {
    const context = await buildSystemContext();

    expect(context).toHaveProperty('currentTime');
    expect(context).toHaveProperty('currentDate');
    expect(context).toHaveProperty('timezone');
    expect(context).toHaveProperty('platform');
    expect(context).toHaveProperty('hostname');
    expect(context).toHaveProperty('username');
  });

  it('should include workspace root when provided', async () => {
    const context = await buildSystemContext({ workspaceRoot: '/test/workspace' });
    expect(context.workspaceRoot).toBe('/test/workspace');
  });

  it('should format current time correctly', async () => {
    const context = await buildSystemContext();
    // Should be in format like "10:30 AM"
    expect(context.currentTime).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });

  it('should format current date correctly', async () => {
    const context = await buildSystemContext();
    // Should contain day of week and month
    expect(context.currentDate).toMatch(/\w+,\s+\w+\s+\d+,\s+\d{4}/);
  });
});

describe('formatSystemContextBlock', () => {
  it('should format context as markdown', () => {
    const context: SystemContext = {
      currentTime: '10:30 AM',
      currentDate: 'Tuesday, January 14, 2026',
      timezone: 'America/New_York',
      platform: 'darwin',
      hostname: 'test-machine',
      username: 'testuser',
      locale: 'en-US',
    };

    const block = formatSystemContextBlock(context);

    expect(block).toContain('# Current Environment');
    expect(block).toContain('**Date**: Tuesday, January 14, 2026');
    expect(block).toContain('**Time**: 10:30 AM');
    expect(block).toContain('**Platform**: darwin');
    expect(block).toContain('**User**: testuser');
  });

  it('should include workspace when provided', () => {
    const context: SystemContext = {
      currentTime: '10:30 AM',
      currentDate: 'Tuesday, January 14, 2026',
      timezone: 'America/New_York',
      platform: 'darwin',
      hostname: 'test-machine',
      username: 'testuser',
      locale: 'en-US',
      workspaceRoot: '/my/project',
    };

    const block = formatSystemContextBlock(context);
    expect(block).toContain('**Workspace**: /my/project');
  });

  it('should include workspace map when provided', () => {
    const context: SystemContext = {
      currentTime: '10:30 AM',
      currentDate: 'Tuesday, January 14, 2026',
      timezone: 'America/New_York',
      platform: 'darwin',
      hostname: 'test-machine',
      username: 'testuser',
      locale: 'en-US',
      workspaceRoot: '/my/project',
      workspaceMap: 'src/: index.ts, utils\npackage.json',
    };

    const block = formatSystemContextBlock(context);
    expect(block).toContain('## Workspace Structure');
    expect(block).toContain('src/: index.ts, utils');
  });
});

describe('buildDynamicSystemPrompt', () => {
  it('should combine base prompt with context', async () => {
    const basePrompt = 'You are a helpful assistant.';
    const dynamicPrompt = await buildDynamicSystemPrompt(basePrompt);

    expect(dynamicPrompt).toContain(basePrompt);
    expect(dynamicPrompt).toContain('# Current Environment');
  });

  it('should include workspace info when provided', async () => {
    const basePrompt = 'Base prompt.';
    const dynamicPrompt = await buildDynamicSystemPrompt(basePrompt, { workspaceRoot: '/test/workspace' });

    expect(dynamicPrompt).toContain('/test/workspace');
  });
});
