import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';

import { logger } from '@agent/shared';
import { createCodebaseRAG } from '@agent/memory';
import { instrumentTools } from '../tools/middleware/index.js';
import { createAgentTools } from '../tools/agent.js';
import { getPersistentTaskManager } from '../tools/background-tasks/task-manager.js';
import { createCodebaseTools } from '../tools/codebase.js';
import { createDeviceTools } from '../tools/device/index.js';
import { createFsTool } from '../tools/filesystem/index.js';
import { setAllowedDirectories } from '../tools/filesystem/path-security.js';
import { createDelegateTool, createTaskTool } from '../tools/delegation/index.js';
import { createShellTool } from '../tools/shell/index.js';
import { createWebTool } from '../tools/web/index.js';
import { createMemoryTool, closeMemory } from '../tools/memory/index.js';
import {
  type ToolRegistry,
  createToolRegistry,
  createToolSearchTool,
  createActivateToolTool,
  createDeactivateToolTool,
} from '../tools/registry/index.js';
import {
  deepReasoningTool,
  resetDeepReasoningEngine,
} from '../tools/deep-reasoning/index.js';
import { createToolActivationManager } from '../tools/middleware/index.js';
import { planTool, validationTool, createPlanTool } from '../tools/plan/index.js';
import { initializeChainTools } from '../tools/chaining/index.js';

export const CORE_TOOL_NAMES = [
  'fs',
  'shell',
  'web',
  'memory',
  'delegate',
  'task',
  'plan',
  'deep_reasoning',
  'ask_user',
  'task_complete',
  'list_devices',
  'select_device',
  'device_action',
  'tap',
  'type_text',
  'device_screenshot',
  'swipe',
] as const;

export interface InitializationConfig {
  workspaceRoot?: string;
  enableReadline?: boolean;
  registry?: ToolRegistry;
  enableSemanticSearch?: boolean;
  enableCodebaseIndexing?: boolean;
  disableAgentSpawning?: boolean;
}

export interface InitializationResult {
  tools: Record<string, any>;
  codebaseRAG: any;
  readline: readline.Interface | null;
  registry: ToolRegistry;
  activationManager: any;
}

export async function initializeAgent(config: InitializationConfig = {}): Promise<InitializationResult> {
  const {
    workspaceRoot = process.cwd(),
    enableReadline = false,
    registry: providedRegistry,
    enableSemanticSearch = true,
    enableCodebaseIndexing = false,
    disableAgentSpawning = false,
  } = config;

  let rl: readline.Interface | null = null;
  if (enableReadline) {
    rl = readline.createInterface({ input, output });
  }

  logger.info(`🤖 Initializing AI Agent`, { workspaceRoot });

  const registry = providedRegistry ?? createToolRegistry();
  const activationManager = createToolActivationManager();

  setAllowedDirectories([workspaceRoot]);

  let codebaseRAG: any = null;
  if (enableCodebaseIndexing) {
    codebaseRAG = createCodebaseRAG(workspaceRoot, {
      enableContextGeneration: false,
    });
    logger.info('Indexing codebase...', { path: workspaceRoot });
    await codebaseRAG.indexCodebase();
    const ragStats = codebaseRAG.getStats();
    logger.info('RAG indexed', { chunks: ragStats.totalChunks, files: ragStats.files });
  } else {
    logger.info('Codebase indexing disabled');
  }

  initializeChainTools({
    tools: {},
    onStepComplete: (step) => {
      logger.debug('Chain step complete', { stepId: step.stepId, tool: step.tool });
    },
  });

  const codebaseTools = codebaseRAG ? createCodebaseTools(codebaseRAG) : {};
  const agentTools = createAgentTools(rl);
  const deviceTools = createDeviceTools({
    serverUrl: process.env['AGENT_SERVER_URL'] ?? 'http://localhost:3000',
  });

  const consolidatedTools = {
    fs: createFsTool(workspaceRoot),
    shell: createShellTool(workspaceRoot),
    web: createWebTool(),
    memory: createMemoryTool(),
    delegate: disableAgentSpawning ? undefined : createDelegateTool(workspaceRoot),
    task: createTaskTool(),
  };

  const coreTools = {
    plan: disableAgentSpawning ? createPlanTool({ disableDelegation: true }) : planTool,
    validate: validationTool,
    deep_reasoning: deepReasoningTool,
    ...agentTools,
  };

  const allTools: Record<string, any> = {
    ...consolidatedTools,
    ...coreTools,
    ...codebaseTools,
    ...deviceTools,
  };

  Object.keys(allTools).forEach(key => {
    if (allTools[key] === undefined) {
      delete allTools[key];
    }
  });

  registry.registerMany(allTools, { deferLoading: false });

  if (enableSemanticSearch) {
    logger.info('Generating tool embeddings for semantic search...');
    await registry.generateEmbeddings();
    logger.info('Tool embeddings ready', { tools: registry.size() });
  }

  const searchTool = createToolSearchTool(registry, activationManager);
  const activateTool = createActivateToolTool(registry, activationManager);
  const deactivateTool = createDeactivateToolTool(registry, activationManager);

  const tools = {
    ...allTools,
    tool_search: searchTool,
    activate_tool: activateTool,
    deactivate_tool: deactivateTool,
  };

  const instrumentedTools = instrumentTools(tools);

  logger.info('Tool registry initialized', {
    totalTools: Object.keys(tools).length,
    consolidatedTools: Object.keys(consolidatedTools).filter(k => (consolidatedTools as any)[k]).length,
    semanticSearch: enableSemanticSearch,
  });

  return {
    tools: instrumentedTools,
    codebaseRAG,
    readline: rl,
    registry,
    activationManager,
  };
}

export async function cleanup(
  rl: readline.Interface | null,
  codebaseRAG?: any
) {
  logger.info('🧹 Cleaning up...');
  if (rl) {
    rl.close();
  }
  getPersistentTaskManager().shutdown();
  resetDeepReasoningEngine();
  await closeMemory();
  if (codebaseRAG && typeof codebaseRAG.dispose === 'function') {
    codebaseRAG.dispose();
  }
}
