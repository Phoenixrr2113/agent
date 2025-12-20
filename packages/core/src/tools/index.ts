export { planTool, validationTool, createPlanTool } from './workflow.js';
export { createCodebaseTools } from './codebase.js';
export { createAgentTools } from './agent.js';
export { createFilesystemTools, setAllowedDirectories, getAllowedDirectories } from './filesystem.js';
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
} from './registry.js';
export {
  ToolActivationManager,
  createToolActivationManager,
} from './tool-wrapper.js';
export {
  ToolError,
  ToolErrorType,
  withLifecycle,
  createLifecycleTool,
  wrapWithTiming,
  success as lifecycleSuccess,
  error as lifecycleError,
  type ToolLifecycle,
  type ValidationResult,
  type LifecycleToolConfig,
} from './lifecycle.js';

export { createFsTool } from './filesystem/index.js';
export { createShellTool, shellTool, addToAllowlist, clearAllowlist, getAllowlist } from './shell.js';
export { createWebTool, webTool } from './web-tool.js';
export { createMemoryTool, memoryTool, closeMemory, getMemoryProvider } from './memory-tool.js';
export { createDelegateTool, createTaskTool } from './delegation/index.js';

export { getPersistentTaskManager, resetPersistentTaskManager } from './background-tasks/task-manager.js';
export type { PersistentTaskInfo } from './background-tasks/types.js';

export * from './factory.js';

import { createAgentTools } from './agent.js';
import { createCodebaseTools } from './codebase.js';
import { createDeviceTools } from './device/index.js';
import { defaultToolFactory } from './factory.js';
import { createFilesystemTools } from './filesystem.js';

defaultToolFactory.register('agent', (deps) => createAgentTools(deps.rl ?? null));
defaultToolFactory.register('filesystem', (deps) =>
  createFilesystemTools(deps.workspaceRoot ?? process.cwd())
);
defaultToolFactory.register('codebase', (deps) =>
  deps.codebaseRAG ? createCodebaseTools(deps.codebaseRAG) : {}
);
defaultToolFactory.register('device', () =>
  createDeviceTools({ serverUrl: process.env['AGENT_SERVER_URL'] ?? 'http://localhost:3000' })
);
