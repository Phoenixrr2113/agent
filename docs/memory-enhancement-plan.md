# Memory Enhancement Plan

## Overview

Implement a two-tier memory system that combines:
1. **User Profile** - Always-on preferences injected into system prompt
2. **Knowledge Graph (Graphiti)** - On-demand retrieval for complex/temporal queries
3. **System Reminders** - Contextual hints injected into tool results

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ENHANCED MEMORY SYSTEM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  USER PROFILE (Always in System Prompt)                            │ │
│  │  ──────────────────────────────────────────────────────────────────│ │
│  │  Stable preferences and facts about the user:                      │ │
│  │  • "Prefers TypeScript over JavaScript"                            │ │
│  │  • "Uses pnpm as package manager"                                  │ │
│  │  • "Wants concise responses"                                       │ │
│  │  • "Works at Acme Corp on e-commerce platform"                     │ │
│  │                                                                    │ │
│  │  Storage: SQLite (user_profiles table)                             │ │
│  │  Updated by: Background Profile Extractor                          │ │
│  │  Token budget: ~300 tokens max                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  SYSTEM REMINDERS (Injected into Tool Results)                     │ │
│  │  ──────────────────────────────────────────────────────────────────│ │
│  │  Contextual hints based on tool + user preferences:                │ │
│  │                                                                    │ │
│  │  fs.write result → "<system-reminder>User prefers no comments      │ │
│  │                     in code unless complex logic</system-reminder>"│ │
│  │                                                                    │ │
│  │  shell result → "<system-reminder>User prefers pnpm over npm       │ │
│  │                  for package management</system-reminder>"         │ │
│  │                                                                    │ │
│  │  Storage: Derived from user profile at runtime                     │ │
│  │  Purpose: Reinforce preferences at decision points                 │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  KNOWLEDGE GRAPH (On-Demand via Memory Tool)                       │ │
│  │  ──────────────────────────────────────────────────────────────────│ │
│  │  Full entity graph for complex queries:                            │ │
│  │  • Entities with relationships                                     │ │
│  │  • Temporal facts with validity windows                            │ │
│  │  • Episode history                                                 │ │
│  │  • Multi-hop relational queries                                    │ │
│  │                                                                    │ │
│  │  Storage: Graphiti                                                 │ │
│  │  Access: Via memory tool (search, entity, related, etc.)           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  BACKGROUND PROFILE EXTRACTOR                                      │ │
│  │  ──────────────────────────────────────────────────────────────────│ │
│  │  Runs async after each conversation:                               │ │
│  │                                                                    │ │
│  │  1. Send messages to Graphiti (existing)                           │ │
│  │  2. Extract profile updates (NEW)                                  │ │
│  │     - Detect new preferences                                       │ │
│  │     - Detect contradictions with existing                          │ │
│  │     - Update/invalidate as needed                                  │ │
│  │                                                                    │ │
│  │  Model: Fast/cheap model (e.g., gemini-flash, haiku)               │ │
│  │  Trigger: After agent response, non-blocking                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
                                    ┌─────────────────┐
                                    │  User Profile   │
                                    │  (SQLite)       │
                                    └────────┬────────┘
                                             │
                                             ▼
┌──────────┐    ┌─────────────────────────────────────────────┐
│  User    │───▶│              SYSTEM PROMPT                  │
│  Message │    │  ┌─────────────────────────────────────┐    │
└──────────┘    │  │ Base prompt + Environment +         │    │
                │  │ User Profile Block                  │    │
                │  └─────────────────────────────────────┘    │
                └─────────────────────────────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │         AGENT            │
                              │   (processes request)    │
                              └──────────────────────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         ▼                   ▼                   ▼
                  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                  │  Tool Call  │     │  Tool Call  │     │  Tool Call  │
                  │  (fs.write) │     │  (shell)    │     │  (memory)   │
                  └─────────────┘     └─────────────┘     └─────────────┘
                         │                   │                   │
                         ▼                   ▼                   ▼
                  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                  │ Tool Result │     │ Tool Result │     │ Tool Result │
                  │ + Reminder  │     │ + Reminder  │     │             │
                  └─────────────┘     └─────────────┘     └─────────────┘
                         │                   │                   │
                         └───────────────────┼───────────────────┘
                                             ▼
                              ┌──────────────────────────┐
                              │        RESPONSE          │
                              └──────────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │   BACKGROUND EXTRACTION  │
                              │   (async, non-blocking)  │
                              │                          │
                              │  1. Graphiti ingestion   │
                              │  2. Profile extraction   │
                              │  3. Contradiction check  │
                              │  4. Profile update       │
                              └──────────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │  Updated User Profile    │
                              │  (available next request)│
                              └──────────────────────────┘
```

---

## Part 1: User Profile System

### 1.1 Types

**File: `packages/core/src/core/memory/profile/types.ts`**

```typescript
export interface UserProfile {
  userId: string;
  preferences: ProfilePreference[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface ProfilePreference {
  id: string;

  // The preference statement
  content: string;  // e.g., "Prefers TypeScript over JavaScript"

  // Categorization for system reminders
  category: PreferenceCategory;

  // For tool-specific reminders
  toolHints: ToolHint[];

  // Confidence and provenance
  confidence: number;  // 0.0 - 1.0
  source: string;      // Original user statement that led to this

  // Temporal tracking
  extractedAt: Date;
  validFrom: Date;
  invalidatedAt?: Date;      // When this was superseded
  supersededBy?: string;     // ID of preference that replaced this
}

export type PreferenceCategory =
  | 'coding_style'      // Code formatting, patterns, conventions
  | 'technology'        // Language, framework, tool preferences
  | 'communication'     // Response style, verbosity, tone
  | 'workflow'          // Process preferences, git, testing
  | 'domain'            // Industry, project, role info
  | 'general';          // Other preferences

export interface ToolHint {
  toolName: string;           // e.g., 'fs', 'shell', 'web'
  actions?: string[];         // e.g., ['write', 'edit'] - if empty, applies to all
  reminderTemplate: string;   // Template for system reminder
}

// For extraction
export interface ExtractedPreference {
  content: string;
  category: PreferenceCategory;
  confidence: number;
  source: string;
  toolHints: ToolHint[];
}

// For updates
export interface ProfileUpdate {
  additions: ExtractedPreference[];
  updates: Array<{ id: string; newContent: string; source: string }>;
  invalidations: Array<{ id: string; reason: string; supersededBy?: string }>;
}
```

### 1.2 Storage

**File: `packages/core/src/core/memory/profile/storage.ts`**

```typescript
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { UserProfile, ProfilePreference, ProfileUpdate } from './types.js';

export interface ProfileStorage {
  getProfile(userId: string): Promise<UserProfile | null>;
  createProfile(userId: string): Promise<UserProfile>;
  updateProfile(userId: string, update: ProfileUpdate): Promise<UserProfile>;
  getActivePreferences(userId: string): Promise<ProfilePreference[]>;
  getPreferencesByCategory(userId: string, category: string): Promise<ProfilePreference[]>;
  getPreferencesForTool(userId: string, toolName: string): Promise<ProfilePreference[]>;
}

export function createProfileStorage(dbPath: string): ProfileStorage {
  const db = new Database(dbPath);

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS profile_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      confidence REAL NOT NULL,
      source TEXT NOT NULL,
      extracted_at TEXT NOT NULL,
      valid_from TEXT NOT NULL,
      invalidated_at TEXT,
      superseded_by TEXT,
      FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
    );

    CREATE TABLE IF NOT EXISTS preference_tool_hints (
      id TEXT PRIMARY KEY,
      preference_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      actions TEXT,  -- JSON array or null for all actions
      reminder_template TEXT NOT NULL,
      FOREIGN KEY (preference_id) REFERENCES profile_preferences(id)
    );

    CREATE INDEX IF NOT EXISTS idx_preferences_user
      ON profile_preferences(user_id);
    CREATE INDEX IF NOT EXISTS idx_preferences_category
      ON profile_preferences(user_id, category);
    CREATE INDEX IF NOT EXISTS idx_preferences_active
      ON profile_preferences(user_id, invalidated_at);
    CREATE INDEX IF NOT EXISTS idx_tool_hints_tool
      ON preference_tool_hints(tool_name);
  `);

  // Prepared statements
  const getProfileStmt = db.prepare(`
    SELECT * FROM user_profiles WHERE user_id = ?
  `);

  const getPreferencesStmt = db.prepare(`
    SELECT p.*,
           json_group_array(
             json_object(
               'toolName', h.tool_name,
               'actions', h.actions,
               'reminderTemplate', h.reminder_template
             )
           ) FILTER (WHERE h.id IS NOT NULL) as tool_hints
    FROM profile_preferences p
    LEFT JOIN preference_tool_hints h ON h.preference_id = p.id
    WHERE p.user_id = ? AND p.invalidated_at IS NULL
    GROUP BY p.id
  `);

  const getPreferencesForToolStmt = db.prepare(`
    SELECT DISTINCT p.*, h.reminder_template
    FROM profile_preferences p
    JOIN preference_tool_hints h ON h.preference_id = p.id
    WHERE p.user_id = ?
      AND p.invalidated_at IS NULL
      AND h.tool_name = ?
  `);

  return {
    async getProfile(userId: string): Promise<UserProfile | null> {
      const row = getProfileStmt.get(userId) as any;
      if (!row) return null;

      const preferences = await this.getActivePreferences(userId);

      return {
        userId: row.user_id,
        preferences,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        version: row.version,
      };
    },

    async createProfile(userId: string): Promise<UserProfile> {
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO user_profiles (user_id, created_at, updated_at, version)
        VALUES (?, ?, ?, 1)
      `).run(userId, now, now);

      return {
        userId,
        preferences: [],
        createdAt: new Date(now),
        updatedAt: new Date(now),
        version: 1,
      };
    },

    async updateProfile(userId: string, update: ProfileUpdate): Promise<UserProfile> {
      const now = new Date().toISOString();

      db.transaction(() => {
        // Handle invalidations
        for (const inv of update.invalidations) {
          db.prepare(`
            UPDATE profile_preferences
            SET invalidated_at = ?, superseded_by = ?
            WHERE id = ?
          `).run(now, inv.supersededBy || null, inv.id);
        }

        // Handle updates (invalidate old + add new)
        for (const upd of update.updates) {
          // Mark old as superseded
          const newId = randomUUID();
          db.prepare(`
            UPDATE profile_preferences
            SET invalidated_at = ?, superseded_by = ?
            WHERE id = ?
          `).run(now, newId, upd.id);

          // Get old preference for copying metadata
          const old = db.prepare(`
            SELECT * FROM profile_preferences WHERE id = ?
          `).get(upd.id) as any;

          if (old) {
            db.prepare(`
              INSERT INTO profile_preferences
              (id, user_id, content, category, confidence, source, extracted_at, valid_from)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(newId, userId, upd.newContent, old.category, old.confidence, upd.source, now, now);

            // Copy tool hints
            db.prepare(`
              INSERT INTO preference_tool_hints (id, preference_id, tool_name, actions, reminder_template)
              SELECT ?, ?, tool_name, actions, reminder_template
              FROM preference_tool_hints WHERE preference_id = ?
            `).run(randomUUID(), newId, upd.id);
          }
        }

        // Handle additions
        for (const add of update.additions) {
          const prefId = randomUUID();

          db.prepare(`
            INSERT INTO profile_preferences
            (id, user_id, content, category, confidence, source, extracted_at, valid_from)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(prefId, userId, add.content, add.category, add.confidence, add.source, now, now);

          for (const hint of add.toolHints) {
            db.prepare(`
              INSERT INTO preference_tool_hints (id, preference_id, tool_name, actions, reminder_template)
              VALUES (?, ?, ?, ?, ?)
            `).run(randomUUID(), prefId, hint.toolName, JSON.stringify(hint.actions), hint.reminderTemplate);
          }
        }

        // Update profile version
        db.prepare(`
          UPDATE user_profiles
          SET updated_at = ?, version = version + 1
          WHERE user_id = ?
        `).run(now, userId);
      })();

      return this.getProfile(userId) as Promise<UserProfile>;
    },

    async getActivePreferences(userId: string): Promise<ProfilePreference[]> {
      const rows = getPreferencesStmt.all(userId) as any[];

      return rows.map(row => ({
        id: row.id,
        content: row.content,
        category: row.category,
        confidence: row.confidence,
        source: row.source,
        extractedAt: new Date(row.extracted_at),
        validFrom: new Date(row.valid_from),
        invalidatedAt: row.invalidated_at ? new Date(row.invalidated_at) : undefined,
        supersededBy: row.superseded_by || undefined,
        toolHints: row.tool_hints ? JSON.parse(row.tool_hints).filter((h: any) => h.toolName) : [],
      }));
    },

    async getPreferencesByCategory(userId: string, category: string): Promise<ProfilePreference[]> {
      const all = await this.getActivePreferences(userId);
      return all.filter(p => p.category === category);
    },

    async getPreferencesForTool(userId: string, toolName: string): Promise<ProfilePreference[]> {
      const rows = getPreferencesForToolStmt.all(userId, toolName) as any[];

      return rows.map(row => ({
        id: row.id,
        content: row.content,
        category: row.category,
        confidence: row.confidence,
        source: row.source,
        extractedAt: new Date(row.extracted_at),
        validFrom: new Date(row.valid_from),
        toolHints: [{ toolName, reminderTemplate: row.reminder_template, actions: [] }],
      }));
    },
  };
}
```

### 1.3 Profile Manager

**File: `packages/core/src/core/memory/profile/manager.ts`**

```typescript
import { logger } from '@agent/shared';
import type { UserProfile, ProfilePreference } from './types.js';
import type { ProfileStorage } from './storage.js';

const MAX_PREFERENCES = 20;  // Limit to control token usage
const MAX_PROFILE_TOKENS = 300;  // Approximate token budget

export interface ProfileManager {
  getProfile(userId: string): Promise<UserProfile | null>;
  getOrCreateProfile(userId: string): Promise<UserProfile>;
  formatForSystemPrompt(userId: string): Promise<string>;
  getRemindersForTool(userId: string, toolName: string, action?: string): Promise<string[]>;
}

export function createProfileManager(storage: ProfileStorage): ProfileManager {
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

      // Sort by confidence and take top preferences
      const topPreferences = [...profile.preferences]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, MAX_PREFERENCES);

      // Group by category for readability
      const byCategory = new Map<string, ProfilePreference[]>();
      for (const pref of topPreferences) {
        const list = byCategory.get(pref.category) || [];
        list.push(pref);
        byCategory.set(pref.category, list);
      }

      const lines: string[] = [
        '',
        '# User Preferences',
        '',
      ];

      const categoryLabels: Record<string, string> = {
        coding_style: 'Coding Style',
        technology: 'Technology Preferences',
        communication: 'Communication',
        workflow: 'Workflow',
        domain: 'Background',
        general: 'Other',
      };

      for (const [category, prefs] of byCategory) {
        const label = categoryLabels[category] || category;
        lines.push(`## ${label}`);
        for (const pref of prefs) {
          lines.push(`- ${pref.content}`);
        }
        lines.push('');
      }

      const result = lines.join('\n');

      // Rough token estimate (1 token ≈ 4 chars)
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
      const preferences = await storage.getPreferencesForTool(userId, toolName);

      const reminders: string[] = [];
      for (const pref of preferences) {
        for (const hint of pref.toolHints) {
          // Check if action matches (or hint applies to all actions)
          if (!hint.actions || hint.actions.length === 0 ||
              (action && hint.actions.includes(action))) {
            reminders.push(hint.reminderTemplate);
          }
        }
      }

      return reminders;
    },
  };
}
```

---

## Part 2: Background Profile Extractor

### 2.1 Extractor

**File: `packages/core/src/core/memory/profile/extractor.ts`**

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';
import { logger } from '@agent/shared';
import { models } from '../../agents/models.js';
import type { ModelMessage } from 'ai';
import type { ProfileStorage } from './storage.js';
import type { ExtractedPreference, ProfileUpdate, PreferenceCategory } from './types.js';

const extractionSchema = z.object({
  preferences: z.array(z.object({
    content: z.string().describe('The preference as a clear statement'),
    category: z.enum([
      'coding_style',
      'technology',
      'communication',
      'workflow',
      'domain',
      'general'
    ]),
    confidence: z.number().min(0).max(1).describe('How confident this is a real preference'),
    source: z.string().describe('The user statement this was derived from'),
    toolHints: z.array(z.object({
      toolName: z.string().describe('Tool this applies to: fs, shell, web, memory, delegate'),
      actions: z.array(z.string()).optional().describe('Specific actions, or empty for all'),
      reminderTemplate: z.string().describe('Short reminder to show in tool results'),
    })).default([]),
  })),
});

const contradictionSchema = z.object({
  contradictions: z.array(z.object({
    existingId: z.string(),
    newPreference: z.string(),
    action: z.enum(['update', 'invalidate', 'keep_both']),
    reason: z.string(),
  })),
});

export interface ProfileExtractor {
  extractFromConversation(
    messages: ModelMessage[],
    userId: string,
    existingPreferences: ExtractedPreference[]
  ): Promise<ProfileUpdate>;
}

export function createProfileExtractor(storage: ProfileStorage): ProfileExtractor {

  async function extractPreferences(messages: ModelMessage[]): Promise<ExtractedPreference[]> {
    // Only look at recent messages (last N turns)
    const recentMessages = messages.slice(-20);

    // Filter to user/assistant only
    const relevantMessages = recentMessages.filter(
      m => m.role === 'user' || m.role === 'assistant'
    );

    if (relevantMessages.length === 0) {
      return [];
    }

    const conversationText = relevantMessages.map(m => {
      const content = typeof m.content === 'string'
        ? m.content
        : JSON.stringify(m.content);
      return `[${m.role}]: ${content}`;
    }).join('\n\n');

    try {
      const result = await generateObject({
        model: models.fast(),  // Use cheap/fast model
        schema: extractionSchema,
        prompt: `Analyze this conversation and extract user preferences.

IMPORTANT: Only extract CLEAR, EXPLICIT preferences. Do not infer or guess.

Categories:
- coding_style: Code formatting, patterns, naming conventions, comments
- technology: Languages, frameworks, tools, libraries they prefer
- communication: How they want responses (concise, detailed, etc.)
- workflow: Git practices, testing, deployment preferences
- domain: Their role, company, industry, project info
- general: Other clear preferences

For each preference, if it's relevant to a specific tool, add a toolHint:
- fs: File operations (read, write, edit, list, etc.)
- shell: Command execution
- web: Search and fetch
- memory: Knowledge retrieval
- delegate: Task delegation

Example good extractions:
- "I prefer TypeScript" → technology, toolHints: [{toolName: 'fs', actions: ['write'], reminderTemplate: 'User prefers TypeScript'}]
- "Keep responses short" → communication, no toolHints needed (applies to all)
- "Always use pnpm" → workflow, toolHints: [{toolName: 'shell', reminderTemplate: 'Use pnpm, not npm'}]

Example bad extractions (DO NOT DO):
- Vague preferences without evidence
- Inferences from what they're working on
- Temporary context about current task

Conversation:
${conversationText}`,
      });

      return result.object.preferences;
    } catch (error) {
      logger.error('Profile extraction failed', { error: String(error) });
      return [];
    }
  }

  async function detectContradictions(
    existing: ExtractedPreference[],
    newPrefs: ExtractedPreference[]
  ): Promise<ProfileUpdate> {
    if (existing.length === 0 || newPrefs.length === 0) {
      return {
        additions: newPrefs,
        updates: [],
        invalidations: [],
      };
    }

    const existingText = existing.map((p, i) =>
      `[${i}] ${p.content}`
    ).join('\n');

    const newText = newPrefs.map(p => p.content).join('\n');

    try {
      const result = await generateObject({
        model: models.fast(),
        schema: contradictionSchema,
        prompt: `Compare these existing preferences with new ones and identify contradictions.

EXISTING PREFERENCES:
${existingText}

NEW PREFERENCES:
${newText}

For each contradiction, decide:
- update: New preference updates/refines the existing one
- invalidate: New preference completely replaces the existing one
- keep_both: They're different aspects, not contradictory

Only report actual contradictions. Similar but non-conflicting preferences should be kept.`,
      });

      const update: ProfileUpdate = {
        additions: [],
        updates: [],
        invalidations: [],
      };

      const handledNewPrefs = new Set<number>();

      for (const contradiction of result.object.contradictions) {
        const existingIdx = parseInt(contradiction.existingId);
        const existingPref = existing[existingIdx];

        if (!existingPref) continue;

        const matchingNew = newPrefs.find(p =>
          p.content.toLowerCase().includes(contradiction.newPreference.toLowerCase().slice(0, 20))
        );

        if (matchingNew) {
          const newIdx = newPrefs.indexOf(matchingNew);
          handledNewPrefs.add(newIdx);

          if (contradiction.action === 'update' || contradiction.action === 'invalidate') {
            update.updates.push({
              id: (existingPref as any).id,  // Will have ID from storage
              newContent: matchingNew.content,
              source: matchingNew.source,
            });
          }
        }
      }

      // Add non-contradicting new preferences
      newPrefs.forEach((pref, idx) => {
        if (!handledNewPrefs.has(idx)) {
          update.additions.push(pref);
        }
      });

      return update;
    } catch (error) {
      logger.error('Contradiction detection failed', { error: String(error) });
      // On failure, just add all new preferences
      return {
        additions: newPrefs,
        updates: [],
        invalidations: [],
      };
    }
  }

  return {
    async extractFromConversation(
      messages: ModelMessage[],
      userId: string,
      existingPreferences: ExtractedPreference[]
    ): Promise<ProfileUpdate> {
      // Step 1: Extract preferences from conversation
      const newPrefs = await extractPreferences(messages);

      if (newPrefs.length === 0) {
        return { additions: [], updates: [], invalidations: [] };
      }

      logger.info('Extracted preferences from conversation', {
        userId,
        count: newPrefs.length,
      });

      // Step 2: Check for contradictions with existing
      const update = await detectContradictions(existingPreferences, newPrefs);

      logger.info('Profile update prepared', {
        userId,
        additions: update.additions.length,
        updates: update.updates.length,
        invalidations: update.invalidations.length,
      });

      return update;
    },
  };
}
```

### 2.2 Integration with Memory Extractor

**File: `packages/core/src/core/memory/extractor-unified.ts`**

```typescript
import { logger } from '@agent/shared';
import type { ModelMessage } from 'ai';
import { createGraphitiMemory } from './extractor-simple.js';
import { createProfileExtractor } from './profile/extractor.js';
import { createProfileStorage } from './profile/storage.js';
import type { ProfileStorage } from './profile/storage.js';

export interface UnifiedMemoryExtractor {
  extractFromConversation(messages: ModelMessage[], userId?: string): Promise<void>;
  waitForPending(): Promise<void>;
  getProfileStorage(): ProfileStorage;
}

export function createUnifiedMemoryExtractor(
  dbPath: string = './memory.db',
  graphitiGroupId: string = 'default'
): UnifiedMemoryExtractor {
  const graphiti = createGraphitiMemory();
  const profileStorage = createProfileStorage(dbPath);
  const profileExtractor = createProfileExtractor(profileStorage);

  let pendingExtractions: Promise<void>[] = [];
  let lastProcessedIndex = -1;

  return {
    async extractFromConversation(messages: ModelMessage[], userId?: string): Promise<void> {
      // Only process new messages
      const newMessages = messages.slice(lastProcessedIndex + 1);
      if (newMessages.length === 0) return;

      const extraction = (async () => {
        try {
          // 1. Send to Graphiti (existing behavior)
          await graphiti.addMessages(messages, graphitiGroupId);

          // 2. Extract and update user profile (if userId provided)
          if (userId) {
            const profile = await profileStorage.getProfile(userId);
            const existingPrefs = profile?.preferences.map(p => ({
              content: p.content,
              category: p.category,
              confidence: p.confidence,
              source: p.source,
              toolHints: p.toolHints,
            })) || [];

            const update = await profileExtractor.extractFromConversation(
              newMessages,
              userId,
              existingPrefs
            );

            if (update.additions.length > 0 || update.updates.length > 0 || update.invalidations.length > 0) {
              await profileStorage.updateProfile(userId, update);
              logger.info('User profile updated', { userId });
            }
          }

          lastProcessedIndex = messages.length - 1;
        } catch (error) {
          logger.error('Unified memory extraction failed', { error: String(error) });
        }
      })();

      pendingExtractions.push(extraction);

      // Clean up completed extractions
      extraction.finally(() => {
        pendingExtractions = pendingExtractions.filter(p => p !== extraction);
      });
    },

    async waitForPending(): Promise<void> {
      await Promise.all(pendingExtractions);
    },

    getProfileStorage(): ProfileStorage {
      return profileStorage;
    },
  };
}
```

---

## Part 3: System Prompt Integration

### 3.1 Updated System Context Builder

**File: `packages/core/src/infrastructure/prompts/system-context.ts`** (modifications)

```typescript
import type { ProfileManager } from '../../core/memory/profile/manager.js';

export interface SystemContext {
  currentTime: string;
  currentDate: string;
  timezone: string;
  platform: string;
  hostname: string;
  username: string;
  workspaceRoot?: string;
  workspaceMap?: string;
  userProfile?: string;  // NEW
}

export async function buildSystemContextWithProfile(
  workspaceRoot?: string,
  includeWorkspaceMap = false,
  profileManager?: ProfileManager,
  userId?: string
): Promise<SystemContext> {
  const context = buildSystemContext(workspaceRoot, includeWorkspaceMap);

  // Add user profile if available
  if (profileManager && userId) {
    context.userProfile = await profileManager.formatForSystemPrompt(userId);
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

  // NEW: Add user profile section
  if (context.userProfile) {
    lines.push(context.userProfile);
  }

  return lines.join('\n');
}
```

---

## Part 4: System Reminders in Tool Results

### 4.1 Reminder Injector

**File: `packages/core/src/core/memory/profile/reminders.ts`**

```typescript
import type { ProfileManager } from './manager.js';

export interface ReminderInjector {
  injectReminders(
    toolName: string,
    action: string | undefined,
    result: unknown
  ): Promise<unknown>;
}

export function createReminderInjector(
  profileManager: ProfileManager,
  userId: string
): ReminderInjector {
  return {
    async injectReminders(
      toolName: string,
      action: string | undefined,
      result: unknown
    ): Promise<unknown> {
      const reminders = await profileManager.getRemindersForTool(userId, toolName, action);

      if (reminders.length === 0) {
        return result;
      }

      // Format reminders as system-reminder block
      const reminderBlock = reminders.map(r =>
        `<system-reminder>${r}</system-reminder>`
      ).join('\n');

      // Inject into result based on type
      if (typeof result === 'string') {
        return `${result}\n\n${reminderBlock}`;
      }

      if (result && typeof result === 'object') {
        return {
          ...result,
          _systemReminders: reminderBlock,
        };
      }

      return result;
    },
  };
}
```

### 4.2 Tool Wrapper with Reminders

**File: `packages/core/src/tools/with-reminders.ts`**

```typescript
import type { ReminderInjector } from '../core/memory/profile/reminders.js';

export interface ToolDefinition {
  description: string;
  parameters: any;
  execute: (args: any) => Promise<any>;
}

export function wrapToolWithReminders(
  tool: ToolDefinition,
  toolName: string,
  reminderInjector: ReminderInjector
): ToolDefinition {
  return {
    ...tool,
    execute: async (args: any) => {
      const result = await tool.execute(args);

      // Determine action from args (tools use 'action' parameter)
      const action = args.action as string | undefined;

      // Inject reminders into result
      return reminderInjector.injectReminders(toolName, action, result);
    },
  };
}

export function wrapAllToolsWithReminders(
  tools: Record<string, ToolDefinition>,
  reminderInjector: ReminderInjector
): Record<string, ToolDefinition> {
  const wrapped: Record<string, ToolDefinition> = {};

  for (const [name, tool] of Object.entries(tools)) {
    // Skip tools that shouldn't have reminders
    if (name === 'memory' || name === 'task_complete' || name === 'ask_user') {
      wrapped[name] = tool;
    } else {
      wrapped[name] = wrapToolWithReminders(tool, name, reminderInjector);
    }
  }

  return wrapped;
}
```

### 4.3 Example Tool Result with Reminder

```
// User preference: "Use pnpm, not npm"
// Tool: shell
// Action: execute command "npm install lodash"

TOOL RESULT:
added 1 package in 2.1s

<system-reminder>User prefers pnpm over npm for package management</system-reminder>
```

```
// User preference: "No comments in code unless complex"
// Tool: fs
// Action: write

TOOL RESULT:
File written successfully: src/utils/helper.ts (45 lines)

<system-reminder>User prefers no comments in code unless the logic is complex</system-reminder>
```

---

## Part 5: Runtime Integration

### 5.1 Updated Agent Runtime

**File: `packages/core/src/runtime/agent-runtime.ts`** (key modifications)

```typescript
import { createUnifiedMemoryExtractor } from '../core/memory/extractor-unified.js';
import { createProfileManager } from '../core/memory/profile/manager.js';
import { createReminderInjector } from '../core/memory/profile/reminders.js';
import { wrapAllToolsWithReminders } from '../tools/with-reminders.js';
import { buildSystemContextWithProfile } from '../infrastructure/prompts/system-context.js';

export interface AgentConfig {
  workspaceRoot?: string;
  askUserHandler?: AskUserHandler;
  maxSteps?: number;
  disableAgentSpawning?: boolean;
  disableAskUser?: boolean;
  role?: AgentRole;
  isSpawnedAgent?: boolean;
  userId?: string;  // NEW: For profile-based memory
}

export async function createAgentRuntime(config: AgentConfig = {}): Promise<AgentRuntime> {
  // ... existing initialization ...

  // NEW: Set up profile-based memory
  const memoryExtractor = createUnifiedMemoryExtractor(
    process.env['MEMORY_DB_PATH'] || './memory.db'
  );

  const profileStorage = memoryExtractor.getProfileStorage();
  const profileManager = createProfileManager(profileStorage);

  // NEW: If userId provided, set up reminder injection
  let wrappedTools = tools;
  if (config.userId) {
    const reminderInjector = createReminderInjector(profileManager, config.userId);
    wrappedTools = wrapAllToolsWithReminders(tools, reminderInjector);
  }

  // ... rest of initialization using wrappedTools ...

  const createSession = (): AgentSession => {
    // ... existing session setup ...

    const runTask = async (input: TaskInput): Promise<TaskResult> => {
      // ... existing code ...

      // NEW: Build system context with user profile
      const context = await buildSystemContextWithProfile(
        config.workspaceRoot,
        config.role === 'coder',
        profileManager,
        config.userId
      );

      // Use context in agent creation...

      // ... rest of runTask ...

      // NEW: Include userId in extraction
      Promise.resolve()
        .then(() => memoryExtractor.extractFromConversation(
          conversationHistory,
          config.userId  // Pass userId for profile updates
        ))
        .catch(error => {
          logger.error('Background memory extraction failed', { error: String(error) });
        });

      // ... rest of method ...
    };

    // ... rest of session ...
  };

  // ... rest of runtime ...
}
```

---

## Part 6: File Structure Summary

```
packages/core/src/core/memory/
├── profile/
│   ├── types.ts              # UserProfile, ProfilePreference, etc.
│   ├── storage.ts            # SQLite storage for profiles
│   ├── manager.ts            # ProfileManager for CRUD + formatting
│   ├── extractor.ts          # Background profile extraction
│   ├── reminders.ts          # ReminderInjector for tool results
│   └── index.ts              # Exports
├── extractor-unified.ts      # Unified extractor (Graphiti + Profile)
├── extractor-simple.ts       # (existing) Graphiti-only extractor
├── ... (existing files)

packages/core/src/tools/
├── with-reminders.ts         # Tool wrapper for reminder injection
├── ... (existing files)

packages/core/src/infrastructure/prompts/
├── system-context.ts         # (modified) Add profile to context
├── ... (existing files)

packages/core/src/runtime/
├── agent-runtime.ts          # (modified) Integration point
```

---

## Part 7: Database Schema

```sql
-- User profiles table
CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- Preferences with full history
CREATE TABLE profile_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,  -- coding_style, technology, communication, etc.
  confidence REAL NOT NULL,
  source TEXT NOT NULL,     -- Original user statement
  extracted_at TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  invalidated_at TEXT,      -- When superseded (NULL if active)
  superseded_by TEXT,       -- ID of replacement preference
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
);

-- Tool-specific reminder templates
CREATE TABLE preference_tool_hints (
  id TEXT PRIMARY KEY,
  preference_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  actions TEXT,             -- JSON array of specific actions, NULL for all
  reminder_template TEXT NOT NULL,
  FOREIGN KEY (preference_id) REFERENCES profile_preferences(id)
);

-- Indexes for efficient queries
CREATE INDEX idx_preferences_user ON profile_preferences(user_id);
CREATE INDEX idx_preferences_active ON profile_preferences(user_id, invalidated_at);
CREATE INDEX idx_tool_hints_tool ON preference_tool_hints(tool_name);
```

---

## Part 8: Example Flows

### 8.1 First Conversation - Preference Extraction

```
User: "I always use TypeScript and pnpm. Keep your responses concise."

Agent: [responds to user's actual request]

--- BACKGROUND (async) ---

ProfileExtractor:
  Input: conversation messages
  Output:
    - content: "Prefers TypeScript over JavaScript"
      category: technology
      confidence: 0.95
      source: "I always use TypeScript"
      toolHints:
        - toolName: fs
          actions: [write, edit]
          reminderTemplate: "User prefers TypeScript"

    - content: "Uses pnpm for package management"
      category: workflow
      confidence: 0.95
      source: "I always use pnpm"
      toolHints:
        - toolName: shell
          reminderTemplate: "Use pnpm, not npm"

    - content: "Prefers concise responses"
      category: communication
      confidence: 0.90
      source: "Keep your responses concise"
      toolHints: []

Storage: INSERT all three preferences
```

### 8.2 Next Conversation - Profile in Context

```
SYSTEM PROMPT:
You are an autonomous agent...

# Current Environment
- Date: Saturday, December 21, 2024
- Platform: linux
- Workspace: /home/user/project

# User Preferences

## Technology Preferences
- Prefers TypeScript over JavaScript

## Workflow
- Uses pnpm for package management

## Communication
- Prefers concise responses

---

User: "Add lodash to my project"

Agent: [knows to use pnpm without asking]
```

### 8.3 Tool Result with Reminder

```
Agent calls: shell({ command: "pnpm add lodash" })

TOOL RESULT:
Packages: +1
Progress: resolved 1, reused 0, downloaded 1, added 1, done

<system-reminder>Use pnpm, not npm</system-reminder>
```

### 8.4 Preference Contradiction

```
Existing preference: "Prefers TypeScript over JavaScript"

User: "Actually I've switched to using Rust for most things now"

--- BACKGROUND ---

ProfileExtractor:
  New preference: "Prefers Rust for most projects"

ContradictionDetector:
  - Existing: "Prefers TypeScript over JavaScript"
  - New: "Prefers Rust for most projects"
  - Action: keep_both (Rust is new preference, TypeScript still valid for JS contexts)

Result: Both preferences kept, new one added
```

---

## Part 9: Implementation Order

1. **Phase 1: Storage Layer**
   - [ ] Create `profile/types.ts`
   - [ ] Create `profile/storage.ts` with SQLite schema
   - [ ] Create `profile/manager.ts`
   - [ ] Write unit tests

2. **Phase 2: Extraction**
   - [ ] Create `profile/extractor.ts`
   - [ ] Create `extractor-unified.ts`
   - [ ] Write unit tests for extraction

3. **Phase 3: System Prompt Integration**
   - [ ] Modify `system-context.ts` to include profile
   - [ ] Update agent factory to use new context builder
   - [ ] Test profile appears in prompts

4. **Phase 4: System Reminders**
   - [ ] Create `profile/reminders.ts`
   - [ ] Create `tools/with-reminders.ts`
   - [ ] Integrate into runtime
   - [ ] Test reminders appear in tool results

5. **Phase 5: Runtime Integration**
   - [ ] Update `agent-runtime.ts` to use unified extractor
   - [ ] Add `userId` to config
   - [ ] Wire up all components
   - [ ] End-to-end testing

6. **Phase 6: Testing & Refinement**
   - [ ] Test preference extraction accuracy
   - [ ] Test contradiction detection
   - [ ] Test token budget stays within limits
   - [ ] Performance testing (latency impact)
