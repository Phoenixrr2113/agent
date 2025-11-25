import { describe, it, expect } from 'vitest';
import { chunkCode, estimateChunkQuality } from './core/rag/chunking.js';

describe('chunking', () => {
  describe('fixed strategy', () => {
    it('should chunk code into fixed-size chunks', () => {
      const code = Array(250).fill('const x = 1;').join('\n');
      const chunks = chunkCode(code, 100, 'fixed');

      expect(chunks.length).toBe(3);
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].endLine).toBe(100);
      expect(chunks[1].startLine).toBe(101);
      expect(chunks[1].endLine).toBe(200);
    });

    it('should handle code smaller than chunk size', () => {
      const code = 'const x = 1;\nconst y = 2;';
      const chunks = chunkCode(code, 100, 'fixed');

      expect(chunks.length).toBe(1);
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].endLine).toBe(2);
    });

    it('should skip empty chunks', () => {
      const code = '\n\n\n';
      const chunks = chunkCode(code, 100, 'fixed');

      expect(chunks.length).toBe(0);
    });
  });

  describe('semantic strategy', () => {
    it('should split at function boundaries when needed', () => {
      const largeFunctions = Array(5).fill(null).map((_, i) =>
        `function func${i}() {\n${Array(15).fill('  const x = 1;').join('\n')}\n  return x;\n}`
      ).join('\n\n');

      const chunks = chunkCode(largeFunctions, 50, 'semantic');

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should keep small functions together', () => {
      const code = `function foo() { return 1; }
function bar() { return 2; }`;
      const chunks = chunkCode(code, 100, 'semantic');

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toContain('foo');
      expect(chunks[0].content).toContain('bar');
    });

    it('should respect max lines limit', () => {
      const code = Array(200).fill('const x = 1;').join('\n');
      const chunks = chunkCode(code, 100, 'semantic');

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every(c => c.endLine - c.startLine <= 100)).toBe(true);
    });
  });

  describe('adaptive strategy', () => {
    it('should split at balanced brace points', () => {
      const code = `class Foo {
  method() {
    return 1;
  }
}

class Bar {
  method() {
    return 2;
  }
}`;
      const chunks = chunkCode(code, 10, 'adaptive');

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should keep nested structures together', () => {
      const code = `function complex() {
  const obj = {
    nested: {
      deep: {
        value: 1
      }
    }
  };
  return obj;
}`;
      const chunks = chunkCode(code, 50, 'adaptive');

      expect(chunks.length).toBe(1);
    });

    it('should handle unbalanced braces gracefully', () => {
      const code = `function incomplete() {
  if (true) {
    console.log('test')`;

      const chunks = chunkCode(code, 100, 'adaptive');

      expect(chunks.length).toBe(1);
    });
  });

  describe('estimateChunkQuality', () => {
    it('should give high score to complete functions', () => {
      const chunk = {
        content: 'export function test() {\n  return 42;\n}',
        startLine: 1,
        endLine: 3,
      };

      const score = estimateChunkQuality(chunk);
      expect(score).toBeGreaterThan(1.0);
    });

    it('should give high score to complete classes', () => {
      const chunk = {
        content: 'export class Test {\n  method() { return 1; }\n}',
        startLine: 1,
        endLine: 3,
      };

      const score = estimateChunkQuality(chunk);
      expect(score).toBeGreaterThan(1.0);
    });

    it('should consider code density', () => {
      const dense = {
        content: 'const x = 1;\nconst y = 2;\nconst z = 3;',
        startLine: 1,
        endLine: 3,
      };

      const sparse = {
        content: 'const x = 1;\n\n\n\n',
        startLine: 1,
        endLine: 5,
      };

      expect(estimateChunkQuality(dense)).toBeGreaterThan(estimateChunkQuality(sparse));
    });
  });
});
