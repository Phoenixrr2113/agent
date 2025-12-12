import { tool } from 'ai';
import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';

import {
  setAllowedDirectories,
  validatePath,
  validateNewPath,
  validateAfterOperation,
} from './path-security.js';

import {
  readFileContent,
  writeFileContent,
  readMediaFile,
  headFile,
  tailFile,
  applyFileEdits,
  getFileStats,
} from './file-operations.js';

import {
  searchFilesWithValidation,
  buildDirectoryTree,
  formatSize,
} from './directory-operations.js';

import { success, error } from '../utils/tool-result.js';

export function createFilesystemTools(workspaceRoot: string) {
  setAllowedDirectories([workspaceRoot]);

  return {
    read_text_file: tool({
      description: 'Read complete file contents as text, with optional head/tail parameters to read first/last N lines',
      inputSchema: z.object({
        path: z.string().max(4096).describe('Path to the file to read'),
        head: z.number().optional().describe('Number of lines from start'),
        tail: z.number().optional().describe('Number of lines from end'),
      }),
      execute: async ({ path: filePath, head, tail }) => {
        try {
          if (head && tail) {
            return error('Cannot specify both head and tail parameters');
          }

          const validPath = await validatePath(filePath);
          let content: string;

          if (head) {
            content = await headFile(validPath, head);
          } else if (tail) {
            content = await tailFile(validPath, tail);
          } else {
            content = await readFileContent(validPath);
          }

          return success({
            path: filePath,
            content,
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: filePath });
        }
      },
    }),

    read_media_file: tool({
      description: 'Returns base64-encoded binary data with MIME type for images and audio files',
      inputSchema: z.object({
        path: z.string().max(4096).describe('Path to the media file'),
      }),
      execute: async ({ path: filePath }) => {
        try {
          const validPath = await validatePath(filePath);
          const { data, mimeType } = await readMediaFile(validPath);

          return success({
            path: filePath,
            data,
            mimeType,
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: filePath });
        }
      },
    }),

    read_multiple_files: tool({
      description: 'Read multiple files simultaneously, returns concatenated results with file path references',
      inputSchema: z.object({
        paths: z.array(z.string()).describe('Array of file paths to read'),
      }),
      execute: async ({ paths }) => {
        const results = await Promise.all(
          paths.map(async (filePath) => {
            try {
              const validPath = await validatePath(filePath);
              const content = await readFileContent(validPath);
              return {
                path: filePath,
                content,
                success: true,
              };
            } catch (err) {
              return {
                path: filePath,
                error: err instanceof Error ? err.message : 'Unknown error',
                success: false,
              };
            }
          })
        );
        return JSON.stringify({ results });
      },
    }),

    write_file: tool({
      description: 'Create or overwrite file with text content. Uses atomic write for safety. Security: Validates path after creation to prevent symlink attacks - files resolving outside allowed directories are auto-removed.',
      inputSchema: z.object({
        path: z.string().max(4096).describe('Path to the file'),
        content: z.string().describe('Content to write'),
      }),
      execute: async ({ path: filePath, content }) => {
        try {
          const validPath = await validateNewPath(filePath);
          await writeFileContent(validPath, content);
          await validateAfterOperation(validPath);

          return success({
            path: filePath,
            message: 'File written successfully',
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: filePath });
        }
      },
    }),

    edit_file: tool({
      description: 'Line-based text replacement with git-style diff output. Supports dry-run previews.',
      inputSchema: z.object({
        path: z.string().max(4096).describe('Path to the file'),
        edits: z.array(z.object({
          oldText: z.string(),
          newText: z.string(),
        })).describe('Array of text replacements'),
        dryRun: z.boolean().optional().default(false).describe('Preview changes without writing'),
      }),
      execute: async ({ path: filePath, edits, dryRun = false }) => {
        try {
          const validPath = await validatePath(filePath);
          const diff = await applyFileEdits(validPath, edits, dryRun);

          return success({
            path: filePath,
            diff,
            dryRun,
            message: dryRun ? 'Preview (not applied)' : 'Edits applied successfully',
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: filePath });
        }
      },
    }),

    create_directory: tool({
      description: 'Create directories recursively. Idempotent (succeeds silently if exists). Security: Validates path after creation to prevent symlink attacks - directories resolving outside allowed paths are auto-removed.',
      inputSchema: z.object({
        path: z.string().max(4096).describe('Path to the directory'),
      }),
      execute: async ({ path: dirPath }) => {
        try {
          const validPath = await validateNewPath(dirPath);
          await fs.mkdir(validPath, { recursive: true });
          await validateAfterOperation(validPath);

          return success({
            path: dirPath,
            message: 'Directory created',
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: dirPath });
        }
      },
    }),

    list_directory: tool({
      description: 'List directory contents with [FILE] and [DIR] prefixes',
      inputSchema: z.object({
        path: z.string().max(4096).describe('Path to the directory'),
      }),
      execute: async ({ path: dirPath }) => {
        try {
          const validPath = await validatePath(dirPath);
          const entries = await fs.readdir(validPath);

          const items = await Promise.all(
            entries.map(async (entry) => {
              const fullPath = path.join(validPath, entry);
              try {
                const stats = await fs.stat(fullPath);
                return {
                  name: entry,
                  type: stats.isDirectory() ? 'directory' : 'file',
                  prefix: stats.isDirectory() ? '[DIR]' : '[FILE]',
                };
              } catch {
                return {
                  name: entry,
                  type: 'unknown',
                  prefix: '[?]',
                };
              }
            })
          );

          return success({
            path: dirPath,
            entries: items,
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: dirPath });
        }
      },
    }),

    list_directory_with_sizes: tool({
      description: 'List directory with file sizes and sorting options',
      inputSchema: z.object({
        path: z.string().max(4096).describe('Path to the directory'),
        sortBy: z.enum(['name', 'size']).optional().default('name').describe('Sort by name or size'),
      }),
      execute: async ({ path: dirPath, sortBy = 'name' }) => {
        try {
          const validPath = await validatePath(dirPath);
          const entries = await fs.readdir(validPath);

          const items = await Promise.all(
            entries.map(async (entry) => {
              const fullPath = path.join(validPath, entry);
              try {
                const stats = await fs.stat(fullPath);
                return {
                  name: entry,
                  type: stats.isDirectory() ? 'directory' : 'file',
                  size: stats.size,
                  formattedSize: formatSize(stats.size),
                };
              } catch {
                return {
                  name: entry,
                  type: 'unknown',
                  size: 0,
                  formattedSize: '0 B',
                };
              }
            })
          );

          if (sortBy === 'size') {
            items.sort((a, b) => b.size - a.size);
          } else {
            items.sort((a, b) => a.name.localeCompare(b.name));
          }

          return success({
            path: dirPath,
            entries: items,
            sortBy,
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: dirPath });
        }
      },
    }),

    directory_tree: tool({
      description: 'Returns recursive JSON structure with name, type, and children',
      inputSchema: z.object({
        path: z.string().max(4096).describe('Path to the directory'),
        excludePatterns: z.array(z.string()).optional().describe('Glob patterns to exclude'),
      }),
      execute: async ({ path: dirPath, excludePatterns }) => {
        try {
          const validPath = await validatePath(dirPath);
          const tree = await buildDirectoryTree(validPath, excludePatterns);

          return success({
            path: dirPath,
            tree,
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: dirPath });
        }
      },
    }),

    search_files: tool({
      description: 'Glob-pattern matching using minimatch. Searches relative to provided path with exclude support.',
      inputSchema: z.object({
        path: z.string().describe('Base path to search from'),
        pattern: z.string().describe('Glob pattern (e.g., "**/*.ts")'),
        excludePatterns: z.array(z.string()).optional().describe('Patterns to exclude'),
      }),
      execute: async ({ path: searchPath, pattern, excludePatterns }) => {
        try {
          const results = await searchFilesWithValidation(searchPath, pattern, excludePatterns);

          return success({
            path: searchPath,
            pattern,
            results,
            count: results.length,
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: searchPath });
        }
      },
    }),

    get_file_info: tool({
      description: 'Returns metadata including size, timestamps, permissions, and type',
      inputSchema: z.object({
        path: z.string().max(4096).describe('Path to the file'),
      }),
      execute: async ({ path: filePath }) => {
        try {
          const validPath = await validatePath(filePath);
          const info = await getFileStats(validPath);

          return success({
            path: filePath,
            info: {
              ...info,
              formattedSize: formatSize(info.size),
            },
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { path: filePath });
        }
      },
    }),

    move_file: tool({
      description: 'Rename or move files/directories. Fails if destination exists. Security: Validates destination path after move to prevent symlink attacks - files resolving outside allowed directories are auto-removed.',
      inputSchema: z.object({
        source: z.string().describe('Source path'),
        destination: z.string().describe('Destination path'),
      }),
      execute: async ({ source, destination }) => {
        try {
          const validSource = await validatePath(source);
          const validDest = await validateNewPath(destination);

          try {
            await fs.access(validDest);
            return error('Destination already exists', { source, destination });
          } catch {
            // Destination does not exist, safe to proceed
          }

          await fs.rename(validSource, validDest);
          await validateAfterOperation(validDest);

          return success({
            source,
            destination,
            message: 'File moved successfully',
          });
        } catch (err) {
          return error(err instanceof Error ? err : String(err), { source, destination });
        }
      },
    }),
  };
}
