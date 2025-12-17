import { tool } from 'ai';
import { z } from 'zod';

import {
  executeCommand,
  isDangerousCommand,
  type ShellResult as UtilityShellResult,
} from './utils/shell.js';
import { error, success } from './utils/tool-result.js';

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
  const result = await executeCommand(command, options);
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    killed: result.killed,
    error: result.error,
  };
}

export const shellTool = tool({
  description: `Execute bash commands. Use for: file operations (ls, cat, find, mkdir, cp, mv), git commands, grep/search, running scripts, system commands. Commands run in project directory.`,
  inputSchema: z.object({
    command: z.string().describe('Bash command to execute'),
    cwd: z.string().optional().describe('Working directory (default: project root)'),
    timeout: z.number().optional().describe('Timeout in ms (default: 30000)'),
  }),
  execute: async ({ command, cwd, timeout }: { command: string; cwd?: string; timeout?: number }) => {
    if (isDangerousCommand(command)) {
      return error('Command blocked for safety', {
        command,
        suggestion: 'This command pattern is potentially destructive. Please be more specific.',
      });
    }

    const INTERACTIVE_COMMANDS = ['vi', 'vim', 'nano', 'htop', 'less', 'more', 'man', 'top', 'screen', 'tmux'];
    const cmdPart = command.split(' ')[0];
    if (cmdPart && INTERACTIVE_COMMANDS.includes(cmdPart)) {
      return error('Interactive command not allowed', {
        command,
        suggestion: `The command '${cmdPart}' requires interactive input which is not supported. Please use 'read_file' to view files or 'write_file' to edit them.`,
      });
    }

    const result = await executeCommand(command, { cwd, timeout });

    if (result.error) {
      return error(result.error, { command });
    }

    if (result.killed) {
      return error('Command timed out', {
        stdout: result.stdout.substring(0, 500),
        stderr: result.stderr.substring(0, 500),
      });
    }

    return success({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  },
});

