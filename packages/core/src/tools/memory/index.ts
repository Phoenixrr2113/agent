// Tool exports
export { createMemoryTool, memoryTool, executeMemory } from './tools.js';

// Provider exports
export { getMemoryProvider, closeMemory } from './provider.js';

// Type exports
export type { 
  MemoryInput, 
  MemoryProviderConfig,
  FactSummary,
  EntitySummary,
  SearchResult,
  EpisodesResult,
} from './types.js';

// Constant exports
export {
  MEMORY_DESCRIPTION,
  DEFAULT_GROUP_ID,
  DEFAULT_MAX_RESULTS,
  DEFAULT_DEPTH,
} from './constants.js';
