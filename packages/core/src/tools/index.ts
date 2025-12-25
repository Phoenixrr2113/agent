export { planTool, validationTool, createPlanTool } from './plan.js';
export { createCodebaseTools } from './codebase.js';
export { createAgentTools } from './agent.js';
export { 
  createFsTool,
  setAllowedDirectories, 
  getAllowedDirectories,
  type FileInfo,
  type SearchResult,
  type FileEdit,
} from './filesystem/index.js';
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

export { createShellTool, shellTool, addToAllowlist, clearAllowlist, getAllowlist } from './shell.js';
export { createWebTool, webTool } from './web-tool.js';
export { createMemoryTool, memoryTool, closeMemory, getMemoryProvider } from './memory-tool.js';
export { createDelegateTool, createTaskTool } from './delegation/index.js';

export { getPersistentTaskManager, resetPersistentTaskManager } from './background-tasks/task-manager.js';
export type { PersistentTaskInfo } from './background-tasks/types.js';

export * from './factory.js';
export * from './provider.js';

import { createAgentTools } from './agent.js';
import { createCodebaseTools } from './codebase.js';
import { createDeviceTools } from './device/index.js';
import { defaultToolFactory } from './factory.js';
import { createFsTool } from './filesystem/index.js';

defaultToolFactory.register('agent', (deps) => createAgentTools(deps.rl ?? null));
defaultToolFactory.register('filesystem', (deps) =>
  deps.workspaceRoot ? { fs: createFsTool(deps.workspaceRoot) } : {}
);
defaultToolFactory.register('codebase', (deps) =>
  deps.codebaseRAG ? createCodebaseTools(deps.codebaseRAG) : {}
);
defaultToolFactory.register('device', () =>
  createDeviceTools({ serverUrl: process.env['AGENT_SERVER_URL'] ?? 'http://localhost:3000' })
);
