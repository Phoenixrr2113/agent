import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import * as path from 'path';
import { createTwoFilesPatch } from 'diff';
import type { FileInfo, FileEdit } from './types.js';

export async function getFileStats(filePath: string): Promise<FileInfo> {
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

export async function readFileContent(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

export async function writeFileContent(filePath: string, content: string): Promise<void> {
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

export async function readMediaFile(filePath: string): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath);
    let isCleanedUp = false;

    const cleanup = () => {
      if (!isCleanedUp) {
        isCleanedUp = true;
        if (!stream.destroyed) {
          stream.destroy();
        }
      }
    };

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
      cleanup();
      resolve({ data: base64, mimeType });
    });

    stream.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

export async function tailFile(filePath: string, lines: number): Promise<string> {
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

export async function headFile(filePath: string, lines: number): Promise<string> {
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

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function createUnifiedDiff(
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

export async function applyFileEdits(
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
