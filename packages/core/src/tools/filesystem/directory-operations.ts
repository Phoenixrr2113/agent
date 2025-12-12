import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { minimatch } from 'minimatch';
import type { SearchResult, DirectoryTree } from './types.js';
import { validatePath } from './path-security.js';

export async function searchFilesWithValidation(
  searchPath: string,
  pattern: string,
  excludePatterns?: string[]
): Promise<SearchResult[]> {
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

const MAX_DIRECTORY_DEPTH = 50;

export async function buildDirectoryTree(
  dirPath: string,
  excludePatterns?: string[],
  maxDepth: number = MAX_DIRECTORY_DEPTH,
  currentDepth: number = 0
): Promise<DirectoryTree> {
  const stats = await fs.stat(dirPath);
  const name = path.basename(dirPath);

  if (!stats.isDirectory()) {
    return { name, type: 'file' };
  }

  if (currentDepth >= maxDepth) {
    return {
      name,
      type: 'directory',
      children: [],
    };
  }

  const entries = await fs.readdir(dirPath);
  const children: DirectoryTree[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const relativePath = path.relative(dirPath, fullPath);

    if (excludePatterns && excludePatterns.some(p => minimatch(relativePath, p))) {
      continue;
    }

    try {
      const child = await buildDirectoryTree(fullPath, excludePatterns, maxDepth, currentDepth + 1);
      children.push(child);
    } catch {
      continue;
    }
  }

  return {
    name,
    type: 'directory',
    children,
  };
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
