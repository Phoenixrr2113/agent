import { tool } from 'ai';
import { z } from 'zod';
import { spawn } from 'child_process';

const DANGEROUS_PATTERNS = [
  /rm\s+(-rf?|--recursive)?\s*[\/~]/i,
  />\s*\/dev\/sd[a-z]/i,
  /mkfs\./i,
  /dd\s+if=/i,
  /:(){ :|:& };:/,
];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  killed: boolean;
  error?: string;
}

export async function executeShell(
  command: string,
  options: {
    cwd?: string;
    timeout?: number;
    maxBuffer?: number;
  } = {}
): Promise<ShellResult> {
  const { cwd = process.cwd(), timeout = 30000, maxBuffer = 1024 * 1024 } = options;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn('bash', ['-c', command], {
      cwd,
      env: { ...process.env, TERM: 'dumb' },
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length <= maxBuffer) {
        stdout += chunk;
      }
    });

    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length <= maxBuffer) {
        stderr += chunk;
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 1,
        killed,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout: '',
        stderr: '',
        exitCode: 1,
        killed: false,
        error: err.message,
      });
    });
  });
}

export const shellTool = tool({
  description: `Execute bash commands. Use for: file operations (ls, cat, find, mkdir, cp, mv), git commands, grep/search, running scripts, system commands. Commands run in project directory.`,
  inputSchema: z.object({
    command: z.string().describe('Bash command to execute'),
    cwd: z.string().optional().describe('Working directory (default: project root)'),
    timeout: z.number().optional().describe('Timeout in ms (default: 30000)'),
  }),
  execute: async ({ command, cwd, timeout }: { command: string; cwd?: string; timeout?: number }) => {
    if (isDangerous(command)) {
      return JSON.stringify({
        error: 'Command blocked for safety',
        command,
        suggestion: 'This command pattern is potentially destructive. Please be more specific.',
      });
    }

    const result = await executeShell(command, { cwd, timeout });

    if (result.error) {
      return JSON.stringify({ error: result.error, command });
    }

    if (result.killed) {
      return JSON.stringify({
        error: 'Command timed out',
        stdout: result.stdout.substring(0, 500),
        stderr: result.stderr.substring(0, 500),
      });
    }

    return JSON.stringify({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      success: result.exitCode === 0,
    });
  },
});

