/**
 * @fileoverview Shell tool module.
 * Provides safe command execution with streaming output.
 */

import { spawn } from 'node:child_process';
import { tool } from 'ai';
import { z } from 'zod';

import type { DurabilityConfig, StreamWriter } from '../../types/lifecycle';
import { ToolError, ToolErrorType } from '../../types/lifecycle';
import type { ShellOutputData } from '../../streaming/data-parts';

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_TIMEOUT = 30000;
export const MAX_TIMEOUT = 300000;

const DANGEROUS_PATTERNS = [
  /rm\s+(-rf?|--recursive)?\s*[\/~]/i,
  /\b(sudo|su)\b/i,
  /\b(shutdown|reboot|halt|poweroff)\b/i,
];

const INTERACTIVE_COMMANDS = ['vim', 'nvim', 'nano', 'htop', 'top', 'less', 'more', 'ssh'];

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  killed: boolean;
  durationMs: number;
  error?: string;
}

export interface ShellToolOptions {
  workspaceRoot: string;
  writer?: StreamWriter;
  enableStreaming?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

export const shellDurability: DurabilityConfig = {
  enabled: true,
  independent: false,
  retryCount: 1,
  timeout: '5m',
};

function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some(p => p.test(command));
}

function isInteractiveCommand(command: string): boolean {
  const firstWord = command.trim().split(/\s+/)[0];
  return INTERACTIVE_COMMANDS.includes(firstWord || '');
}

async function executeCommand(
  command: string,
  options: { cwd: string; timeout: number }
): Promise<ShellResult> {
  const startTime = performance.now();
  return new Promise(resolve => {
    let stdout = '', stderr = '', killed = false;
    const proc = spawn('bash', ['-c', command], {
      cwd: options.cwd,
      env: { ...process.env, TERM: 'dumb' },
    });
    const timer = setTimeout(() => { killed = true; proc.kill('SIGTERM'); }, options.timeout);
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      clearTimeout(timer);
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 1, killed, durationMs: performance.now() - startTime });
    });
    proc.on('error', err => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: '', exitCode: 1, killed: false, durationMs: performance.now() - startTime, error: err.message });
    });
  });
}

function success<T>(data: T): string {
  return JSON.stringify({ success: true, ...data });
}

function error(msg: string, details?: Record<string, unknown>): string {
  return JSON.stringify({ success: false, error: msg, ...details });
}

function streamShellOutput(writer: StreamWriter | undefined, data: ShellOutputData): void {
  if (writer) writer.write({ type: 'data-shell-output', data });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Factory
// ═══════════════════════════════════════════════════════════════════════════════

export function createShellTool(options: ShellToolOptions) {
  const { workspaceRoot, writer, enableStreaming = true } = options;

  return tool({
    description: 'Execute shell commands. Dangerous/interactive commands blocked.',
    inputSchema: z.object({
      command: z.string().max(10000).describe('Bash command'),
      cwd: z.string().optional().describe('Working directory'),
      timeout: z.number().min(100).max(MAX_TIMEOUT).optional(),
    }),
    execute: async ({ command, cwd, timeout = DEFAULT_TIMEOUT }) => {
      if (isDangerousCommand(command)) {
        throw new ToolError('Command blocked for safety', ToolErrorType.COMMAND_BLOCKED, { command: command.slice(0, 100) });
      }
      if (isInteractiveCommand(command)) {
        return error('Interactive command not supported');
      }

      const result = await executeCommand(command, { cwd: cwd ?? workspaceRoot, timeout });

      if (result.error) return error(result.error);
      if (result.killed) return error('Command timed out', { timeout });

      if (enableStreaming) {
        streamShellOutput(writer, {
          command: command.slice(0, 100),
          output: result.stdout + (result.stderr ? '\n' + result.stderr : ''),
          exitCode: result.exitCode,
          durationMs: Math.round(result.durationMs),
        });
      }

      return success({
        exitCode: result.exitCode,
        durationMs: Math.round(result.durationMs),
        stdoutLines: result.stdout.split('\n').length,
        status: result.exitCode === 0 ? 'success' : 'failed',
      });
    },
  });
}
