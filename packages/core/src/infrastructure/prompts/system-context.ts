import { platform, hostname, userInfo } from 'node:os';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface SystemContext {
  currentTime: string;
  currentDate: string;
  timezone: string;
  platform: string;
  hostname: string;
  username: string;
  workspaceRoot?: string;
  workspaceMap?: string;
  userProfileBlock?: string;
}

function generateWorkspaceMap(workspaceRoot: string): string {
  if (!existsSync(workspaceRoot)) return '';
  
  try {
    const entries = readdirSync(workspaceRoot);
    const topLevel = entries
      .filter(e => !e.startsWith('.'))
      .slice(0, 20)
      .map(e => {
        const fullPath = join(workspaceRoot, e);
        const isDir = statSync(fullPath).isDirectory();
        if (isDir) {
          const children = readdirSync(fullPath).filter(c => !c.startsWith('.')).slice(0, 5);
          return `${e}/: ${children.join(', ')}${children.length >= 5 ? '...' : ''}`;
        }
        return e;
      });
    return topLevel.join('\n');
  } catch {
    return '';
  }
}

export function buildSystemContext(workspaceRoot?: string, includeWorkspaceMap = false): SystemContext {
  const now = new Date();

  const context: SystemContext = {
    currentTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    currentDate: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: platform(),
    hostname: hostname(),
    username: userInfo().username,
    workspaceRoot,
  };

  if (includeWorkspaceMap && workspaceRoot) {
    context.workspaceMap = generateWorkspaceMap(workspaceRoot);
  }

  return context;
}

export function formatSystemContextBlock(context: SystemContext): string {
  const lines = [
    '# Current Environment',
    '',
    `- **Date**: ${context.currentDate}`,
    `- **Time**: ${context.currentTime} (${context.timezone})`,
    `- **Platform**: ${context.platform}`,
    `- **Hostname**: ${context.hostname}`,
    `- **User**: ${context.username}`,
  ];

  if (context.workspaceRoot) {
    lines.push(`- **Workspace**: ${context.workspaceRoot}`);
  }

  if (context.workspaceMap) {
    lines.push('');
    lines.push('## Workspace Structure');
    lines.push('```');
    lines.push(context.workspaceMap);
    lines.push('```');
  }

  if (context.userProfileBlock) {
    lines.push(context.userProfileBlock);
  }

  return lines.join('\n');
}

export function buildDynamicSystemPrompt(
  basePrompt: string,
  context: SystemContext
): string {
  const contextBlock = formatSystemContextBlock(context);
  return `${basePrompt}\n\n${contextBlock}`;
}

