import { z } from 'zod';
import { MAX_COMMAND_LENGTH, MAX_CWD_LENGTH, MAX_TIMEOUT } from './constants.js';

export const shellInputSchema = z.object({
  command: z.string().max(MAX_COMMAND_LENGTH).describe('Bash command to execute'),
  cwd: z.string().max(MAX_CWD_LENGTH).optional().describe('Working directory'),
  timeout: z.number().min(100).max(MAX_TIMEOUT).optional().describe('Timeout in ms (default: 30000)'),
  allow: z.boolean().optional().describe('Add to allowlist for future calls'),
  stream: z.boolean().optional().describe('Stream output (for long commands)'),
});

export type ShellInput = z.infer<typeof shellInputSchema>;

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  status: 'success' | 'failed';
  hint?: string;
}
