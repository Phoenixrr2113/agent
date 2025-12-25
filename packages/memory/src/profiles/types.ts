export type PreferenceCategory =
  | 'coding_style'
  | 'technology'
  | 'communication'
  | 'workflow'
  | 'domain'
  | 'general';

export interface ToolHint {
  toolName: string;
  actions: string[];
  reminderTemplate: string;
}

export interface ProfilePreference {
  id: string;
  content: string;
  category: PreferenceCategory;
  confidence: number;
  source: string;
  toolHints: ToolHint[];
  extractedAt: Date;
  validFrom: Date;
  invalidatedAt: Date | null;
  supersededBy: string | null;
}

export interface UserProfile {
  userId: string;
  preferences: ProfilePreference[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface ExtractedPreference {
  content: string;
  category: PreferenceCategory;
  confidence: number;
  source: string;
  toolHints: ToolHint[];
}

export interface ProfileUpdate {
  additions: ExtractedPreference[];
  updates: Array<{
    id: string;
    newContent: string;
    source: string;
  }>;
  invalidations: Array<{
    id: string;
    reason: string;
    supersededBy?: string;
  }>;
}

export interface ProfileStorageAdapter {
  getProfile(userId: string): Promise<UserProfile | null>;
  createProfile(userId: string): Promise<UserProfile>;
  updateProfile(userId: string, update: ProfileUpdate): Promise<UserProfile>;
  getActivePreferences(userId: string): Promise<ProfilePreference[]>;
  getPreferencesByCategory(userId: string, category: PreferenceCategory): Promise<ProfilePreference[]>;
  getPreferencesForTool(userId: string, toolName: string, action?: string): Promise<ProfilePreference[]>;
  close(): Promise<void>;
}

export interface ProfileManager {
  getProfile(userId: string): Promise<UserProfile | null>;
  getOrCreateProfile(userId: string): Promise<UserProfile>;
  formatForSystemPrompt(userId: string): Promise<string>;
  getRemindersForTool(userId: string, toolName: string, action?: string): Promise<string[]>;
}

export interface ProfileExtractor {
  extractFromConversation(
    messages: Array<{ role: string; content: string | unknown }>,
    userId: string
  ): Promise<ProfileUpdate>;
}
