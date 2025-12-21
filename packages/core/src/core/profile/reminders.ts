import type { ProfileManager } from './types.js';

export interface ReminderInjector {
  injectReminders(
    toolName: string,
    action: string | undefined,
    result: string
  ): Promise<string>;
}

export function createReminderInjector(
  profileManager: ProfileManager,
  userId: string
): ReminderInjector {
  return {
    async injectReminders(
      toolName: string,
      action: string | undefined,
      result: string
    ): Promise<string> {
      const reminders = await profileManager.getRemindersForTool(userId, toolName, action);

      if (reminders.length === 0) {
        return result;
      }

      const reminderBlock = reminders
        .map(r => `<system-reminder>${r}</system-reminder>`)
        .join('\n');

      return `${result}\n\n${reminderBlock}`;
    },
  };
}
