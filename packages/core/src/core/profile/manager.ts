import { logger } from '@agent/shared';

import type {
  ProfileManager,
  ProfileStorageAdapter,
  UserProfile,
  ProfilePreference,
  PreferenceCategory,
} from './types.js';

const MAX_PREFERENCES = 20;
const MAX_PROFILE_TOKENS = 300;

const CATEGORY_LABELS: Record<PreferenceCategory, string> = {
  coding_style: 'Coding Style',
  technology: 'Technology',
  communication: 'Communication',
  workflow: 'Workflow',
  domain: 'Background',
  general: 'General',
};

const CATEGORY_ORDER: PreferenceCategory[] = [
  'technology',
  'coding_style',
  'workflow',
  'communication',
  'domain',
  'general',
];

export function createProfileManager(storage: ProfileStorageAdapter): ProfileManager {
  return {
    async getProfile(userId: string): Promise<UserProfile | null> {
      return storage.getProfile(userId);
    },

    async getOrCreateProfile(userId: string): Promise<UserProfile> {
      const existing = await storage.getProfile(userId);
      if (existing) return existing;
      return storage.createProfile(userId);
    },

    async formatForSystemPrompt(userId: string): Promise<string> {
      const profile = await storage.getProfile(userId);
      if (!profile || profile.preferences.length === 0) {
        return '';
      }

      const topPreferences = [...profile.preferences]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, MAX_PREFERENCES);

      const byCategory = new Map<PreferenceCategory, ProfilePreference[]>();
      for (const pref of topPreferences) {
        const list = byCategory.get(pref.category) || [];
        list.push(pref);
        byCategory.set(pref.category, list);
      }

      const lines: string[] = ['', '# User Preferences', ''];

      for (const category of CATEGORY_ORDER) {
        const prefs = byCategory.get(category);
        if (!prefs || prefs.length === 0) continue;

        lines.push(`## ${CATEGORY_LABELS[category]}`);
        for (const pref of prefs) {
          lines.push(`- ${pref.content}`);
        }
        lines.push('');
      }

      const result = lines.join('\n');

      const estimatedTokens = Math.ceil(result.length / 4);
      if (estimatedTokens > MAX_PROFILE_TOKENS) {
        logger.warn('User profile exceeds token budget', {
          userId,
          estimatedTokens,
          maxTokens: MAX_PROFILE_TOKENS,
        });
      }

      return result;
    },

    async getRemindersForTool(
      userId: string,
      toolName: string,
      action?: string
    ): Promise<string[]> {
      const preferences = await storage.getPreferencesForTool(userId, toolName, action);

      const reminders: string[] = [];
      for (const pref of preferences) {
        for (const hint of pref.toolHints) {
          if (hint.toolName !== toolName) continue;

          if (action && hint.actions.length > 0 && !hint.actions.includes(action)) {
            continue;
          }

          if (!reminders.includes(hint.reminderTemplate)) {
            reminders.push(hint.reminderTemplate);
          }
        }
      }

      return reminders;
    },
  };
}
