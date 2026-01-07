import type * as readline from 'node:readline/promises';
import type { CodebaseRAG, ProfileManager } from '@agent/memory';

import { createAgentTools } from './agent.js';
import { createCodebaseTools } from './codebase.js';
import { createDeviceTools } from './device/index.js';
import { createDelegateTool, createTaskTool } from './delegation/index.js';
import { createFsTool } from './filesystem/index.js';
import { setAllowedDirectories } from './filesystem/path-security.js';
import { createMemoryTool, closeMemory } from './memory/index.js';
import { instrumentTools, createToolActivationManager } from './middleware/index.js';
import { createToolRegistry, createToolSearchTool, createActivateToolTool, createDeactivateToolTool } from './registry/index.js';
import { deepReasoningTool } from './deep-reasoning/index.js';
import { createShellTool } from './shell/index.js';
import { createWebTool } from './web/index.js';
import { planTool, validationTool, createPlanTool } from './plan/index.js';
import { initializeChainTools } from './chaining/index.js';

export interface ToolProviderConfig {
  workspaceRoot?: string;
  allowedDirectories?: string[];
  rl?: readline.Interface;
  codebaseRAG?: CodebaseRAG;
  profileManager?: ProfileManager;
  userId?: string;
  enableInstrumentation?: boolean;
  enableActivation?: boolean;
  serverUrl?: string;
}

export const CORE_TOOL_NAMES = [
  'fs',
  'shell',
  'web',
  'memory',
  'delegate',
  'task',
  'plan',
  'validate',
  'deep_reasoning',
] as const;

export interface ToolProviderResult {
  tools: Record<string, any>;
  coreToolNames: readonly string[];
  activationManager: ReturnType<typeof createToolActivationManager>;
  registry: ReturnType<typeof createToolRegistry>;
  cleanup: () => Promise<void>;
}

export async function createAllTools(config: ToolProviderConfig = {}): Promise<ToolProviderResult> {
  const {
    workspaceRoot = process.cwd(),
    allowedDirectories = [workspaceRoot],
    rl,
    codebaseRAG,
    enableInstrumentation = true,
    enableActivation = false,
    serverUrl = process.env['AGENT_SERVER_URL'] || 'http://localhost:3000',
  } = config;

  setAllowedDirectories(allowedDirectories);

  const activationManager = createToolActivationManager();
  const registry = createToolRegistry();

  const coreTools: Record<string, any> = {
    fs: createFsTool(workspaceRoot),
    shell: createShellTool(workspaceRoot),
    web: createWebTool(),
    memory: createMemoryTool(),
    delegate: createDelegateTool(workspaceRoot),
    task: createTaskTool(),
    plan: planTool,
    validate: validationTool,
    deep_reasoning: deepReasoningTool,
  };

  if (rl) {
    Object.assign(coreTools, createAgentTools(rl));
  }

  if (codebaseRAG) {
    Object.assign(coreTools, createCodebaseTools(codebaseRAG));
  }

  const deviceTools = createDeviceTools({ serverUrl });
  Object.assign(coreTools, deviceTools);

  const registryTools = {
    search_tools: createToolSearchTool(registry, activationManager),
    activate_tool: createActivateToolTool(registry, activationManager),
    deactivate_tool: createDeactivateToolTool(registry, activationManager),
  };
  Object.assign(coreTools, registryTools);

  activationManager.setAvailableTools(Object.keys(coreTools));

  let tools = coreTools;
  if (enableInstrumentation) {
    tools = instrumentTools(coreTools);
  }

  const cleanup = async () => {
    await closeMemory();
  };

  return {
    tools,
    coreToolNames: CORE_TOOL_NAMES,
    activationManager,
    registry,
    cleanup,
  };
}

export { createToolActivationManager, createToolRegistry };
