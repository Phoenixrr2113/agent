/**
 * @fileoverview Filesystem tools module.
 * Provides file/directory operations with security validation.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { tool } from 'ai';
import { z } from 'zod';
import { glob } from 'glob';
import { minimatch } from 'minimatch';

import type { DurabilityConfig, StreamWriter, ToolError, ToolErrorType } from '../../types/lifecycle';
import type { FileContentData } from '../../streaming/data-parts';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface FileInfo {
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  isDirectory: boolean;
  isFile: boolean;
  permissions: string;
}

export interface FileEdit {
  oldText: string;
  newText: string;
}

export interface FilesystemToolsOptions {
  workspaceRoot: string;
  writer?: StreamWriter;
  enableStreaming?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Path Security
// ═══════════════════════════════════════════════════════════════════════════════

let allowedDirectories: string[] = [];

export async function setAllowedDirectoriesAsync(directories: string[]): Promise<void> {
  allowedDirectories = await Promise.all(
    directories.map(async dir => {
      const resolved = path.resolve(expandHome(dir));
      try {
        return await fs.realpath(resolved);
      } catch {
        return resolved;
      }
    })
  );
}

export function setAllowedDirectories(directories: string[]): void {
  // Synchronous version - resolved paths immediately
  allowedDirectories = directories.map(dir => path.resolve(expandHome(dir)));
  // Also try to resolve realpath synchronously where possible
  (async () => {
    await setAllowedDirectoriesAsync(directories);
  })();
}

export function getAllowedDirectories(): string[] {
  return [...allowedDirectories];
}

export function expandHome(filepath: string): string {
  return filepath.startsWith('~') ? filepath.replace('~', os.homedir()) : filepath;
}

function isPathWithinAllowedDirectories(targetPath: string): boolean {
  if (!targetPath || !allowedDirectories.length) return false;
  const normalizedPath = path.normalize(path.resolve(targetPath));
  return allowedDirectories.some(dir => {
    const normalizedDir = path.normalize(path.resolve(dir));
    return normalizedPath === normalizedDir || normalizedPath.startsWith(normalizedDir + path.sep);
  });
}

export async function validatePath(targetPath: string): Promise<string> {
  const expandedPath = expandHome(targetPath);
  const resolvedPath = path.resolve(expandedPath);
  let realPath: string;
  try {
    realPath = await fs.realpath(resolvedPath);
  } catch {
    realPath = resolvedPath;
  }
  if (!isPathWithinAllowedDirectories(realPath)) {
    throw new Error(`Access denied: ${targetPath} is outside allowed directories`);
  }
  return realPath;
}

export async function validateNewPath(targetPath: string): Promise<string> {
  const resolvedPath = path.resolve(expandHome(targetPath));
  if (!isPathWithinAllowedDirectories(resolvedPath)) {
    throw new Error(`Access denied: ${targetPath} is outside allowed directories`);
  }
  return resolvedPath;
}

// ═══════════════════════════════════════════════════════════════════════════════
// File Operations
// ═══════════════════════════════════════════════════════════════════════════════

export async function readFileContent(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

export async function writeFileContent(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp${Date.now()}`;
  try {
    await fs.writeFile(tempPath, content, { encoding: 'utf-8' });
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
}

export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes, unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024; unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Durability & Helpers
// ═══════════════════════════════════════════════════════════════════════════════

export const filesystemDurability: DurabilityConfig = {
  enabled: true,
  independent: true,
  retryCount: 3,
  timeout: '2m',
};

function success<T>(data: T): string {
  return JSON.stringify({ success: true, ...data });
}

function error(err: Error | string, details?: Record<string, unknown>): string {
  const message = err instanceof Error ? err.message : err;
  return JSON.stringify({ success: false, error: message, ...details });
}

function streamFileContent(writer: StreamWriter | undefined, data: FileContentData): void {
  if (writer) writer.write({ type: 'data-file-content', data });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Factory
// ═══════════════════════════════════════════════════════════════════════════════

export function createFilesystemTools(options: FilesystemToolsOptions) {
  const { workspaceRoot, writer, enableStreaming = true } = options;
  setAllowedDirectories([workspaceRoot]);

  return {
    read_text_file: tool({
      description: 'Read file contents as text.',
      inputSchema: z.object({
        path: z.string().max(4096).describe('Path to file'),
        head: z.number().optional().describe('First N lines'),
        tail: z.number().optional().describe('Last N lines'),
      }),
      execute: async ({ path: filePath, head, tail }) => {
        try {
          const validPath = await validatePath(filePath);
          let content = await readFileContent(validPath);
          
          if (head) content = content.split('\n').slice(0, head).join('\n');
          else if (tail) content = content.split('\n').slice(-tail).join('\n');
          
          if (enableStreaming) {
            streamFileContent(writer, { path: filePath, content, truncated: false });
          }
          
          return success({
            path: filePath,
            lines: content.split('\n').length,
            chars: content.length,
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: filePath });
        }
      },
    }),

    write_file: tool({
      description: 'Write content to file.',
      inputSchema: z.object({
        path: z.string().max(4096).describe('File path'),
        content: z.string().describe('Content to write'),
      }),
      execute: async ({ path: filePath, content }) => {
        try {
          const validPath = await validateNewPath(filePath);
          await fs.mkdir(path.dirname(validPath), { recursive: true });
          await writeFileContent(validPath, content);
          return success({ path: filePath, bytes: content.length });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: filePath });
        }
      },
    }),

    list_directory: tool({
      description: 'List directory contents.',
      inputSchema: z.object({
        path: z.string().max(4096).describe('Directory path'),
      }),
      execute: async ({ path: dirPath }) => {
        try {
          const validPath = await validatePath(dirPath);
          const entries = await fs.readdir(validPath);
          const items = await Promise.all(entries.map(async entry => {
            const fullPath = path.join(validPath, entry);
            try {
              const stats = await fs.stat(fullPath);
              return { name: entry, type: stats.isDirectory() ? 'directory' : 'file' };
            } catch { return { name: entry, type: 'unknown' }; }
          }));
          return success({ path: dirPath, entries: items, count: items.length });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: dirPath });
        }
      },
    }),

    create_directory: tool({
      description: 'Create directory recursively.',
      inputSchema: z.object({ path: z.string().max(4096) }),
      execute: async ({ path: dirPath }) => {
        try {
          const validPath = await validateNewPath(dirPath);
          await fs.mkdir(validPath, { recursive: true });
          return success({ path: dirPath });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: dirPath });
        }
      },
    }),

    get_file_info: tool({
      description: 'Get file metadata.',
      inputSchema: z.object({ path: z.string().max(4096) }),
      execute: async ({ path: filePath }) => {
        try {
          const validPath = await validatePath(filePath);
          const stats = await fs.stat(validPath);
          return success({
            path: filePath,
            size: stats.size,
            formattedSize: formatSize(stats.size),
            isDirectory: stats.isDirectory(),
            modified: stats.mtime,
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: filePath });
        }
      },
    }),
  };
}
