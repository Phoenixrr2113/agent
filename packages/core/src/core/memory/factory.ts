import type { MemoryProvider, MemoryConfig } from './types.js';
import { createMemoryLite } from './index.js';
import { createGraphitiProvider } from './provider-graphiti.js';

export { BaseMemoryProvider } from './provider-base.js';
export type { MemoryProvider, MemoryConfig } from './types.js';

export function createMemoryProvider(config: MemoryConfig): MemoryProvider {
  if (config.provider === 'graphiti') {
    const url = config.graphitiUrl || process.env.GRAPHITI_URL || 'http://localhost:8000';
    return createGraphitiProvider(url);
  }

  return createMemoryLite({
    embeddingModel: config.embeddingModel,
    extractionModel: config.extractionModel,
    storagePath: config.storagePath,
  });
}

export async function detectAvailableProvider(): Promise<'graphiti' | 'lite'> {
  const graphitiUrl = process.env.GRAPHITI_URL || 'http://localhost:8000';

  try {
    const response = await fetch(`${graphitiUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      return 'graphiti';
    }
  } catch {
  }

  return 'lite';
}

export async function createAutoMemoryProvider(
  config: Omit<MemoryConfig, 'provider'>
): Promise<MemoryProvider> {
  const provider = await detectAvailableProvider();
  console.log(`Memory provider: ${provider}`);

  return createMemoryProvider({
    ...config,
    provider,
  });
}

