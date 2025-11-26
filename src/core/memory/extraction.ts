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
  const contextPrompt = existingEntities?.length
    ? `\n\nKnown entities (prefer these names if referring to the same thing): ${existingEntities.join(', ')}`
    : '';

  const { object } = await generateObject({
    model,
    schema: ExtractionSchema,
    prompt: `${EXTRACTION_PROMPT}${contextPrompt}\n\nText to analyze:\n${text}`,
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

export async function resolveEntityConflicts(
  newEntity: { name: string; type: string; attributes: Record<string, unknown> },
  existingEntity: { name: string; type: string; attributes: Record<string, unknown> },
  model: Parameters<typeof generateObject>[0]['model']
): Promise<{ shouldMerge: boolean; mergedAttributes?: Record<string, unknown> }> {
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

  return {
    shouldMerge: object.shouldMerge,
    mergedAttributes: object.mergedAttributes as Record<string, unknown> | undefined,
  };
}

export async function detectContradictions(
  newFact: string,
  existingFacts: string[],
  model: Parameters<typeof generateObject>[0]['model']
): Promise<{ contradicts: string[]; supersedes: string[] }> {
  if (existingFacts.length === 0) {
    return { contradicts: [], supersedes: [] };
  }

  const { object } = await generateObject({
    model,
    schema: z.object({
      contradicts: z.array(z.number()).describe('Indices of facts that directly contradict the new fact'),
      supersedes: z.array(z.number()).describe('Indices of facts that the new fact updates/replaces'),
    }),
    prompt: `Analyze if the new fact contradicts or supersedes any existing facts.

New fact: "${newFact}"

Existing facts:
${existingFacts.map((f, i) => `${i}: "${f}"`).join('\n')}

- contradicts: Facts that cannot both be true (logical contradiction)
- supersedes: Facts that the new fact updates (same topic, newer information)`,
  });

  return {
    contradicts: object.contradicts.map(i => existingFacts[i]).filter(Boolean),
    supersedes: object.supersedes.map(i => existingFacts[i]).filter(Boolean),
  };
}

