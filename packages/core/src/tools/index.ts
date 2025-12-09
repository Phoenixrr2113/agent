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
  type ToolActivationCallbacks,
  type ToolActivationManagerOptions,
} from './tool-wrapper.js';

import { shellTool } from './shell.js';
import { webSearchTool } from './web-search.js';
import { fetchPageTool } from './fetch-page.js';
import { memoryTools } from './memory.js';
import { planTool, validationTool } from './workflow.js';

export const nativeTools = {
  shell: shellTool,
  web_search: webSearchTool,
  fetch_page: fetchPageTool,
  ...memoryTools,
  plan: planTool,
  validate: validationTool,
};

