import { logger } from '@agent/shared';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';

const DEFAULT_EXPANSION_MODEL = process.env['MODEL_EXPANSION'] || process.env['MODEL_STANDARD'] || 'google/gemini-2.0-flash-001';

const QueryExpansionSchema = z.object({
  expandedQueries: z.array(z.string()).describe('Alternative search queries that capture the same intent'),
  keywords: z.array(z.string()).describe('Key terms and synonyms to improve search recall'),
});

export interface QueryExpansionConfig {
  enabled?: boolean;
  maxExpansions?: number;
  model?: string;
}

export interface ExpandedQuery {
  original: string;
  expanded: string[];
  keywords: string[];
}

const EXPANSION_PROMPT = `You are a search query expansion system for a codebase search engine.
Given a user's search query, generate alternative phrasings and related keywords that would help find relevant code.

Focus on:
- Technical synonyms (e.g., "auth" → "authentication", "login", "session")
- Related concepts (e.g., "database" → "storage", "persistence", "repository")
- Common abbreviations and full forms
- Framework/library specific terms if applicable

Keep expansions concise and relevant. Do not add unrelated concepts.`;

export async function expandQuery(
  query: string,
  config: QueryExpansionConfig = {}
): Promise<ExpandedQuery> {
  const {
    enabled = true,
    maxExpansions = 3,
    model = DEFAULT_EXPANSION_MODEL,
  } = config;

  if (!enabled) {
    return { original: query, expanded: [], keywords: [] };
  }

  const startTime = performance.now();
  logger.debug('⏱️  [RAG] Starting query expansion', { query });

  const openrouter = createOpenRouter();
  const llmModel = openrouter(model);

  const { object } = await generateObject({
    model: llmModel,
    schema: QueryExpansionSchema,
    prompt: `${EXPANSION_PROMPT}

Query: "${query}"

Generate up to ${maxExpansions} alternative search queries and relevant keywords.`,
  });

  const expanded = object.expandedQueries.slice(0, maxExpansions);
  const keywords = object.keywords;

  const duration = performance.now() - startTime;
  logger.info('⏱️  [RAG] Query expansion completed', {
    query,
    expandedCount: expanded.length,
    keywordCount: keywords.length,
    durationMs: duration.toFixed(2),
  });

  return {
    original: query,
    expanded,
    keywords,
  };
}

export function combineExpandedResults<T extends { id: string }>(
  resultsByQuery: Map<string, T[]>,
  originalQuery: string
): T[] {
  const seen = new Set<string>();
  const combined: T[] = [];

  const originalResults = resultsByQuery.get(originalQuery) ?? [];
  for (const result of originalResults) {
    if (!seen.has(result.id)) {
      seen.add(result.id);
      combined.push(result);
    }
  }

  for (const [queryKey, results] of resultsByQuery.entries()) {
    if (queryKey === originalQuery) continue;
    for (const result of results) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        combined.push(result);
      }
    }
  }

  return combined;
}
