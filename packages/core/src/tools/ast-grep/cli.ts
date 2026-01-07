import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

import {
  getSgCliPath,
  setSgCliPath,
  findSgCliPathSync,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_MAX_MATCHES,
} from './constants.js';
import { ensureAstGrepBinary } from './downloader.js';
import type { CliMatch, SgResult, CliLanguage } from './types.js';

export interface RunOptions {
  pattern: string;
  lang: CliLanguage;
  paths?: string[];
  globs?: string[];
  rewrite?: string;
  context?: number;
  updateAll?: boolean;
}

let resolvedCliPath: string | null = null;
let initPromise: Promise<string | null> | null = null;

export async function getAstGrepPath(): Promise<string | null> {
  if (resolvedCliPath !== null && existsSync(resolvedCliPath)) {
    return resolvedCliPath;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const syncPath = findSgCliPathSync();
    if (syncPath && existsSync(syncPath)) {
      resolvedCliPath = syncPath;
      setSgCliPath(syncPath);
      return syncPath;
    }

    const downloadedPath = await ensureAstGrepBinary();
    if (downloadedPath) {
      resolvedCliPath = downloadedPath;
      setSgCliPath(downloadedPath);
      return downloadedPath;
    }

    return null;
  })();

  return initPromise;
}

export function startBackgroundInit(): void {
  if (!initPromise) {
    initPromise = getAstGrepPath();
    initPromise.catch(() => {});
  }
}

export async function runSg(options: RunOptions): Promise<SgResult> {
  const args = ['run', '-p', options.pattern, '--lang', options.lang, '--json=compact'];

  if (options.rewrite) {
    args.push('-r', options.rewrite);
    if (options.updateAll) {
      args.push('--update-all');
    }
  }

  if (options.context && options.context > 0) {
    args.push('-C', String(options.context));
  }

  if (options.globs) {
    for (const glob of options.globs) {
      args.push('--globs', glob);
    }
  }

  const paths = options.paths && options.paths.length > 0 ? options.paths : ['.'];
  args.push(...paths);

  let cliPath = getSgCliPath();

  if (!existsSync(cliPath) && cliPath !== 'sg') {
    const downloadedPath = await getAstGrepPath();
    if (downloadedPath) {
      cliPath = downloadedPath;
    }
  }

  const timeout = DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    const proc = spawn(cliPath, args, {
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

    proc.on('close', (code) => {
      clearTimeout(timeoutId);

      if (killed) {
        resolve({
          matches: [],
          totalMatches: 0,
          truncated: true,
          truncatedReason: 'timeout',
          error: `Search timeout after ${timeout}ms`,
        });
        return;
      }

      if (code !== 0 && stdout.trim() === '') {
        if (stderr.includes('No files found')) {
          resolve({ matches: [], totalMatches: 0, truncated: false });
          return;
        }
        if (stderr.trim()) {
          resolve({ matches: [], totalMatches: 0, truncated: false, error: stderr.trim() });
          return;
        }
        resolve({ matches: [], totalMatches: 0, truncated: false });
        return;
      }

      if (!stdout.trim()) {
        resolve({ matches: [], totalMatches: 0, truncated: false });
        return;
      }

      const outputTruncated = stdout.length >= DEFAULT_MAX_OUTPUT_BYTES;
      const outputToProcess = outputTruncated ? stdout.substring(0, DEFAULT_MAX_OUTPUT_BYTES) : stdout;

      let matches: CliMatch[] = [];
      try {
        matches = JSON.parse(outputToProcess) as CliMatch[];
      } catch {
        if (outputTruncated) {
          try {
            const lastValidIndex = outputToProcess.lastIndexOf('}');
            if (lastValidIndex > 0) {
              const bracketIndex = outputToProcess.lastIndexOf('},', lastValidIndex);
              if (bracketIndex > 0) {
                const truncatedJson = outputToProcess.substring(0, bracketIndex + 1) + ']';
                matches = JSON.parse(truncatedJson) as CliMatch[];
              }
            }
          } catch {
            resolve({
              matches: [],
              totalMatches: 0,
              truncated: true,
              truncatedReason: 'max_output_bytes',
              error: 'Output too large and could not be parsed',
            });
            return;
          }
        } else {
          resolve({ matches: [], totalMatches: 0, truncated: false });
          return;
        }
      }

      const totalMatches = matches.length;
      const matchesTruncated = totalMatches > DEFAULT_MAX_MATCHES;
      const finalMatches = matchesTruncated ? matches.slice(0, DEFAULT_MAX_MATCHES) : matches;

      resolve({
        matches: finalMatches,
        totalMatches,
        truncated: outputTruncated || matchesTruncated,
        truncatedReason: outputTruncated ? 'max_output_bytes' : matchesTruncated ? 'max_matches' : undefined,
      });
    });

    proc.on('error', async (err) => {
      clearTimeout(timeoutId);

      const nodeError = err as NodeJS.ErrnoException;
      if (
        nodeError.code === 'ENOENT' ||
        nodeError.message?.includes('ENOENT') ||
        nodeError.message?.includes('not found')
      ) {
        const downloadedPath = await ensureAstGrepBinary();
        if (downloadedPath) {
          resolvedCliPath = downloadedPath;
          setSgCliPath(downloadedPath);
          resolve(await runSg(options));
          return;
        } else {
          resolve({
            matches: [],
            totalMatches: 0,
            truncated: false,
            error:
              `ast-grep CLI binary not found.\n\n` +
              `Auto-download failed. Manual install options:\n` +
              `  npm add -D @ast-grep/cli\n` +
              `  cargo install ast-grep --locked\n` +
              `  brew install ast-grep`,
          });
          return;
        }
      }

      resolve({
        matches: [],
        totalMatches: 0,
        truncated: false,
        error: `Failed to spawn ast-grep: ${err.message}`,
      });
    });
  });
}

export function isCliAvailable(): boolean {
  const path = findSgCliPathSync();
  return path !== null && existsSync(path);
}

export async function ensureCliAvailable(): Promise<boolean> {
  const path = await getAstGrepPath();
  return path !== null && existsSync(path);
}
