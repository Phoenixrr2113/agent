import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { glob } from 'glob';
import { minimatch } from 'minimatch';

import { validatePath } from './path-security.js';

import type { SearchResult, DirectoryTree } from './types.js';

export async function searchFilesWithValidation(
  searchPath: string,
  pattern: string,
  excludePatterns?: string[]
): Promise<SearchResult[]> {
  const globDepth = (pattern.match(/\*\*/g) || []).length;
  if (globDepth > 5) {
    throw new Error(`Glob pattern exceeds maximum depth of 5 (got ${globDepth} levels). Use simpler patterns.`);
  }

  if (pattern.length > 500) {
    throw new Error(`Glob pattern exceeds maximum length of 500 characters (got ${pattern.length})`);
  }

  const validPath = await validatePath(searchPath);
  const files = await glob(pattern, {
    cwd: validPath,
    absolute: true,
    nodir: false,
  });

  let filtered = files;
  if (excludePatterns && excludePatterns.length > 0) {
    filtered = files.filter(file => {
      const relativePath = path.relative(validPath, file);
      return !excludePatterns.some(exclude => minimatch(relativePath, exclude));
    });
  }

  const results: SearchResult[] = [];
  for (const file of filtered) {
    try {
      const stats = await fs.stat(file);
      results.push({
        path: file,
        isDirectory: stats.isDirectory(),
      });
    } catch {
      continue;
    }
  }

  return results;
}

const MAX_DIRECTORY_DEPTH = 5;
const MAX_TREE_ENTRIES = 500;

export const DEFAULT_TREE_EXCLUDES = ['node_modules', '.git', 'dist', '.next', '.cache', '__pycache__', '.pnpm', 'vendor'];

export interface TreeBuildOptions {
  excludePatterns?: string[];
  maxDepth?: number;
  useDefaultExcludes?: boolean;
}

interface TreeBuildContext {
  entryCount: number;
  maxEntries: number;
  truncated: boolean;
}

export async function buildDirectoryTree(
  dirPath: string,
  options: TreeBuildOptions = {},
  currentDepth = 0,
  context?: TreeBuildContext
): Promise<DirectoryTree & { truncated?: boolean }> {
  const { excludePatterns, maxDepth = MAX_DIRECTORY_DEPTH, useDefaultExcludes = true } = options;
  const ctx = context ?? { entryCount: 0, maxEntries: MAX_TREE_ENTRIES, truncated: false };
  
  const stats = await fs.stat(dirPath);
  const name = path.basename(dirPath);

  if (!stats.isDirectory()) {
    ctx.entryCount++;
    return { name, type: 'file' };
  }

  if (currentDepth >= maxDepth) {
    return {
      name,
      type: 'directory',
      children: [{ name: '... (max depth reached)', type: 'file' }],
    };
  }

  if (ctx.entryCount >= ctx.maxEntries) {
    ctx.truncated = true;
    return {
      name,
      type: 'directory',
      children: [{ name: '... (max entries reached)', type: 'file' }],
    };
  }

  const baseExcludes = useDefaultExcludes ? DEFAULT_TREE_EXCLUDES : [];
  const allExcludes = [...baseExcludes, ...(excludePatterns ?? [])];
  const entries = await fs.readdir(dirPath);
  const children: DirectoryTree[] = [];

  ctx.entryCount++;

  for (const entry of entries) {
    if (ctx.entryCount >= ctx.maxEntries) {
      ctx.truncated = true;
      children.push({ name: `... and ${entries.length - children.length} more`, type: 'file' });
      break;
    }

    if (allExcludes.some(p => entry === p || minimatch(entry, p))) {
      continue;
    }

    const fullPath = path.join(dirPath, entry);

    try {
      const child = await buildDirectoryTree(fullPath, options, currentDepth + 1, ctx);
      children.push(child);
    } catch {
      continue;
    }
  }

  const result: DirectoryTree & { truncated?: boolean } = {
    name,
    type: 'directory',
    children,
  };

  if (currentDepth === 0 && ctx.truncated) {
    result.truncated = true;
  }

  return result;
}

export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
