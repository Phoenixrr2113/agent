export { shellTool } from './shell.js';
export { webSearchTool } from './web-search.js';
export { fetchPageTool } from './fetch-page.js';
export { memoryTools, memorySearchTool, memoryGetEpisodesTool, memoryGetFactTool, getMemoryProvider } from './memory.js';
export { planTool, validationTool } from './workflow.js';
export { createCodebaseTools } from './codebase.js';
export { createAgentTools } from './agent.js';
export { createFilesystemTools, setAllowedDirectories, getAllowedDirectories } from './filesystem.js';
export {
  ToolRegistry,
  createToolRegistry,
  createToolSearchTool,
  createActivateToolTool,
  createDeactivateToolTool,
  type ToolMetadata,
  type RegisteredTool,
  type ToolRegistrationOptions,
} from './registry.js';
export {
  ToolActivationManager,
  createToolActivationManager,
} from './tool-wrapper.js';
export {
  persistentBackgroundTaskTools,
  getPersistentTaskManager,
  resetPersistentTaskManager,
  type PersistentTaskInfo,
} from './background-tasks-persistent.js';

export * from './factory.js';
import { defaultToolFactory } from './factory.js';
import { createAgentTools } from './agent.js';
import { createFilesystemTools } from './filesystem.js';
import { createCodebaseTools } from './codebase.js';

defaultToolFactory.register('agent', (deps) => createAgentTools(deps.rl ?? null));
defaultToolFactory.register('filesystem', (deps) =>
  createFilesystemTools(deps.workspaceRoot ?? process.cwd())
);
defaultToolFactory.register('codebase', (deps) =>
  deps.codebaseRAG ? createCodebaseTools(deps.codebaseRAG) : {}
);

