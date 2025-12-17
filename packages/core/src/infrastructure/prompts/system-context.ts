import { platform, hostname, userInfo } from 'node:os';

export interface SystemContext {
  currentTime: string;
  currentDate: string;
  timezone: string;
  platform: string;
  hostname: string;
  username: string;
  workspaceRoot?: string;
}

export function buildSystemContext(workspaceRoot?: string): SystemContext {
  const now = new Date();
  
  return {
    currentTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    currentDate: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: platform(),
    hostname: hostname(),
    username: userInfo().username,
    workspaceRoot,
  };
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

  return lines.join('\n');
}

export function buildDynamicSystemPrompt(
  basePrompt: string,
  context: SystemContext
): string {
  const contextBlock = formatSystemContextBlock(context);
  return `${basePrompt}\n\n${contextBlock}`;
}
