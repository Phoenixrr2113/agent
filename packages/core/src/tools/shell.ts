import { tool } from 'ai';
import { z } from 'zod';

import { logger } from '@agent/shared';
import { executeCommand, isDangerousCommand } from './utils/shell.js';
import { success, error } from './utils/tool-result.js';
import { ToolError, ToolErrorType } from './lifecycle.js';

const allowedCommands = new Set<string>();

const DESCRIPTION = `Execute shell commands for tasks that specialized tools cannot accomplish.
This tool runs bash commands with safety checks and optional allowlisting.

When to use this tool:
- Running build commands (npm run build, make, cargo build)
- Installing packages (npm install, pip install)
- Running scripts (./scripts/deploy.sh)
- Git operations not covered by specialized tools (git stash, git cherry-pick)
- System inspection (ls, find, df, du)
- Development servers (npm run dev, python -m http.server)

When NOT to use this tool:
- Reading/writing files → use fs tool
- Searching code → use fs tool with grep action
- Background processes that need monitoring → use delegate tool with background action
- Any task where a specialized tool exists

Safety features:
- Dangerous command patterns are blocked (rm -rf /, sudo, etc.)
- Interactive commands are rejected (vim, nano, htop)
- Commands can be allowlisted for repeated use without re-confirmation
- Timeout protection (default 30s, max 5min)

Command allowlisting:
Use allow: true on first execution to add a command pattern to the allowlist.
Subsequent calls with the same command won't require the "allow" flag.
This is useful for commands you'll run repeatedly (npm test, make build, etc.)

Parameters explained:
- command: Required. The bash command to execute.
- cwd: Working directory (default: project root).
- timeout: Timeout in milliseconds (default: 30000, max: 300000).
- allow: If true, add this command pattern to the allowlist.
- stream: If true, stream output in chunks (for long-running commands).

You should:
1. Prefer specialized tools when available
2. Use allow: true for commands you'll run repeatedly
3. Set appropriate timeout for long-running commands
4. Use stream: true for commands with continuous output
5. Check exitCode to determine success (0 = success)
6. Review stderr even on success for warnings`;

const shellInputSchema = z.object({
  command: z.string().max(10000).describe('Bash command to execute'),
  cwd: z.string().max(1000).optional().describe('Working directory'),
  timeout: z.number().min(100).max(300000).optional().describe('Timeout in ms (default: 30000)'),
  allow: z.boolean().optional().describe('Add to allowlist for future calls'),
  stream: z.boolean().optional().describe('Stream output (for long commands)'),
});

const INTERACTIVE_COMMANDS = [
  'vi', 'vim', 'nvim', 'nano', 'emacs', 'pico',
  'htop', 'top', 'less', 'more', 'man',
  'screen', 'tmux', 'ssh', 'telnet', 'ftp',
];

function isInteractiveCommand(command: string): boolean {
  const firstWord = command.trim().split(/\s+/)[0];
  return firstWord ? INTERACTIVE_COMMANDS.includes(firstWord) : false;
}

function getCommandPattern(command: string): string {
  const normalized = command.trim().replace(/\s+/g, ' ');
  const firstWord = normalized.split(' ')[0];
  return firstWord ?? normalized;
}

function isCommandAllowed(command: string): boolean {
  const pattern = getCommandPattern(command);
  return allowedCommands.has(pattern);
}

export function addToAllowlist(command: string): void {
  const pattern = getCommandPattern(command);
  allowedCommands.add(pattern);
  logger.info(`Added command to allowlist: ${pattern}`);
}

export function clearAllowlist(): void {
  allowedCommands.clear();
}

export function getAllowlist(): string[] {
  return Array.from(allowedCommands);
}

export function createShellTool(workspaceRoot: string) {
  return tool({
    description: DESCRIPTION,
    inputSchema: shellInputSchema,
    execute: async (input) => {
      const { command, cwd, timeout = 30000, allow = false, stream = false } = input;

      if (isDangerousCommand(command)) {
        throw new ToolError(
          'Command blocked for safety. This command pattern is potentially destructive.',
          ToolErrorType.COMMAND_BLOCKED,
          { command: command.slice(0, 100), patterns: 'rm -rf, sudo, shutdown, etc.' }
        );
      }

      if (isInteractiveCommand(command)) {
        const firstWord = command.trim().split(/\s+/)[0];
        return error(`Interactive command '${firstWord}' not supported`, {
          suggestion: 'Use the fs tool to read/write files, or run non-interactive alternatives.',
        });
      }

      if (allow && !isCommandAllowed(command)) {
        addToAllowlist(command);
      }

      const effectiveCwd = cwd ?? workspaceRoot;
      
      logger.info(`Executing shell command`, {
        command: command.slice(0, 100),
        cwd: effectiveCwd,
        timeout,
        allowed: isCommandAllowed(command),
      });

      const result = await executeCommand(command, {
        cwd: effectiveCwd,
        timeout,
        maxBuffer: stream ? 10 * 1024 * 1024 : 1024 * 1024,
      });

      if (result.error) {
        return error(result.error, {
          command: command.slice(0, 100),
          cwd: effectiveCwd,
        });
      }

      if (result.killed) {
        return error('Command timed out', {
          timeout,
          durationMs: result.durationMs,
          stdoutPreview: result.stdout.slice(0, 500),
          stderrPreview: result.stderr.slice(0, 500),
          hint: 'Increase timeout or use delegate with background action for long-running commands.',
        });
      }

      const output = {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: Math.round(result.durationMs),
      };

      if (result.exitCode !== 0) {
        return success({
          ...output,
          status: 'failed',
          hint: 'Non-zero exit code indicates command failure. Check stderr for details.',
        });
      }

      return success({
        ...output,
        status: 'success',
      });
    },
  });
}

export const shellTool = createShellTool(process.cwd());
