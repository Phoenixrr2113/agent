import { generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { CodeChunk } from './chunking.js';
import { logger } from '@agent/shared';

export interface ContextualChunk extends CodeChunk {
  context: string;
  contextualContent: string;
}

const CONTEXT_PROMPT = `You are analyzing a code chunk for a retrieval system.
Given the following code, write a brief description (2-3 sentences) explaining:
1. What this code does
2. Its purpose in the codebase
3. Key functions/classes/variables it defines or uses

Be concise and technical. Focus on searchability.

File: {filePath}
{parentInfo}
{docsInfo}
Code type: {codeType}

Code:
\`\`\`
{code}
\`\`\`

Description:`;

function buildPrompt(chunk: CodeChunk): string {
  const parentInfo = chunk.metadata.parent?.length
    ? `Inside: ${chunk.metadata.parent.join(' > ')}`
    : '';
  const docsInfo = chunk.metadata.docs ? `Docs: ${chunk.metadata.docs}` : '';
  const codeType = chunk.metadata.name
    ? `${chunk.metadata.type} "${chunk.metadata.name}"`
    : chunk.metadata.type;

  return CONTEXT_PROMPT.replace('{filePath}', chunk.filePath)
    .replace('{parentInfo}', parentInfo)
    .replace('{docsInfo}', docsInfo)
    .replace('{codeType}', codeType)
    .replace('{code}', chunk.content.slice(0, 2000));
}

export async function generateChunkContext(
  chunk: CodeChunk,
  model?: any
): Promise<string> {
  // Use OpenRouter with free tier model for better rate limits
  const openrouter = createOpenRouter();
  const contextModel = model || openrouter(process.env.MODEL_FAST || 'google/gemini-2.0-flash');
  const prompt = buildPrompt(chunk);

  const { text } = await generateText({
    model: contextModel,
    prompt,
    maxOutputTokens: 150,
    temperature: 0.3,
  });

  return text.trim();
}

export async function generateContextBatch(
  chunks: CodeChunk[],
  options: {
    concurrency?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<ContextualChunk[]> {
  const { concurrency = 5, delayMs = 100, onProgress } = options;
  const results: ContextualChunk[] = [];
  let completed = 0;

  const processChunk = async (chunk: CodeChunk): Promise<ContextualChunk> => {
    try {
      const context = await generateChunkContext(chunk);
      return {
        ...chunk,
        context,
        contextualContent: buildContextualContent(chunk, context),
      };
    } catch (error) {
      logger.warn('Failed to generate chunk context, using fallback', {
        filePath: chunk.filePath,
        error
      });
      const fallbackContext = buildFallbackContext(chunk);
      return {
        ...chunk,
        context: fallbackContext,
        contextualContent: buildContextualContent(chunk, fallbackContext),
      };
    }
  };

  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processChunk));
    results.push(...batchResults);

    completed += batch.length;
    onProgress?.(completed, chunks.length);

    if (i + concurrency < chunks.length && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

function buildContextualContent(chunk: CodeChunk, context: string): string {
  const header = [
    `File: ${chunk.filePath}`,
    chunk.metadata.parent?.length ? `Scope: ${chunk.metadata.parent.join(' > ')}` : null,
    chunk.metadata.name ? `Name: ${chunk.metadata.name}` : null,
    `Type: ${chunk.metadata.type}`,
    '',
    `Description: ${context}`,
    '',
  ]
    .filter(Boolean)
    .join('\n');

  return `${header}\n${chunk.content}`;
}

function buildFallbackContext(chunk: CodeChunk): string {
  const parts: string[] = [];

  if (chunk.metadata.name) {
    parts.push(`Defines ${chunk.metadata.type} "${chunk.metadata.name}"`);
  } else {
    parts.push(`Contains ${chunk.metadata.type} code`);
  }

  if (chunk.metadata.parent?.length) {
    parts.push(`inside ${chunk.metadata.parent.join(' > ')}`);
  }

  parts.push(`in ${chunk.filePath}`);

  return parts.join(' ');
}

export function createContextualChunkWithoutLLM(chunk: CodeChunk): ContextualChunk {
  const context = buildFallbackContext(chunk);
  return {
    ...chunk,
    context,
    contextualContent: buildContextualContent(chunk, context),
  };
}

