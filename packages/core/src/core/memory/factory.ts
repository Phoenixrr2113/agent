import { createMemoryLite } from "./memory-lite.js";
import { createGraphitiProvider } from './provider-graphiti.js';
import { logger } from '@agent/shared';


import type { MemoryProvider, MemoryConfig, MemoryConfigInput, LiteMemoryConfig } from './types.js';

export { BaseMemoryProvider } from './provider-base.js';
export type { MemoryProvider, MemoryConfig, MemoryConfigInput, LiteMemoryConfig, GraphitiMemoryConfig } from './types.js';

export function createMemoryProvider(config: MemoryConfig): MemoryProvider {
  if (config.provider === 'graphiti') {
    const url = config.graphitiUrl || process.env['GRAPHITI_URL'] || 'http://localhost:8000';
    return createGraphitiProvider(url);
  }

  return createMemoryLite({
    embeddingModel: config.embeddingModel,
    extractionModel: config.extractionModel,
    storagePath: config.storagePath,
  });
}

export async function detectAvailableProvider(
  graphitiUrl?: string
): Promise<'graphiti' | 'lite'> {
  const url = graphitiUrl || process.env['GRAPHITI_URL'] || 'http://localhost:8000';

  try {
    const response = await fetch(`${url}/healthcheck`, {
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
  config: MemoryConfigInput
): Promise<MemoryProvider> {
  const provider = await detectAvailableProvider(config.graphitiUrl);
  logger.info(`Memory provider: ${provider}`);

  if (provider === 'graphiti') {
    return createMemoryProvider({
      provider: 'graphiti',
      graphitiUrl: config.graphitiUrl,
    });
  }

  return createMemoryProvider({
    provider: 'lite',
    embeddingModel: config.embeddingModel,
    extractionModel: config.extractionModel,
    storagePath: config.storagePath,
  });
}
