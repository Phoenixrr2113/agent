/**
 * Shell tool constants
 */

export const SHELL_DESCRIPTION = `Execute shell commands for tasks that specialized tools cannot accomplish.
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

export const DEFAULT_TIMEOUT = 30000;
export const MAX_TIMEOUT = 300000;
export const MAX_COMMAND_LENGTH = 10000;
export const MAX_CWD_LENGTH = 1000;

export const INTERACTIVE_COMMANDS = [
  'vi', 'vim', 'nvim', 'nano', 'emacs', 'pico',
  'htop', 'top', 'less', 'more', 'man',
  'screen', 'tmux', 'ssh', 'telnet', 'ftp',
] as const;
