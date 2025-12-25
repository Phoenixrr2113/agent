import type { ProfileManager } from './types.js';

export interface ToolWithReminders {
  wrapTools(tools: Record<string, any>): Record<string, any>;
}

export function createToolReminderWrapper(
  profileManager: ProfileManager,
  userId: string
): ToolWithReminders {
  return {
    wrapTools(tools: Record<string, any>): Record<string, any> {
      const wrapped: Record<string, any> = {};

      for (const [name, tool] of Object.entries(tools)) {
        if (tool && typeof tool === 'object' && 'execute' in tool) {
          wrapped[name] = {
            ...tool,
            execute: wrapExecuteWithReminders(
              name,
              tool.execute,
              profileManager,
              userId
            ),
          };
        } else {
          wrapped[name] = tool;
        }
      }

      return wrapped;
    },
  };
}

function wrapExecuteWithReminders<TArgs, TResult>(
  toolName: string,
  execute: (args: TArgs) => Promise<TResult> | TResult,
  profileManager: ProfileManager,
  userId: string
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs): Promise<TResult> => {
    const result = await execute(args);

    if (typeof result !== 'string') {
      return result;
    }

    const action = extractAction(args);
    const reminders = await profileManager.getRemindersForTool(userId, toolName, action);

    if (reminders.length === 0) {
      return result;
    }

    const reminderBlock = reminders
      .map(r => `<system-reminder>${r}</system-reminder>`)
      .join('\n');

    return `${result}\n\n${reminderBlock}` as TResult;
  };
}

function extractAction(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') {
    return undefined;
  }

  const argsObj = args as Record<string, unknown>;

  if (typeof argsObj['action'] === 'string') {
    return argsObj['action'];
  }

  if (typeof argsObj['operation'] === 'string') {
    return argsObj['operation'];
  }

  if (typeof argsObj['command'] === 'string') {
    const cmd = argsObj['command'];
    const parts = cmd.split(/\s+/);
    return parts[0];
  }

  return undefined;
}
