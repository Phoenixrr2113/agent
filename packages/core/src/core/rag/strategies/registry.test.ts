import { describe, it, expect } from 'vitest';
import { createDefaultRegistry } from './registry.js';

describe('StrategyRegistry', () => {
  it('should select code strategy for .ts files', () => {
    const registry = createDefaultRegistry();
    const strategy = registry.getStrategy('test.ts');

    expect(strategy).toBeDefined();
    expect(strategy?.name).toBe('code');
  });

  it('should select code strategy for .py files', () => {
    const registry = createDefaultRegistry();
    const strategy = registry.getStrategy('test.py');

    expect(strategy).toBeDefined();
    expect(strategy?.name).toBe('code');
  });

  it('should select document strategy for .md files', () => {
    const registry = createDefaultRegistry();
    const strategy = registry.getStrategy('test.md');

    expect(strategy).toBeDefined();
    expect(strategy?.name).toBe('document');
  });

  it('should select document strategy for .txt files', () => {
    const registry = createDefaultRegistry();
    const strategy = registry.getStrategy('test.txt');

    expect(strategy).toBeDefined();
    expect(strategy?.name).toBe('document');
  });

  it('should use default strategy for unknown file types', () => {
    const registry = createDefaultRegistry();
    const strategy = registry.getStrategy('test.unknown');

    expect(strategy).toBeDefined();
    expect(strategy?.name).toBe('document');
  });

  it('should chunk markdown file correctly', async () => {
    const registry = createDefaultRegistry();
    const content = `# Title\nSome content`;
    const chunks = await registry.chunkFile(content, 'test.md');

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].filePath).toBe('test.md');
  });

  it('should chunk TypeScript file correctly', async () => {
    const registry = createDefaultRegistry();
    const content = `function test() {\n  return 42;\n}`;
    const chunks = await registry.chunkFile(content, 'test.ts');

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].filePath).toBe('test.ts');
  });
});

