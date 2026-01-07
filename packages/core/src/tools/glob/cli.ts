import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';

import {
  resolveGrepCli,
  type GrepBackend,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_LIMIT,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_OUTPUT_BYTES,
  RG_FILES_FLAGS,
} from './constants.js';
import type { GlobOptions, GlobResult, FileMatch } from './types.js';

export interface ResolvedCli {
  path: string;
  backend: GrepBackend;
}

function buildRgArgs(options: GlobOptions): string[] {
  const args: string[] = [
    ...RG_FILES_FLAGS,
    `--max-depth=${Math.min(options.maxDepth ?? DEFAULT_MAX_DEPTH, DEFAULT_MAX_DEPTH)}`,
  ];

  if (options.hidden) args.push('--hidden');
  if (options.noIgnore) args.push('--no-ignore');

  args.push(`--glob=${options.pattern}`);

  return args;
}

function buildFindArgs(options: GlobOptions): string[] {
  const args: string[] = ['.'];

  const maxDepth = Math.min(options.maxDepth ?? DEFAULT_MAX_DEPTH, DEFAULT_MAX_DEPTH);
  args.push('-maxdepth', String(maxDepth));

  args.push('-type', 'f');
  args.push('-name', options.pattern);

  if (!options.hidden) {
    args.push('-not', '-path', '*/.*');
  }

  return args;
}

function buildPowerShellCommand(options: GlobOptions): string[] {
  const maxDepth = Math.min(options.maxDepth ?? DEFAULT_MAX_DEPTH, DEFAULT_MAX_DEPTH);
  const paths = options.paths?.length ? options.paths : ['.'];
  const searchPath = paths[0] || '.';

  const escapedPath = searchPath.replace(/'/g, "''");
  const escapedPattern = options.pattern.replace(/'/g, "''");

  let psCommand = `Get-ChildItem -Path '${escapedPath}' -File -Recurse -Depth ${maxDepth - 1} -Filter '${escapedPattern}'`;

  if (options.hidden) {
    psCommand += ' -Force';
  }

  psCommand += ' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName';

  return ['powershell', '-NoProfile', '-Command', psCommand];
}

async function getFileMtime(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath);
    return stats.mtime.getTime();
  } catch {
    return 0;
  }
}

export async function runRgFiles(
  options: GlobOptions,
  resolvedCli?: ResolvedCli
): Promise<GlobResult> {
  const cli = resolvedCli ?? resolveGrepCli();
  const timeout = Math.min(options.timeout ?? DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT);

  const isRg = cli.backend === 'rg';
  const isWindows = process.platform === 'win32';

  let args: string[];
  let cwd: string | undefined;
  let command: string;

  if (isRg) {
    args = buildRgArgs(options);
    const paths = options.paths?.length ? options.paths : ['.'];
    args.push(...paths);
    command = cli.path;
    cwd = undefined;
  } else if (isWindows) {
    const psArgs = buildPowerShellCommand(options);
    command = psArgs[0]!;
    args = psArgs.slice(1);
    cwd = undefined;
  } else {
    args = buildFindArgs(options);
    const paths = options.paths?.length ? options.paths : ['.'];
    cwd = paths[0] || '.';
    command = cli.path;
  }

  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill();
    }, timeout);

    proc.stdout.on('data', (data: Buffer) => {
      if (stdout.length < DEFAULT_MAX_OUTPUT_BYTES) {
        stdout += data.toString();
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', async (code) => {
      clearTimeout(timeoutId);

      if (killed) {
        resolve({
          files: [],
          totalFiles: 0,
          truncated: false,
          error: `Glob search timeout after ${timeout}ms`,
        });
        return;
      }

      if (code !== null && code > 1 && stderr.trim()) {
        resolve({
          files: [],
          totalFiles: 0,
          truncated: false,
          error: stderr.trim(),
        });
        return;
      }

      const truncatedOutput = stdout.length >= DEFAULT_MAX_OUTPUT_BYTES;
      const outputToProcess = truncatedOutput ? stdout.substring(0, DEFAULT_MAX_OUTPUT_BYTES) : stdout;

      const lines = outputToProcess.trim().split('\n').filter(Boolean);

      const files: FileMatch[] = [];
      let truncated = false;

      for (const line of lines) {
        if (files.length >= limit) {
          truncated = true;
          break;
        }

        let filePath: string;
        if (isRg) {
          filePath = line;
        } else if (isWindows) {
          filePath = line.trim();
        } else {
          filePath = `${cwd}/${line}`;
        }

        const mtime = await getFileMtime(filePath);
        files.push({ path: filePath, mtime });
      }

      files.sort((a, b) => b.mtime - a.mtime);

      resolve({
        files,
        totalFiles: files.length,
        truncated: truncated || truncatedOutput,
      });
    });

    proc.on('error', (e) => {
      clearTimeout(timeoutId);
      resolve({
        files: [],
        totalFiles: 0,
        truncated: false,
        error: e instanceof Error ? e.message : String(e),
      });
    });
  });
}
