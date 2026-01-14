// Plan tool - now from plan/ module
export { planTool, validationTool, createPlanTool, toolGroups } from './plan';
export type { Plan, PlanStep, PlanToolConfig } from './plan';

export { createCodebaseTools } from './codebase.js';
export { createAgentTools } from './agent.js';
export {
  createFilesystemTools,
  setAllowedDirectories,
  getAllowedDirectories,
  type FileInfo,
  type SearchResult,
  type FileEdit,
} from './filesystem';

// Glob tool - ripgrep-powered file search
export { globTool, createGlobTool, runRgFiles } from './glob';
export type { GlobOptions, GlobResult, FileMatch } from './glob';

// Grep tool - ripgrep-powered content search
export { grepTool, createGrepTool, runRg } from './grep';
export type { GrepOptions, GrepMatch, GrepResult } from './grep';

// AST-grep tool - AST-aware search and replace
export {
  astGrepSearchTool,
  astGrepReplaceTool,
  createAstGrepTools,
  CLI_LANGUAGES,
} from './ast-grep';
export type { CliLanguage, CliMatch, SgResult } from './ast-grep';
export { createDeviceTools } from './device';
export {
  ToolRegistry,
  createToolRegistry,
  createToolSearchTool,
  createActivateToolTool,
  createDeactivateToolTool,
  type ToolMetadata,
  type RegisteredTool,
  type ToolRegistrationOptions,
} from './registry';
export { ToolActivationManager, createToolActivationManager } from './middleware';
export {
  ToolError,
  ToolErrorType,
  withLifecycle,
  createLifecycleTool,
  wrapWithTiming,
  type ToolLifecycle,
  type ValidationResult,
  type LifecycleToolConfig,
} from './middleware';
export { success as lifecycleSuccess, error as lifecycleError } from './utils/tool-result.js';

// Shell tool - from shell/ module
export { createShellTool, shellTool, addToAllowlist, clearAllowlist, getAllowlist } from './shell';
export type { ShellInput, ShellResult } from './shell';

// Deep reasoning - replaces sequential-thinking
export {
  deepReasoningTool,
  createDeepReasoningTool,
  configureDeepReasoning,
  isDeepReasoningEnabled,
  getDeepReasoningEngine,
  resetDeepReasoningEngine,
  DeepReasoningEngine,
  type ThoughtData,
  type DeepReasoningConfig,
} from './deep-reasoning';

// Web tool - from web/ module
export {
  createWebTool,
  webTool,
  fetchWithTimeout,
  braveSearch,
  tavilySearch,
  fetchAndParsePage,
} from './web';
export type { WebInput, BraveSearchResult, TavilySearchResult, FetchResult } from './web';

// Memory tool - from memory/ module
export { createMemoryTool, memoryTool, closeMemory, getMemoryProvider } from './memory';
export type { MemoryInput, FactSummary, EntitySummary } from './memory';

export { createDelegateTool, createTaskTool } from './delegation';

export {
  getPersistentTaskManager,
  resetPersistentTaskManager,
} from './background-tasks/task-manager.js';
export type { PersistentTaskInfo } from './background-tasks/types.js';

export * from './factory.js';
export * from './provider.js';

import { createAgentTools } from './agent.js';
import { createAstGrepTools } from './ast-grep';
import { createCodebaseTools } from './codebase.js';
import { createDeviceTools } from './device';
import { defaultToolFactory } from './factory.js';
import { createFilesystemTools } from './filesystem';
import { createGlobTool } from './glob';
import { createGrepTool } from './grep';

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
