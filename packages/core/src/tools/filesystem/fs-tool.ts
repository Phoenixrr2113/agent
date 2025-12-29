import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { tool } from 'ai';
import { z } from 'zod';

import { ToolError, ToolErrorType } from '../middleware/index.js';
import {
  searchFilesWithValidation,
  buildDirectoryTree,
  formatSize,
} from './directory-operations.js';
import {
  readFileContent,
  writeFileContent,
  getFileStats,
} from './file-operations.js';
import {
  setAllowedDirectories,
  validatePath,
  validateNewPath,
  validateAfterOperation,
} from './path-security.js';
import { success, error } from '../utils/tool-result.js';

const MAX_READ_LINES = 2000;
const MAX_LIST_ENTRIES = 1000;

export function createFsTool(workspaceRoot: string) {
  setAllowedDirectories([workspaceRoot]);

  const fsInputSchema = z.object({
    action: z.enum(['read', 'write', 'edit', 'list', 'glob', 'grep', 'move', 'delete', 'info', 'mkdir']).describe('File system operation to perform'),
    path: z.string().max(4096).describe('Path to file or directory'),
    content: z.string().optional().describe('Content for write action'),
    old_string: z.string().optional().describe('Text to find for edit action'),
    new_string: z.string().optional().describe('Replacement text for edit action'),
    offset: z.number().optional().describe('Start line for read (1-indexed)'),
    limit: z.number().max(MAX_READ_LINES).optional().describe(`Max lines to read (max ${MAX_READ_LINES})`),
    pattern: z.string().optional().describe('Glob pattern for glob/grep actions'),
    query: z.string().optional().describe('Regex pattern for grep action'),
    destination: z.string().optional().describe('Destination path for move action'),
    tree: z.boolean().optional().describe('Return recursive tree structure for list'),
    sizes: z.boolean().optional().describe('Include file sizes in list'),
    exclude: z.array(z.string()).optional().describe('Additional patterns to exclude from tree (e.g. ["*.log", "tmp"])'),
    includeDefaults: z.boolean().optional().describe('Include default exclusions like node_modules, .git (default: true)'),
  });

  return tool({
    description: `A unified tool for all filesystem operations within the workspace.
This tool provides safe, validated access to read, write, search, and manipulate files and directories.
All paths are validated against allowed directories to prevent unauthorized access.

When to use this tool:
- Reading or viewing file contents
- Writing or updating text files
- Searching for files by name pattern (glob) or content (grep)
- Exploring directory structure
- Moving, renaming, or deleting files
- Getting file metadata (size, timestamps, permissions)

Supported file formats:
- Text files: .txt, .md, .json, .csv, .xml, .yaml, .log, .html
- Code files: .js, .ts, .py, .go, .rs, .java, etc.
- Note: Binary files (images, PDFs, videos) cannot be read meaningfully

Key features:
- Automatic pagination for large files (max ${MAX_READ_LINES} lines per read)
- Truncation hints tell you how to continue reading
- Parent directories are auto-created on write
- Edit action does precise find/replace
- Path security prevents access outside workspace
- Structured JSON responses with success/error status

Actions:
- read: Read file contents. Use offset/limit for large files.
- write: Create new file or overwrite existing. Auto-creates parent dirs.
- edit: Find and replace text. Provide old_string and new_string.
- list: List directory contents. Use tree=true for recursive view.
- glob: Find files matching pattern (e.g., "**/*.txt", "docs/*.md")
- grep: Search file contents with regex query
- move: Rename or relocate file. Provide destination path.
- delete: Remove file or directory (recursive for dirs)
- info: Get file metadata (size, timestamps, permissions)
- mkdir: Create directory (with parents)

Parameters explained:
- action: Required. The operation to perform.
- path: Required. Target file or directory path.
- content: For write action. The text content to write.
- old_string: For edit action. Exact text to find (must match exactly).
- new_string: For edit action. Replacement text.
- offset: For read action. Start line (1-indexed). Use when file was truncated.
- limit: For read action. Max lines to return (max ${MAX_READ_LINES}).
- pattern: For glob action. Glob pattern like "*.txt" or "reports/**/*.csv".
- query: For grep action. Regular expression to search for.
- destination: For move action. Target path for the file.
- tree: For list action. If true, returns recursive tree structure.
- sizes: For list action. If true, includes file sizes.

You should:
1. Use read with offset to continue reading truncated files
2. Use edit for targeted changes instead of read-then-write
3. Use glob before grep to find files, then grep specific files
4. Check the hint field in responses for continuation guidance
5. Use list with tree=true to understand directory structure`,
    inputSchema: fsInputSchema,
    execute: async (input) => {
      const { action, path: targetPath } = input;

      try {
        switch (action) {
          case 'read': {
            const validPath = await validatePath(targetPath);
            const stats = await fs.stat(validPath);
            
            if (stats.isDirectory()) {
              throw new ToolError('Path is a directory, use action: list', ToolErrorType.PATH_IS_NOT_A_FILE);
            }

            let content: string;
            let truncated = false;
            let linesShown: [number, number] | undefined;

            if (input.offset !== undefined || input.limit !== undefined) {
              const fileContent = await readFileContent(validPath);
              const lines = fileContent.split('\n');
              const totalLines = lines.length;
              const start = Math.max(0, (input.offset ?? 1) - 1);
              const end = Math.min(totalLines, start + (input.limit ?? MAX_READ_LINES));
              
              content = lines.slice(start, end).join('\n');
              truncated = end < totalLines;
              linesShown = [start + 1, end];

              if (truncated) {
                return success({
                  path: targetPath,
                  content,
                  truncated: true,
                  linesShown,
                  totalLines,
                  nextOffset: end + 1,
                  hint: `Showing lines ${linesShown[0]}-${linesShown[1]} of ${totalLines}. Use offset: ${end + 1} to continue.`,
                });
              }
            } else {
              content = await readFileContent(validPath);
              const lines = content.split('\n');
              if (lines.length > MAX_READ_LINES) {
                content = lines.slice(0, MAX_READ_LINES).join('\n');
                truncated = true;
                linesShown = [1, MAX_READ_LINES];
                return success({
                  path: targetPath,
                  content,
                  truncated: true,
                  linesShown,
                  totalLines: lines.length,
                  nextOffset: MAX_READ_LINES + 1,
                  hint: `File truncated. Use offset: ${MAX_READ_LINES + 1} to continue reading.`,
                });
              }
            }

            return success({ path: targetPath, content });
          }

          case 'write': {
            if (!input.content) {
              throw new ToolError('content is required for write action', ToolErrorType.INVALID_INPUT);
            }
            const validPath = await validateNewPath(targetPath);
            const dir = path.dirname(validPath);
            await fs.mkdir(dir, { recursive: true });
            await writeFileContent(validPath, input.content);
            await validateAfterOperation(validPath);
            return success({ path: targetPath, message: 'File written successfully' });
          }

          case 'edit': {
            if (!input.old_string || input.new_string === undefined) {
              throw new ToolError('old_string and new_string are required for edit action', ToolErrorType.INVALID_INPUT);
            }
            const validPath = await validatePath(targetPath);
            const content = await readFileContent(validPath);
            
            if (!content.includes(input.old_string)) {
              return error('old_string not found in file. Verify the exact text exists.', { path: targetPath });
            }

            const newContent = content.replace(input.old_string, input.new_string);
            await writeFileContent(validPath, newContent);
            
            return success({
              path: targetPath,
              message: 'Edit applied successfully',
              replacements: 1,
            });
          }

          case 'list': {
            const validPath = await validatePath(targetPath);
            const stats = await fs.stat(validPath);
            
            if (!stats.isDirectory()) {
              throw new ToolError('Path is not a directory', ToolErrorType.PATH_IS_NOT_A_DIRECTORY);
            }

            if (input.tree) {
              const tree = await buildDirectoryTree(validPath, {
                excludePatterns: input.exclude,
                useDefaultExcludes: input.includeDefaults !== false,
              });
              const result: Record<string, unknown> = { path: targetPath, tree };
              if ('truncated' in tree && tree.truncated) {
                result['truncated'] = true;
                result['hint'] = 'Tree was truncated. node_modules, .git, dist excluded by default (use includeDefaults: false to include). Max 500 entries, depth 5.';
              }
              return success(result);
            }

            const entries = await fs.readdir(validPath);
            const items = await Promise.all(
              entries.slice(0, MAX_LIST_ENTRIES).map(async (entry) => {
                const fullPath = path.join(validPath, entry);
                try {
                  const entryStats = await fs.stat(fullPath);
                  const item: Record<string, unknown> = {
                    name: entry,
                    type: entryStats.isDirectory() ? 'directory' : 'file',
                  };
                  if (input.sizes) {
                  item['size'] = entryStats.size;
                  item['formattedSize'] = formatSize(entryStats.size);
                }
                  return item;
                } catch {
                  return { name: entry, type: 'unknown' };
                }
              })
            );

            const result: Record<string, unknown> = { path: targetPath, entries: items };
            if (entries.length > MAX_LIST_ENTRIES) {
              result['truncated'] = true;
              result['totalEntries'] = entries.length;
            }
            return success(result);
          }

          case 'glob': {
            if (!input.pattern) {
              throw new ToolError('pattern is required for glob action', ToolErrorType.INVALID_INPUT);
            }
            const results = await searchFilesWithValidation(targetPath, input.pattern);
            return success({
              path: targetPath,
              pattern: input.pattern,
              results: results.slice(0, 500),
              count: results.length,
              truncated: results.length > 500,
            });
          }

          case 'grep': {
            if (!input.query) {
              throw new ToolError('query is required for grep action', ToolErrorType.INVALID_INPUT);
            }
            const validPath = await validatePath(targetPath);
            const content = await readFileContent(validPath);
            const lines = content.split('\n');
            const regex = new RegExp(input.query, 'g');
            const matches: Array<{ line: number; content: string }> = [];

            for (let i = 0; i < lines.length && matches.length < 100; i++) {
              if (regex.test(lines[i]!)) {
                matches.push({ line: i + 1, content: lines[i]! });
              }
              regex.lastIndex = 0;
            }

            return success({
              path: targetPath,
              query: input.query,
              matches,
              count: matches.length,
              truncated: matches.length >= 100,
            });
          }

          case 'move': {
            if (!input.destination) {
              throw new ToolError('destination is required for move action', ToolErrorType.INVALID_INPUT);
            }
            const validSource = await validatePath(targetPath);
            const validDest = await validateNewPath(input.destination);
            
            try {
              await fs.access(validDest);
              return error('Destination already exists', { source: targetPath, destination: input.destination });
            } catch {
            }

            await fs.rename(validSource, validDest);
            await validateAfterOperation(validDest);
            return success({
              source: targetPath,
              destination: input.destination,
              message: 'Moved successfully',
            });
          }

          case 'delete': {
            const validPath = await validatePath(targetPath);
            const stats = await fs.stat(validPath);
            
            if (stats.isDirectory()) {
              await fs.rm(validPath, { recursive: true });
            } else {
              await fs.unlink(validPath);
            }
            
            return success({ path: targetPath, message: 'Deleted successfully' });
          }

          case 'info': {
            const validPath = await validatePath(targetPath);
            const info = await getFileStats(validPath);
            return success({
              path: targetPath,
              info: {
                ...info,
                formattedSize: formatSize(info.size),
              },
            });
          }

          case 'mkdir': {
            const validPath = await validateNewPath(targetPath);
            await fs.mkdir(validPath, { recursive: true });
            await validateAfterOperation(validPath);
            return success({ path: targetPath, message: 'Directory created' });
          }

          default:
            throw new ToolError(`Unknown action: ${action}`, ToolErrorType.INVALID_INPUT);
        }
      } catch (err) {
        if (err instanceof ToolError) {
          return error(err.message, { path: targetPath, errorType: err.type });
        }
        const nodeError = err as NodeJS.ErrnoException;
        if (nodeError.code === 'ENOENT') {
          return error(`File not found: ${targetPath}`, { path: targetPath, errorType: ToolErrorType.FILE_NOT_FOUND });
        }
        if (nodeError.code === 'EACCES') {
          return error(`Permission denied: ${targetPath}`, { path: targetPath, errorType: ToolErrorType.PERMISSION_DENIED });
        }
        return error(err instanceof Error ? err.message : String(err), { path: targetPath });
      }
    },
  });
}
