import { logger } from '@agent/shared';
import { generateObject } from 'ai';
import { z } from 'zod';

import { models } from '../agents/models.js';

import type {
  ProfileExtractor,
  ProfileStorageAdapter,
  ProfileUpdate,
  ExtractedPreference,
  PreferenceCategory,
} from './types.js';

const PreferenceSchema = z.object({
  preferences: z.array(z.object({
    content: z.string().describe('The preference as a clear, actionable statement'),
    category: z.enum([
      'coding_style',
      'technology',
      'communication',
      'workflow',
      'domain',
      'general',
    ]).describe('Category of the preference'),
    confidence: z.number().min(0).max(1).describe('How confident this is a real, explicit preference (0-1)'),
    source: z.string().describe('The exact user statement this was derived from'),
    toolHints: z.array(z.object({
      toolName: z.string().describe('Tool name: fs, shell, web, memory, delegate, plan'),
      actions: z.array(z.string()).describe('Specific actions like write, read, edit, or empty for all'),
      reminderTemplate: z.string().describe('Short reminder to show in tool results'),
    })).describe('Tool-specific reminders for this preference'),
  })),
});

const ContradictionSchema = z.object({
  contradictions: z.array(z.object({
    existingIndex: z.number().describe('Index of the existing preference'),
    newPreferenceContent: z.string().describe('Content of the new preference that contradicts'),
    action: z.enum(['update', 'invalidate', 'keep_both']).describe('How to handle the contradiction'),
    reason: z.string().describe('Brief explanation'),
  })),
});

const EXTRACTION_PROMPT = `Extract user preferences from this conversation.

IMPORTANT RULES:
- Only extract CLEAR, EXPLICIT preferences stated by the user
- Do NOT infer or guess preferences
- Do NOT extract temporary task context
- Each preference should be a stable, reusable statement

CATEGORIES:
- coding_style: Code formatting, patterns, naming, comments (e.g., "No comments unless complex logic")
- technology: Languages, frameworks, tools, libraries (e.g., "Prefers TypeScript over JavaScript")
- communication: Response style, verbosity (e.g., "Prefers concise responses")
- workflow: Git, testing, deployment, package managers (e.g., "Uses pnpm for package management")
- domain: Role, company, industry info (e.g., "Works as backend engineer at Acme Corp")
- general: Other clear preferences

TOOL HINTS (add when preference relates to a specific tool):
- fs: File operations (read, write, edit, list, glob, grep)
- shell: Command execution
- web: Search and fetch
- memory: Knowledge retrieval
- delegate: Task delegation
- plan: Planning

EXAMPLES OF GOOD EXTRACTIONS:
- User says "I always use TypeScript" → technology preference with fs tool hint for write/edit
- User says "Keep responses short" → communication preference, no tool hints needed
- User says "Use pnpm not npm" → workflow preference with shell tool hint

EXAMPLES OF BAD EXTRACTIONS (DO NOT DO):
- Vague preferences without clear user statement
- Inferences from what they're working on
- Temporary context about current task
- Preferences the assistant stated, not the user`;

export function createProfileExtractor(storage: ProfileStorageAdapter): ProfileExtractor {
  async function extractPreferences(
    messages: Array<{ role: string; content: string | unknown }>
  ): Promise<ExtractedPreference[]> {
    const recentMessages = messages.slice(-20);

    const userMessages = recentMessages.filter(m => m.role === 'user');
    if (userMessages.length === 0) {
      return [];
    }

    const conversationText = recentMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => {
        const content = typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.content);
        return `[${m.role}]: ${content}`;
      })
      .join('\n\n');

    const startTime = performance.now();
    logger.info('⏱️  [profile-extraction] Starting preference extraction', {
      messageCount: recentMessages.length,
      userMessageCount: userMessages.length,
    });

    try {
      const { object } = await generateObject({
        model: models.fast(),
        schema: PreferenceSchema,
        prompt: `${EXTRACTION_PROMPT}\n\nConversation:\n${conversationText}`,
      });

      const duration = performance.now() - startTime;
      logger.info('⏱️  [profile-extraction] Extraction completed', {
        durationMs: duration.toFixed(2),
        durationSec: (duration / 1000).toFixed(3),
        preferencesExtracted: object.preferences.length,
      });

      return object.preferences.map(p => ({
        content: p.content,
        category: p.category as PreferenceCategory,
        confidence: p.confidence,
        source: p.source,
        toolHints: p.toolHints.map(h => ({
          toolName: h.toolName,
          actions: h.actions,
          reminderTemplate: h.reminderTemplate,
        })),
      }));
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('⏱️  [profile-extraction] Extraction failed', {
        durationMs: duration.toFixed(2),
        error: String(error),
      });
      return [];
    }
  }

  async function detectContradictions(
    existingPreferences: Array<{ id: string; content: string }>,
    newPreferences: ExtractedPreference[]
  ): Promise<ProfileUpdate> {
    if (existingPreferences.length === 0) {
      return {
        additions: newPreferences,
        updates: [],
        invalidations: [],
      };
    }

    if (newPreferences.length === 0) {
      return {
        additions: [],
        updates: [],
        invalidations: [],
      };
    }

    const startTime = performance.now();
    logger.info('⏱️  [profile-extraction] Starting contradiction detection', {
      existingCount: existingPreferences.length,
      newCount: newPreferences.length,
    });

    const existingText = existingPreferences
      .map((p, i) => `[${i}] ${p.content}`)
      .join('\n');

    const newText = newPreferences
      .map((p, i) => `[${i}] ${p.content}`)
      .join('\n');

    try {
      const { object } = await generateObject({
        model: models.fast(),
        schema: ContradictionSchema,
        prompt: `Compare existing preferences with new ones and identify contradictions.

EXISTING PREFERENCES:
${existingText}

NEW PREFERENCES:
${newText}

For each contradiction:
- update: New preference refines/updates the existing one (same topic, newer info)
- invalidate: New preference completely replaces the existing one
- keep_both: They're different aspects, not contradictory

Only report actual contradictions. Similar but non-conflicting preferences should be kept.`,
      });

      const duration = performance.now() - startTime;
      logger.info('⏱️  [profile-extraction] Contradiction detection completed', {
        durationMs: duration.toFixed(2),
        durationSec: (duration / 1000).toFixed(3),
        contradictionsFound: object.contradictions.length,
      });

      const update: ProfileUpdate = {
        additions: [],
        updates: [],
        invalidations: [],
      };

      const handledNewIndices = new Set<number>();

      for (const contradiction of object.contradictions) {
        const existingPref = existingPreferences[contradiction.existingIndex];
        if (!existingPref) continue;

        const matchingNewIndex = newPreferences.findIndex(p =>
          p.content.toLowerCase().includes(
            contradiction.newPreferenceContent.toLowerCase().slice(0, 30)
          ) ||
          contradiction.newPreferenceContent.toLowerCase().includes(
            p.content.toLowerCase().slice(0, 30)
          )
        );

        if (matchingNewIndex >= 0) {
          handledNewIndices.add(matchingNewIndex);
          const newPref = newPreferences[matchingNewIndex];

          if (newPref && (contradiction.action === 'update' || contradiction.action === 'invalidate')) {
            update.updates.push({
              id: existingPref.id,
              newContent: newPref.content,
              source: newPref.source,
            });
          }
        }
      }

      for (let i = 0; i < newPreferences.length; i++) {
        if (!handledNewIndices.has(i)) {
          const pref = newPreferences[i];
          if (pref) {
            update.additions.push(pref);
          }
        }
      }

      return update;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('⏱️  [profile-extraction] Contradiction detection failed', {
        durationMs: duration.toFixed(2),
        error: String(error),
      });

      return {
        additions: newPreferences,
        updates: [],
        invalidations: [],
      };
    }
  }

  return {
    async extractFromConversation(
      messages: Array<{ role: string; content: string | unknown }>,
      userId: string
    ): Promise<ProfileUpdate> {
      const newPreferences = await extractPreferences(messages);

      if (newPreferences.length === 0) {
        return { additions: [], updates: [], invalidations: [] };
      }

      const existingPreferences = await storage.getActivePreferences(userId);
      const existingForComparison = existingPreferences.map(p => ({
        id: p.id,
        content: p.content,
      }));

      const update = await detectContradictions(existingForComparison, newPreferences);

      logger.info('⏱️  [profile-extraction] Profile update prepared', {
        userId,
        additions: update.additions.length,
        updates: update.updates.length,
        invalidations: update.invalidations.length,
      });

      return update;
    },
  };
}
