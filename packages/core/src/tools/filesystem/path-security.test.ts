import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setAllowedDirectories,
  isPathWithinAllowedDirectories,
  normalizePath,
  expandHome,
  validatePath
} from './path-security.js';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';

describe('Path Security', () => {
  const originalAllowedDirectories = process.cwd();

  beforeEach(() => {
    setAllowedDirectories([process.cwd()]);
  });

  describe('normalizePath', () => {
    it('should normalize paths correctly', () => {
      expect(normalizePath('  /foo/bar  ')).toBe('/foo/bar');
      expect(normalizePath('"foo/bar"')).toBe('foo/bar');
      expect(normalizePath("'foo/bar'")).toBe('foo/bar');
    });
  });

  describe('expandHome', () => {
    it('should expand ~ to home directory', () => {
      expect(expandHome('~/foo')).toBe(path.join(os.homedir(), 'foo'));
    });

    it('should not expand paths not starting with ~', () => {
      expect(expandHome('/foo/bar')).toBe('/foo/bar');
    });
  });

  describe('isPathWithinAllowedDirectories', () => {
    it('should allow paths within allowed directories', () => {
      const allowed = path.join(process.cwd(), 'foo');
      const target = path.join(allowed, 'bar');
      
      // We must mock the resolved paths effectively or rely on real path logic
      // Since isPathWithinAllowedDirectories resolves absolute paths based on setAllowedDirectories
      setAllowedDirectories([process.cwd()]);
      
      expect(isPathWithinAllowedDirectories(path.join(process.cwd(), 'test.txt'))).toBe(true);
    });

    it('should deny paths outside allowed directories', () => {
        setAllowedDirectories([process.cwd()]);
        // Use a path definitely outside project root, assuming /tmp or similar is outside
        const outsidePath = (path.dirname(process.cwd()) === '/') ? '/other' : path.join(path.dirname(process.cwd()), 'sibling');
        
        // This test assumes process.cwd() is not root and has a parent we can't access
        if (process.cwd() !== '/') {
             expect(isPathWithinAllowedDirectories(outsidePath)).toBe(false);
        }
    });

    it('should deny parent manipulation attempt', () => {
        setAllowedDirectories([process.cwd()]);
        const attemptedBypass = path.join(process.cwd(), '..', 'secret');
        // path.resolve will simplify this, so the check sees the resolved path
        // which should be outside
        if (process.cwd() !== '/') {
            expect(isPathWithinAllowedDirectories(attemptedBypass)).toBe(false);
        }
    });
  });
  
  // Note: validatePath uses fs.realpath, which requires actual files.
  // We can write a test that creates a temp file inside workdir.
  describe('validatePath integration', () => {
      const testFile = path.join(process.cwd(), 'test-security-file.txt');
      
      it('should validate an existing file', async () => {
          await fs.writeFile(testFile, 'contents');
          try {
              const res = await validatePath(testFile);
              expect(res).toBe(testFile); // resolved path might be same
          } finally {
              await fs.unlink(testFile);
          }
      });
  });
});
