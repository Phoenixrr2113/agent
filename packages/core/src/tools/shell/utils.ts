import { logger } from '@agent/shared';
import { INTERACTIVE_COMMANDS } from './constants.js';

const allowedCommands = new Set<string>();

export function isInteractiveCommand(command: string): boolean {
  const firstWord = command.trim().split(/\s+/)[0];
  return firstWord ? (INTERACTIVE_COMMANDS as readonly string[]).includes(firstWord) : false;
}

export function getCommandPattern(command: string): string {
  const normalized = command.trim().replace(/\s+/g, ' ');
  const firstWord = normalized.split(' ')[0];
  return firstWord ?? normalized;
}

export function isCommandAllowed(command: string): boolean {
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
