/**
 * @agent/sdk - Vectra Memory Store
 * 
 * Portable in-memory vector database using Vectra.
 * Zero native dependencies, file-based persistence.
 */

import { LocalIndex } from 'vectra';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { MemoryOptions } from '../types/agent';

// ============================================================================
// Types
// ============================================================================

export interface MemoryItem {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface MemorySearchResult {
  item: MemoryItem;
  score: number;
}

export interface MemoryStore {
  remember: (text: string, metadata?: Record<string, unknown>) => Promise<string>;
  recall: (query: string, options?: { topK?: number; threshold?: number }) => Promise<MemorySearchResult[]>;
  forget: (id: string) => Promise<boolean>;
  forgetAll: (filter?: (item: MemoryItem) => boolean) => Promise<number>;
  count: () => Promise<number>;
  close: () => Promise<void>;
}

// ============================================================================
// Embedding - Using OpenAI directly
// ============================================================================

async function getEmbedding(text: string, modelName?: string): Promise<number[]> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY required for memory embeddings');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName ?? 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding failed: ${response.statusText}`);
  }

  const data = await response.json() as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
}

// ============================================================================
// Memory Store Implementation
// ============================================================================

export async function createMemoryStore(options: MemoryOptions = {}): Promise<MemoryStore> {
  const {
    path: storagePath = './.vectra-memory',
    embedModel = 'text-embedding-3-small',
    topK = 5,
    similarityThreshold = 0.7,
  } = options;

  const absolutePath = path.resolve(storagePath);
  await fs.mkdir(absolutePath, { recursive: true });

  const index = new LocalIndex(absolutePath);
  
  if (!await index.isIndexCreated()) {
    await index.createIndex();
  }

  const store: MemoryStore = {
    async remember(text: string, metadata?: Record<string, unknown>): Promise<string> {
      const id = generateId();
      const vector = await getEmbedding(text, embedModel);
      
      await index.insertItem({
        id,
        vector,
        metadata: { text, timestamp: new Date().toISOString(), ...metadata },
      });

      return id;
    },

    async recall(query: string, opts?: { topK?: number; threshold?: number }): Promise<MemorySearchResult[]> {
      const queryVector = await getEmbedding(query, embedModel);
      const k = opts?.topK ?? topK;
      const threshold = opts?.threshold ?? similarityThreshold;

      const results = await index.queryItems(queryVector, k);

      return results
        .filter(r => r.score >= threshold)
        .map(r => ({
          item: {
            id: r.item.id,
            text: r.item.metadata?.text as string ?? '',
            metadata: r.item.metadata as Record<string, unknown>,
            timestamp: new Date(r.item.metadata?.timestamp as string ?? Date.now()),
          },
          score: r.score,
        }));
    },

    async forget(id: string): Promise<boolean> {
      try {
        await index.deleteItem(id);
        return true;
      } catch {
        return false;
      }
    },

    async forgetAll(filter?: (item: MemoryItem) => boolean): Promise<number> {
      const items = await index.listItems();
      let deleted = 0;

      for (const item of items) {
        const memoryItem: MemoryItem = {
          id: item.id,
          text: item.metadata?.text as string ?? '',
          metadata: item.metadata as Record<string, unknown>,
          timestamp: new Date(item.metadata?.timestamp as string ?? Date.now()),
        };

        if (!filter || filter(memoryItem)) {
          await index.deleteItem(item.id);
          deleted++;
        }
      }

      return deleted;
    },

    async count(): Promise<number> {
      const items = await index.listItems();
      return items.length;
    },

    async close(): Promise<void> {
      // Vectra auto-persists
    },
  };

  return store;
}

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export type { MemoryOptions };
