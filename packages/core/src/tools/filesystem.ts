import { tool } from 'ai';
import { z } from 'zod';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createTwoFilesPatch } from 'diff';
import { glob } from 'glob';
import { minimatch } from 'minimatch';

let allowedDirectories: string[] = [];

export interface FileInfo {
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  isDirectory: boolean;
  isFile: boolean;
  permissions: string;
}

export interface SearchResult {
  path: string;
  isDirectory: boolean;
}

export interface FileEdit {
  oldText: string;
  newText: string;
}

export function setAllowedDirectories(directories: string[]): void {
  allowedDirectories = directories.map(dir => path.resolve(expandHome(normalizePath(dir))));
}

export function getAllowedDirectories(): string[] {
  return [...allowedDirectories];
}

function expandHome(filepath: string): string {
  if (filepath.startsWith('~')) {
    return filepath.replace('~', os.homedir());
  }
  return filepath;
}

function normalizePath(p: string): string {
  let cleaned = p.trim().replace(/^["']|["']$/g, '');

  if (cleaned.startsWith('/mnt/')) {
    return cleaned;
  }

  if (process.platform === 'win32') {
    if (/^\/[a-zA-Z]\//.test(cleaned)) {
      cleaned = cleaned[1] + ':' + cleaned.slice(2);
    }

    if (/^\\\\/.test(cleaned)) {
      cleaned = cleaned.replace(/^\\+/, '\\\\');
    }

    if (/^[a-z]:/.test(cleaned)) {
      cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
    }

    return cleaned.replace(/\//g, '\\');
  }

  return cleaned;
}

function isPathWithinAllowedDirectories(targetPath: string): boolean {
  if (typeof targetPath !== 'string' || !targetPath) {
    throw new Error('Path must be a non-empty string');
  }

  if (!Array.isArray(allowedDirectories) || allowedDirectories.length === 0) {
    throw new Error('No allowed directories configured');
  }

  if (targetPath.includes('\x00')) {
    throw new Error('Path contains null bytes');
  }

  for (const dir of allowedDirectories) {
    if (dir.includes('\x00')) {
      throw new Error('Allowed directory contains null bytes');
    }
  }

  let normalizedPath: string;
  try {
    normalizedPath = path.normalize(path.resolve(targetPath));
  } catch {
    throw new Error(`Failed to normalize path: ${targetPath}`);
  }

  if (!path.isAbsolute(normalizedPath)) {
    throw new Error(`Path is not absolute after normalization: ${targetPath}`);
  }

  for (const allowedDir of allowedDirectories) {
    let normalizedAllowedDir: string;
    try {
      normalizedAllowedDir = path.normalize(path.resolve(allowedDir));
    } catch {
      continue;
    }

    if (normalizedPath === normalizedAllowedDir) {
      return true;
    }

    if (normalizedAllowedDir === path.sep) {
      return true;
    }

    if (process.platform === 'win32' && /^[A-Z]:\\?$/.test(normalizedAllowedDir)) {
      const pathDrive = normalizedPath.substring(0, 2);
      const allowedDrive = normalizedAllowedDir.substring(0, 2);
      if (pathDrive === allowedDrive) {
        return true;
      }
    }

    const separator = normalizedAllowedDir.endsWith(path.sep)
      ? ''
      : path.sep;
    if (normalizedPath.startsWith(normalizedAllowedDir + separator)) {
      return true;
    }
  }

  return false;
}

async function validatePath(targetPath: string): Promise<string> {
  const expandedPath = expandHome(normalizePath(targetPath));
  const resolvedPath = path.resolve(expandedPath);

  let realPath: string;
  try {
    realPath = await fs.realpath(resolvedPath);
  } catch {
    realPath = resolvedPath;
  }

  if (!isPathWithinAllowedDirectories(realPath)) {
    throw new Error(
      `Access denied: ${targetPath} is outside allowed directories (${allowedDirectories.join(', ')})`
    );
  }

  return realPath;
}

async function validateNewPath(targetPath: string): Promise<string> {
  const expandedPath = expandHome(normalizePath(targetPath));
  const resolvedPath = path.resolve(expandedPath);

  if (!isPathWithinAllowedDirectories(resolvedPath)) {
    throw new Error(
      `Access denied: ${targetPath} is outside allowed directories`
    );
  }

  let currentPath = resolvedPath;
  let existingParent: string | null = null;

  while (currentPath !== path.dirname(currentPath)) {
    try {
      await fs.access(currentPath);
      existingParent = currentPath;
      break;
    } catch {
      currentPath = path.dirname(currentPath);
    }
  }

  if (existingParent) {
    try {
      const realParent = await fs.realpath(existingParent);
      if (!isPathWithinAllowedDirectories(realParent)) {
        throw new Error(
          `Access denied: parent directory is outside allowed directories`
        );
      }
    } catch {
      throw new Error(`Parent directory validation failed`);
    }
  }

  return resolvedPath;
}

async function getFileStats(filePath: string): Promise<FileInfo> {
  const stats = await fs.stat(filePath);

  return {
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime,
    accessed: stats.atime,
    isDirectory: stats.isDirectory(),
    isFile: stats.isFile(),
    permissions: `0${(stats.mode & parseInt('777', 8)).toString(8)}`,
  };
}

async function readFileContent(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

async function writeFileContent(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp${Date.now()}`;
  try {
    await fs.writeFile(tempPath, content, { encoding: 'utf-8', flag: 'w' });
    await fs.rename(tempPath, filePath);
  } catch (error) {
    try {
      await fs.unlink(tempPath);
    } catch {}
    throw error;
  }
}

async function readMediaFile(filePath: string): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath);

    stream.on('data', (chunk: string | Buffer) => {
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      chunks.push(buffer);
    });
    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const base64 = buffer.toString('base64');
      const ext = path.extname(filePath).toLowerCase();

      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.flac': 'audio/flac',
      };

      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      resolve({ data: base64, mimeType });
    });
    stream.on('error', reject);
  });
}

async function tailFile(filePath: string, lines: number): Promise<string> {
  const chunkSize = 1024;
  const fileHandle = await fs.open(filePath, 'r');

  try {
    const stats = await fileHandle.stat();
    const fileSize = stats.size;

    let position = fileSize;
    let content = '';
    let lineCount = 0;

    while (position > 0 && lineCount <= lines) {
      const readSize = Math.min(chunkSize, position);
      position -= readSize;

      const buffer = Buffer.alloc(readSize);
      await fileHandle.read(buffer, 0, readSize, position);

      content = buffer.toString('utf-8') + content;
      lineCount = (content.match(/\n/g) || []).length;
    }

    const allLines = content.split('\n');
    return allLines.slice(-lines).join('\n');
  } finally {
    await fileHandle.close();
  }
}

async function headFile(filePath: string, lines: number): Promise<string> {
  const fileHandle = await fs.open(filePath, 'r');

  try {
    const result: string[] = [];
    const buffer = Buffer.alloc(1024);
    let remaining = '';

    while (result.length < lines) {
      const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;

      const chunk = remaining + buffer.toString('utf-8', 0, bytesRead);
      const chunkLines = chunk.split('\n');
      remaining = chunkLines.pop() || '';

      result.push(...chunkLines);
      if (result.length >= lines) break;
    }

    if (result.length < lines && remaining) {
      result.push(remaining);
    }

    return result.slice(0, lines).join('\n');
  } finally {
    await fileHandle.close();
  }
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function createUnifiedDiff(
  originalContent: string,
  newContent: string,
  filepath: string
): string {
  return createTwoFilesPatch(
    filepath,
    filepath,
    originalContent,
    newContent,
    'original',
    'modified'
  );
}

async function applyFileEdits(
  filePath: string,
  edits: FileEdit[],
  dryRun: boolean
): Promise<string> {
  const originalContent = await readFileContent(filePath);
  const normalizedOriginal = normalizeLineEndings(originalContent);
  let modifiedContent = normalizedOriginal;

  for (const edit of edits) {
    const normalizedOld = normalizeLineEndings(edit.oldText);
    const normalizedNew = normalizeLineEndings(edit.newText);

    if (!modifiedContent.includes(normalizedOld)) {
      throw new Error(`Could not find text to replace: ${edit.oldText.substring(0, 50)}...`);
    }

    modifiedContent = modifiedContent.replace(normalizedOld, normalizedNew);
  }

  const diff = createUnifiedDiff(normalizedOriginal, modifiedContent, filePath);

  if (!dryRun) {
    await writeFileContent(filePath, modifiedContent);
  }

  return diff;
}

async function searchFilesWithValidation(
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

async function buildDirectoryTree(
  dirPath: string,
  excludePatterns?: string[]
): Promise<any> {
  const stats = await fs.stat(dirPath);
  const name = path.basename(dirPath);

  if (!stats.isDirectory()) {
    return { name, type: 'file' };
  }

  const entries = await fs.readdir(dirPath);
  const children: any[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const relativePath = path.relative(dirPath, fullPath);

    if (excludePatterns && excludePatterns.some(p => minimatch(relativePath, p))) {
      continue;
    }

    try {
      const child = await buildDirectoryTree(fullPath, excludePatterns);
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

export function createFilesystemTools(workspaceRoot: string) {
  setAllowedDirectories([workspaceRoot]);

  return {
    read_text_file: tool({
      description: 'Read complete file contents as text, with optional head/tail parameters to read first/last N lines',
      inputSchema: z.object({
        path: z.string().describe('Path to the file to read'),
        head: z.number().optional().describe('Number of lines from start'),
        tail: z.number().optional().describe('Number of lines from end'),
      }),
      execute: async ({ path: filePath, head, tail }) => {
        try {
          if (head && tail) {
            return JSON.stringify({
              error: 'Cannot specify both head and tail parameters',
            });
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

          return JSON.stringify({
            path: filePath,
            content,
            success: true,
          });
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: filePath,
          });
        }
      },
    }),

    read_media_file: tool({
      description: 'Returns base64-encoded binary data with MIME type for images and audio files',
      inputSchema: z.object({
        path: z.string().describe('Path to the media file'),
      }),
      execute: async ({ path: filePath }) => {
        try {
          const validPath = await validatePath(filePath);
          const { data, mimeType } = await readMediaFile(validPath);

          return JSON.stringify({
            path: filePath,
            data,
            mimeType,
            success: true,
          });
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: filePath,
          });
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
            } catch (error) {
              return {
                path: filePath,
                error: error instanceof Error ? error.message : 'Unknown error',
                success: false,
              };
            }
          })
        );

        return JSON.stringify({ results });
      },
    }),

    write_file: tool({
      description: 'Create or overwrite file with text content. Uses atomic write for safety.',
      inputSchema: z.object({
        path: z.string().describe('Path to the file'),
        content: z.string().describe('Content to write'),
      }),
      execute: async ({ path: filePath, content }) => {
        try {
          const validPath = await validateNewPath(filePath);
          await writeFileContent(validPath, content);

          return JSON.stringify({
            path: filePath,
            success: true,
            message: 'File written successfully',
          });
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: filePath,
          });
        }
      },
    }),

    edit_file: tool({
      description: 'Line-based text replacement with git-style diff output. Supports dry-run previews.',
      inputSchema: z.object({
        path: z.string().describe('Path to the file'),
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

          return JSON.stringify({
            path: filePath,
            diff,
            dryRun,
            success: true,
            message: dryRun ? 'Preview (not applied)' : 'Edits applied successfully',
          });
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: filePath,
          });
        }
      },
    }),

    create_directory: tool({
      description: 'Create directories recursively. Idempotent (succeeds silently if exists).',
      inputSchema: z.object({
        path: z.string().describe('Path to the directory'),
      }),
      execute: async ({ path: dirPath }) => {
        try {
          const validPath = await validateNewPath(dirPath);
          await fs.mkdir(validPath, { recursive: true });

          return JSON.stringify({
            path: dirPath,
            success: true,
            message: 'Directory created',
          });
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: dirPath,
          });
        }
      },
    }),

    list_directory: tool({
      description: 'List directory contents with [FILE] and [DIR] prefixes',
      inputSchema: z.object({
        path: z.string().describe('Path to the directory'),
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

          return JSON.stringify({
            path: dirPath,
            entries: items,
            success: true,
          });
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: dirPath,
          });
        }
      },
    }),

    list_directory_with_sizes: tool({
      description: 'List directory with file sizes and sorting options',
      inputSchema: z.object({
        path: z.string().describe('Path to the directory'),
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

          return JSON.stringify({
            path: dirPath,
            entries: items,
            sortBy,
            success: true,
          });
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: dirPath,
          });
        }
      },
    }),

    directory_tree: tool({
      description: 'Returns recursive JSON structure with name, type, and children',
      inputSchema: z.object({
        path: z.string().describe('Path to the directory'),
        excludePatterns: z.array(z.string()).optional().describe('Glob patterns to exclude'),
      }),
      execute: async ({ path: dirPath, excludePatterns }) => {
        try {
          const validPath = await validatePath(dirPath);
          const tree = await buildDirectoryTree(validPath, excludePatterns);

          return JSON.stringify({
            path: dirPath,
            tree,
            success: true,
          });
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: dirPath,
          });
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

          return JSON.stringify({
            path: searchPath,
            pattern,
            results,
            count: results.length,
            success: true,
          });
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: searchPath,
          });
        }
      },
    }),

    get_file_info: tool({
      description: 'Returns metadata including size, timestamps, permissions, and type',
      inputSchema: z.object({
        path: z.string().describe('Path to the file'),
      }),
      execute: async ({ path: filePath }) => {
        try {
          const validPath = await validatePath(filePath);
          const info = await getFileStats(validPath);

          return JSON.stringify({
            path: filePath,
            info: {
              ...info,
              formattedSize: formatSize(info.size),
            },
            success: true,
          });
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: filePath,
          });
        }
      },
    }),

    move_file: tool({
      description: 'Rename or move files/directories. Fails if destination exists.',
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
            return JSON.stringify({
              error: 'Destination already exists',
              source,
              destination,
            });
          } catch {
          }

          await fs.rename(validSource, validDest);

          return JSON.stringify({
            source,
            destination,
            success: true,
            message: 'File moved successfully',
          });
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            source,
            destination,
          });
        }
      },
    }),
  };
}
