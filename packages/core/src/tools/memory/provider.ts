import { createAutoMemoryProvider, type MemoryProvider } from '@agent/memory';

let memoryProviderPromise: Promise<MemoryProvider> | null = null;
let isClosing = false;

export function getProvider(): Promise<MemoryProvider> {
  if (isClosing) {
    throw new Error('Memory provider is shutting down');
  }
  if (!memoryProviderPromise) {
    memoryProviderPromise = createAutoMemoryProvider({
      storagePath: process.env['MEMORY_DB_PATH'] || './memory.db',
      graphitiUrl: process.env['GRAPHITI_URL'],
      embeddingModel: process.env['MEMORY_EMBEDDING_MODEL'],
      extractionModel: process.env['MEMORY_EXTRACTION_MODEL'],
    });
  }
  return memoryProviderPromise;
}

export async function getMemoryProvider(): Promise<MemoryProvider> {
  return getProvider();
}

export async function closeMemory(): Promise<void> {
  if (memoryProviderPromise) {
    isClosing = true;
    try {
      const provider = await memoryProviderPromise;
      await provider.close();
    } finally {
      memoryProviderPromise = null;
      isClosing = false;
    }
  }
}
