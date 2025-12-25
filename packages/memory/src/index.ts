// @agent/memory - Memory, profile, and codebase knowledge for AI agents

// Storage adapters
export * from './storage/index.js';

// Embeddings
export {
  getEmbeddingModel,
  cosineSimilarity,
  createEmbeddingService,
  type EmbeddingService,
} from './embeddings/index.js';

// Entities (conversation memory)
export {
  createMemoryLite,
  createMemoryProvider,
  createAutoMemoryProvider,
  createUnifiedMemoryExtractor,
  BaseMemoryProvider,
  type UnifiedMemoryExtractor,
  type MemoryProvider,
  type MemoryAddInput,
  type MemorySearchInput,
  type SearchResult,
  type Entity,
  type Fact,
  type Episode,
  type Relation,
  type LiteMemoryConfig,
} from './entities/index.js';

// Profiles (user preferences)
export {
  createProfileStorage,
  createProfileManager,
  createProfileExtractor,
  createReminderInjector,
  createToolReminderWrapper,
  type ProfileManager,
  type ProfileStorageAdapter,
  type UserProfile,
  type ToolWithReminders,
} from './profiles/index.js';

// RAG (codebase indexing)
export {
  createCodebaseRAG,
  type CodebaseRAG,
  type RAGOptions,
  type SearchOptions,
} from './rag/index.js';
