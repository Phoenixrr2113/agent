import { logger } from '@agent/shared';
import { generateObject } from 'ai';
import { z } from 'zod';

import type { ExtractionResult } from './types.js';

const ExtractionSchema = z.object({
  entities: z.array(z.object({
    name: z.string().describe('The canonical name of the entity'),
    type: z.string().describe('Entity type: person, organization, project, concept, location, event, etc.'),
    attributes: z.record(z.unknown()).describe('Key attributes of the entity'),
  })),
  relations: z.array(z.object({
    fromEntity: z.string().describe('Name of the source entity'),
    toEntity: z.string().describe('Name of the target entity'),
    type: z.string().describe('Relationship type in SCREAMING_SNAKE_CASE (e.g., WORKS_ON, CREATED_BY, PART_OF)'),
    weight: z.number().min(0).max(1).optional().describe('Confidence/strength of the relationship'),
  })),
  facts: z.array(z.object({
    content: z.string().describe('A single, atomic fact extracted from the text'),
    entityNames: z.array(z.string()).describe('Names of entities involved in this fact'),
    confidence: z.number().min(0).max(1).describe('Confidence score for this fact'),
  })),
});

const EXTRACTION_PROMPT = `You are an entity and relationship extraction system. Given the input text, extract:

1. ENTITIES: Named things (people, projects, concepts, organizations, etc.)
   - Use canonical names (normalize "Randy", "randy", "Randy Wilson" to "Randy Wilson")
   - Identify the type accurately
   - Extract relevant attributes mentioned

2. RELATIONS: Connections between entities
   - Use active voice relationship types (WORKS_ON, not WORKED_ON_BY)
   - Common types: WORKS_ON, CREATED, OWNS, PART_OF, RELATED_TO, KNOWS, USES, DEPENDS_ON
   - Assign weight based on how explicitly stated the relationship is

3. FACTS: Atomic pieces of information
   - Each fact should be self-contained and verifiable
   - Link facts to the entities they involve
   - Assign confidence based on how definitive the statement is

Be thorough but precise. Only extract what is explicitly stated or strongly implied.`;

export async function extractFromText(
  text: string,
  model: Parameters<typeof generateObject>[0]['model'],
  existingEntities?: string[]
): Promise<ExtractionResult> {
  const startTime = performance.now();
  logger.info('⏱️  [memory-extraction] Starting LLM extraction', {
    textLength: text.length,
    existingEntitiesCount: existingEntities?.length || 0,
  });

  const contextPrompt = existingEntities?.length
    ? `\n\nKnown entities (prefer these names if referring to the same thing): ${existingEntities.join(', ')}`
    : '';

  const { object } = await generateObject({
    model,
    schema: ExtractionSchema,
    prompt: `${EXTRACTION_PROMPT}${contextPrompt}\n\nText to analyze:\n${text}`,
  });

  const duration = performance.now() - startTime;
  logger.info('⏱️  [memory-extraction] LLM extraction completed', {
    durationMs: duration.toFixed(2),
    durationSec: (duration / 1000).toFixed(3),
    entitiesExtracted: object.entities.length,
    factsExtracted: object.facts.length,
    relationsExtracted: object.relations.length,
  });

  return {
    entities: object.entities.map(e => ({
      ...e,
      attributes: e.attributes || {},
    })),
    relations: object.relations.map(r => ({
      ...r,
      weight: r.weight ?? 0.8,
    })),
    facts: object.facts,
  };
}

function mergeAttributes(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined && value !== null && value !== '') {
      merged[key] = value;
    }
  }
  return merged;
}

export async function resolveEntityConflicts(
  newEntity: { name: string; type: string; attributes: Record<string, unknown> },
  existingEntity: { name: string; type: string; attributes: Record<string, unknown> },
  model: Parameters<typeof generateObject>[0]['model']
): Promise<{ shouldMerge: boolean; mergedAttributes?: Record<string, unknown> | undefined }> {
  const startTime = performance.now();

  const namesMatch = newEntity.name.toLowerCase() === existingEntity.name.toLowerCase();
  const typesMatch = newEntity.type.toLowerCase() === existingEntity.type.toLowerCase();
  const newHasAttributes = Object.keys(newEntity.attributes).length > 0;
  const existingHasAttributes = Object.keys(existingEntity.attributes).length > 0;

  if (namesMatch && (typesMatch || !newHasAttributes || !existingHasAttributes)) {
    const mergedAttributes = mergeAttributes(existingEntity.attributes, newEntity.attributes);
    const duration = performance.now() - startTime;
    logger.info('⏱️  [memory-extraction] Entity conflict resolved (fast path)', {
      durationMs: duration.toFixed(2),
      entity: newEntity.name,
      reason: 'name_match',
    });
    return { shouldMerge: true, mergedAttributes };
  }

  logger.debug('⏱️  [memory-extraction] Starting entity conflict resolution (LLM)', {
    newEntity: newEntity.name,
    existingEntity: existingEntity.name,
  });

  const { object } = await generateObject({
    model,
    schema: z.object({
      shouldMerge: z.boolean().describe('Whether these entities refer to the same thing'),
      mergedAttributes: z.record(z.unknown()).optional().describe('Combined attributes if merging'),
      reasoning: z.string().describe('Brief explanation'),
    }),
    prompt: `Determine if these two entities refer to the same thing and should be merged:

Entity 1: ${JSON.stringify(newEntity)}
Entity 2: ${JSON.stringify(existingEntity)}

If they are the same entity, merge their attributes (prefer newer/more specific values).`,
  });

  const duration = performance.now() - startTime;
  logger.info('⏱️  [memory-extraction] Entity conflict resolution completed (LLM)', {
    durationMs: duration.toFixed(2),
    durationSec: (duration / 1000).toFixed(3),
    shouldMerge: object.shouldMerge,
    reasoning: object.reasoning,
  });

  return {
    shouldMerge: object.shouldMerge,
    mergedAttributes: object.mergedAttributes,
  };
}

export async function detectContradictions(
  newFact: string,
  existingFacts: string[],
  model: Parameters<typeof generateObject>[0]['model']
): Promise<{ contradicts: string[]; supersedes: string[] }> {
  if (existingFacts.length === 0) {
    logger.debug('⏱️  [memory-extraction] Skipping contradiction detection (no existing facts)');
    return { contradicts: [], supersedes: [] };
  }

  const startTime = performance.now();
  logger.debug('⏱️  [memory-extraction] Starting contradiction detection', {
    existingFactsCount: existingFacts.length,
  });

  const { object } = await generateObject({
    model,
    schema: z.object({
      contradicts: z.array(z.number()).describe('Indices of facts that directly contradict the new fact'),
      supersedes: z.array(z.number()).describe('Indices of facts that the new fact updates/replaces'),
    }),
    prompt: `Analyze if the new fact contradicts or supersedes any existing facts.

New fact: "${newFact}"

Existing facts:
${existingFacts.map((f, index) => `${index}: "${f}"`).join('\n')}

- contradicts: Facts that cannot both be true (logical contradiction)
- supersedes: Facts that the new fact updates (same topic, newer information)`,
  });

  const duration = performance.now() - startTime;
  logger.info('⏱️  [memory-extraction] Contradiction detection completed', {
    durationMs: duration.toFixed(2),
    durationSec: (duration / 1000).toFixed(3),
    contradicts: object.contradicts.length,
    supersedes: object.supersedes.length,
  });

  return {
    contradicts: object.contradicts.map(index => existingFacts[index]).filter((f): f is string => !!f),
    supersedes: object.supersedes.map(index => existingFacts[index]).filter((f): f is string => !!f),
  };
}

export interface BatchContradictionResult {
  factIndex: number;
  contradicts: string[];
  supersedes: string[];
}

export async function detectContradictionsBatch(
  newFacts: string[],
  existingFacts: string[],
  model: Parameters<typeof generateObject>[0]['model']
): Promise<BatchContradictionResult[]> {
  if (existingFacts.length === 0 || newFacts.length === 0) {
    logger.debug('⏱️  [memory-extraction] Skipping batch contradiction detection (no facts)');
    return newFacts.map((_, index) => ({ factIndex: index, contradicts: [], supersedes: [] }));
  }

  const startTime = performance.now();
  logger.info('⏱️  [memory-extraction] Starting batch contradiction detection', {
    newFactsCount: newFacts.length,
    existingFactsCount: existingFacts.length,
  });

  const { object } = await generateObject({
    model,
    schema: z.object({
      results: z.array(z.object({
        newFactIndex: z.number().describe('Index of the new fact being analyzed'),
        contradicts: z.array(z.number()).describe('Indices of existing facts that directly contradict this new fact'),
        supersedes: z.array(z.number()).describe('Indices of existing facts that this new fact updates/replaces'),
      })),
    }),
    prompt: `Analyze if any of the new facts contradict or supersede any existing facts.

NEW FACTS:
${newFacts.map((f, index) => `[${index}]: "${f}"`).join('\n')}

EXISTING FACTS:
${existingFacts.map((f, index) => `[${index}]: "${f}"`).join('\n')}

For each new fact, determine:
- contradicts: Indices of existing facts that cannot both be true (logical contradiction)
- supersedes: Indices of existing facts that the new fact updates (same topic, newer information)

Provide results for all ${newFacts.length} new facts.`,
  });

  const duration = performance.now() - startTime;
  logger.info('⏱️  [memory-extraction] Batch contradiction detection completed', {
    durationMs: duration.toFixed(2),
    durationSec: (duration / 1000).toFixed(3),
    newFactsAnalyzed: newFacts.length,
  });

  const resultMap = new Map<number, { contradicts: number[]; supersedes: number[] }>();
  for (const r of object.results) {
    resultMap.set(r.newFactIndex, { contradicts: r.contradicts, supersedes: r.supersedes });
  }

  return newFacts.map((_, index) => {
    const result = resultMap.get(index) || { contradicts: [], supersedes: [] };
    return {
      factIndex: index,
      contradicts: result.contradicts.map(idx => existingFacts[idx]).filter((f): f is string => !!f),
      supersedes: result.supersedes.map(idx => existingFacts[idx]).filter((f): f is string => !!f),
    };
  });
}

