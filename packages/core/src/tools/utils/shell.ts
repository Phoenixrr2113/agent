import { spawn } from 'node:child_process';

const DANGEROUS_PATTERNS = [
  /rm\s+(-rf?|--recursive)?\s*[\/~]/i,
  />\s*\/dev\/sd[a-z]/i,
  /mkfs\./i,
  /dd\s+if=/i,
  /:(){ :|:& };:/,
  /\b(sudo|su)\b/i,
  /\b(shutdown|reboot|halt|poweroff)\b/i,
  /\b(curl|wget)\b.*\|\s*(bash|sh|zsh)\b/i,
  /\beval\b/i,
  /\bchmod\s+(-R\s+)?(777|755)\b/i, // Basic check for dangerous permissions
];

export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

export interface ShellOptions {
  cwd?: string;
  timeout?: number;
  maxBuffer?: number;
  env?: Record<string, string>;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  killed: boolean;
  durationMs: number;
  error?: string;
}

export async function executeCommand(
  command: string,
  options: ShellOptions = {}
): Promise<ShellResult> {
  const {
    cwd = process.cwd(),
    timeout = 30000,
    maxBuffer = 1024 * 1024,
    env,
  } = options;

  const startTime = performance.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn('bash', ['-c', command], {
      cwd,
      env: { ...process.env, ...env, TERM: 'dumb' },
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');

      setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
        }
      }, 5000);
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

    proc.stdout.on('error', () => {
    });

    proc.stderr.on('error', () => {
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 1,
        killed,
        durationMs: performance.now() - startTime,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout: '',
        stderr: '',
        exitCode: 1,
        killed: false,
        durationMs: performance.now() - startTime,
        error: err.message,
      });
    });
  });
}

export async function executeCommandSafe(
  command: string,
  options: ShellOptions = {}
): Promise<{
  success: boolean;
  result?: ShellResult;
  error?: string;
  blocked?: boolean;
}> {
  if (isDangerousCommand(command)) {
    return {
      success: false,
      error: 'Command blocked for safety',
      blocked: true,
    };
  }

  const result = await executeCommand(command, options);

  if (result.error) {
    return {
      success: false,
      error: result.error,
      result,
    };
  }

  return {
    success: result.exitCode === 0,
    result,
  };
}
