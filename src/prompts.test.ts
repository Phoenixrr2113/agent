import { describe, it, expect } from 'vitest';
import { systemPrompt } from './prompts.js';

describe('systemPrompt', () => {
  it('should contain generic agent template language', () => {
    expect(systemPrompt).toContain('self-building AI agent template');
    expect(systemPrompt).not.toContain('business analysis');
    expect(systemPrompt).not.toContain('business analyst');
  });

  it('should define core principles', () => {
    expect(systemPrompt).toContain('Core Principles');
    expect(systemPrompt).toContain('User-Defined Purpose');
    expect(systemPrompt).toContain('Iterative Development');
    expect(systemPrompt).toContain('Self-Awareness');
    expect(systemPrompt).toContain('Quality First');
  });

  it('should document all tool categories', () => {
    expect(systemPrompt).toContain('Available Tools');
    expect(systemPrompt).toContain('Codebase Understanding');
    expect(systemPrompt).toContain('Knowledge Management');
    expect(systemPrompt).toContain('Web Access');
    expect(systemPrompt).toContain('Problem Solving');
    expect(systemPrompt).toContain('Development');
  });

  it('should mention specific tools', () => {
    expect(systemPrompt).toContain('search_codebase');
    expect(systemPrompt).toContain('grep_codebase');
    expect(systemPrompt).toContain('Memory tools');
    expect(systemPrompt).toContain('fetch');
    expect(systemPrompt).toContain('sequential_thinking');
    expect(systemPrompt).toContain('Filesystem tools');
    expect(systemPrompt).toContain('Git tools');
  });

  it('should provide comprehensive workflow', () => {
    expect(systemPrompt).toContain('Development Workflow');
    expect(systemPrompt).toContain('Understand the Request');
    expect(systemPrompt).toContain('Research Existing Code');
    expect(systemPrompt).toContain('Plan the Implementation');
    expect(systemPrompt).toContain('Implement');
    expect(systemPrompt).toContain('Test');
    expect(systemPrompt).toContain('Commit');
    expect(systemPrompt).toContain('Store Learnings');
  });

  it('should include important reminders', () => {
    expect(systemPrompt).toContain('Important Reminders');
    expect(systemPrompt).toContain('auto-indexed');
    expect(systemPrompt).toContain('/workspace');
    expect(systemPrompt).toContain('Functional patterns');
    expect(systemPrompt).toContain('factory functions');
  });

  it('should emphasize user-defined purpose', () => {
    expect(systemPrompt).toContain('what they want you to become');
    expect(systemPrompt).toContain('adapting to the user');
  });

  it('should emphasize iterative development', () => {
    expect(systemPrompt).toContain('iteratively');
    expect(systemPrompt).toContain('one capability at a time');
    expect(systemPrompt).toContain('working code');
  });

  it('should provide starting guidance', () => {
    expect(systemPrompt).toContain('Starting Fresh');
    expect(systemPrompt).toContain('What kind of agent');
  });

  it('should emphasize being a template', () => {
    expect(systemPrompt).toContain('template');
    expect(systemPrompt).toContain('not a finished product');
  });
});
