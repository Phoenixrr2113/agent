import { describe, it, expect } from 'vitest';
import { systemPrompt } from './prompts.js';

describe('systemPrompt', () => {
  it('should contain generic agent template language', () => {
    expect(systemPrompt).toContain('self-building AI agent template');
    expect(systemPrompt).not.toContain('business analysis');
    expect(systemPrompt).not.toContain('business analyst');
  });

  it('should mention all available capabilities', () => {
    expect(systemPrompt).toContain('Knowledge graph memory');
    expect(systemPrompt).toContain('Web fetch capabilities');
    expect(systemPrompt).toContain('Sequential thinking');
    expect(systemPrompt).toContain('Filesystem');
    expect(systemPrompt).toContain('Git');
  });

  it('should emphasize user-defined purpose', () => {
    expect(systemPrompt).toContain('user wants you to become');
    expect(systemPrompt).toContain('user define your purpose');
  });

  it('should include workflow steps', () => {
    expect(systemPrompt).toContain('Understand what the user wants you to become');
    expect(systemPrompt).toContain('Assess your current capabilities');
    expect(systemPrompt).toContain('Research and plan');
    expect(systemPrompt).toContain('Write the code');
    expect(systemPrompt).toContain('Test it');
    expect(systemPrompt).toContain('Commit changes');
    expect(systemPrompt).toContain('knowledge graph');
  });

  it('should emphasize iterative development', () => {
    expect(systemPrompt).toContain('iteratively');
    expect(systemPrompt).toContain('one capability at a time');
    expect(systemPrompt).toContain('working code');
  });

  it('should promote adaptability', () => {
    expect(systemPrompt).toContain('adaptable');
  });
});
