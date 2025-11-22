import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { grepWorkspace } from '../../src/grep.js';
import { setupTestWorkspace, teardownTestWorkspace, writeTestFile } from '../helpers/test-utils.js';

describe('grep integration tests', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await setupTestWorkspace('grep-integration');
  });

  afterEach(async () => {
    await teardownTestWorkspace(workspace);
  });

  it('should find matches in real TypeScript files', async () => {
    const results = await grepWorkspace('calculateSum', workspace);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('calculateSum');
    expect(results[0].file).toContain('sample-code.ts');
  });

  it('should find matches in JavaScript files', async () => {
    const results = await grepWorkspace('formatDate', workspace);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('formatDate');
    expect(results[0].file).toContain('sample-utils.js');
  });

  it('should find matches in Python files', async () => {
    const results = await grepWorkspace('DataProcessor', workspace);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('DataProcessor');
    expect(results[0].file).toContain('sample-data.py');
  });

  it('should work with regex patterns across real files', async () => {
    const results = await grepWorkspace('function\\s+\\w+\\(', workspace);

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.content.includes('calculateSum'))).toBe(true);
  });

  it('should filter by file pattern', async () => {
    const results = await grepWorkspace('function', workspace, { filePattern: '\\.ts$' });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.file.endsWith('.ts'))).toBe(true);
  });

  it('should ignore case when specified', async () => {
    const results = await grepWorkspace('MATHOPERATIONS', workspace, { ignoreCase: true });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('MathOperations');
  });

  it('should respect maxResults limit', async () => {
    await writeTestFile(workspace, 'many-matches.ts', 'test\n'.repeat(100));

    const results = await grepWorkspace('test', workspace, { maxResults: 5 });

    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('should return correct line numbers', async () => {
    const results = await grepWorkspace('calculateProduct', workspace);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].line).toBeGreaterThan(0);
    expect(results[0].line).toBeLessThan(100);
  });

  it('should handle files in nested directories', async () => {
    await writeTestFile(workspace, 'nested/deep/test.ts', 'export const nested = true;');

    const results = await grepWorkspace('nested', workspace);

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.file.includes('nested/deep/test.ts'))).toBe(true);
  });

  it('should match class declarations', async () => {
    const results = await grepWorkspace('class\\s+\\w+', workspace);

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.content.includes('MathOperations'))).toBe(true);
    expect(results.some(r => r.content.includes('DataProcessor'))).toBe(true);
  });

  it('should match export statements', async () => {
    const results = await grepWorkspace('^export', workspace);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.content.trim().startsWith('export'))).toBe(true);
  });

  it('should handle special regex characters', async () => {
    await writeTestFile(workspace, 'special.ts', 'const obj = { key: "value" };');

    const results = await grepWorkspace('\\{.*\\}', workspace);

    expect(results.some(r => r.file.includes('special.ts'))).toBe(true);
  });
});
