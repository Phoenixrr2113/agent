// Plan tool - now from plan/ module
export { planTool, validationTool, createPlanTool, toolGroups } from './plan/index.js';
export type { Plan, PlanStep, PlanToolConfig } from './plan/index.js';

export { createCodebaseTools } from './codebase.js';
export { createAgentTools } from './agent.js';
export { 
  createFilesystemTools,
  setAllowedDirectories, 
  getAllowedDirectories,
  type FileInfo,
  type SearchResult,
  type FileEdit,
} from './filesystem/index.js';

// Glob tool - ripgrep-powered file search
export { globTool, createGlobTool, runRgFiles } from './glob/index.js';
export type { GlobOptions, GlobResult, FileMatch } from './glob/index.js';

// Grep tool - ripgrep-powered content search
export { grepTool, createGrepTool, runRg } from './grep/index.js';
export type { GrepOptions, GrepMatch, GrepResult } from './grep/index.js';

// AST-grep tool - AST-aware search and replace
export { astGrepSearchTool, astGrepReplaceTool, createAstGrepTools, CLI_LANGUAGES } from './ast-grep/index.js';
export type { CliLanguage, CliMatch, SgResult } from './ast-grep/index.js';
export { createDeviceTools } from './device/index.js';
export {
  ToolRegistry,
  createToolRegistry,
  createToolSearchTool,
  createActivateToolTool,
  createDeactivateToolTool,
  type ToolMetadata,
  type RegisteredTool,
  type ToolRegistrationOptions,
} from './registry/index.js';
export {
  ToolActivationManager,
  createToolActivationManager,
} from './middleware/index.js';
export {
  ToolError,
  ToolErrorType,
  withLifecycle,
  createLifecycleTool,
  wrapWithTiming,
  type ToolLifecycle,
  type ValidationResult,
  type LifecycleToolConfig,
} from './middleware/index.js';
export { success as lifecycleSuccess, error as lifecycleError } from './utils/tool-result.js';

// Shell tool - from shell/ module
export { createShellTool, shellTool, addToAllowlist, clearAllowlist, getAllowlist } from './shell/index.js';
export type { ShellInput, ShellResult } from './shell/index.js';

// Deep reasoning - replaces sequential-thinking
export { 
  deepReasoningTool,
  createDeepReasoningTool,
  configureDeepReasoning,
  isDeepReasoningEnabled,
  getDeepReasoningEngine,
  resetDeepReasoningEngine,
  DeepReasoningEngine,
  // Backwards compatibility alias
  sequentialThinkingTool,
  type ThoughtData,
  type DeepReasoningConfig,
} from './deep-reasoning/index.js';

// Web tool - from web/ module
export { createWebTool, webTool, fetchWithTimeout, braveSearch, tavilySearch, fetchAndParsePage } from './web/index.js';
export type { WebInput, BraveSearchResult, TavilySearchResult, FetchResult } from './web/index.js';

// Memory tool - from memory/ module
export { createMemoryTool, memoryTool, closeMemory, getMemoryProvider } from './memory/index.js';
export type { MemoryInput, FactSummary, EntitySummary } from './memory/index.js';

export { createDelegateTool, createTaskTool } from './delegation/index.js';

export { getPersistentTaskManager, resetPersistentTaskManager } from './background-tasks/task-manager.js';
export type { PersistentTaskInfo } from './background-tasks/types.js';

export * from './factory.js';
export * from './provider.js';

import { createAgentTools } from './agent.js';
import { createCodebaseTools } from './codebase.js';
import { createDeviceTools } from './device/index.js';
import { defaultToolFactory } from './factory.js';
import { createFilesystemTools } from './filesystem/index.js';
import { createGlobTool } from './glob/index.js';
import { createGrepTool } from './grep/index.js';
import { createAstGrepTools } from './ast-grep/index.js';

defaultToolFactory.register('agent', (deps) => createAgentTools(deps.rl ?? null));
defaultToolFactory.register('filesystem', (deps) =>
  deps.workspaceRoot ? createFilesystemTools(deps.workspaceRoot) : {}
);
defaultToolFactory.register('glob', () => createGlobTool());
defaultToolFactory.register('grep', () => createGrepTool());
defaultToolFactory.register('ast-grep', () => createAstGrepTools());
defaultToolFactory.register('codebase', (deps) =>
  deps.codebaseRAG ? createCodebaseTools(deps.codebaseRAG) : {}
);
defaultToolFactory.register('device', () =>
  createDeviceTools({ serverUrl: process.env['AGENT_SERVER_URL'] ?? 'http://localhost:3000' })
);


