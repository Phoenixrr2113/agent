import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { createCodebaseRAG } from '../core/rag/index.js';
import { grepWorkspace } from '../core/search/grep.js';
import { logger } from '@agent/shared';
import { instrumentTools } from '../core/tool-instrumentation.js';

import { shellTool } from '../tools/shell.js';
import { webSearchTool } from '../tools/web-search.js';
import { fetchPageTool } from '../tools/fetch-page.js';
import { memoryTools, closeMemory } from '../tools/memory.js';
import { planTool, validationTool } from '../tools/workflow.js';
import { createCodebaseTools } from '../tools/codebase.js';
import { createAgentTools } from '../tools/agent.js';
import {
  ToolRegistry,
  createToolRegistry,
  createToolSearchTool,
  createActivateToolTool,
} from '../tools/registry.js';
import {
  createToolActivationManager,
} from '../tools/tool-wrapper.js';

export interface InitializationConfig {
  workspaceRoot?: string;
  enableReadline?: boolean;
  registry?: ToolRegistry;
  enableSemanticSearch?: boolean;
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
    workspaceRoot,
    enableReadline = false,
    registry: providedRegistry,
    enableSemanticSearch = true,
  } = config;

  let rl: readline.Interface | null = null;
  if (enableReadline) {
    rl = readline.createInterface({ input, output });
  }

  logger.info(`🤖 Initializing AI Agent`, { workspaceRoot: workspaceRoot || '(none)' });

  const registry = providedRegistry ?? createToolRegistry();
  const activationManager = createToolActivationManager();

  let codebaseRAG: any = null;
  if (workspaceRoot) {
    codebaseRAG = createCodebaseRAG(workspaceRoot);
    logger.info('Indexing codebase...', { path: workspaceRoot });
    await codebaseRAG.indexCodebase();
    const ragStats = codebaseRAG.getStats();
    logger.info('RAG indexed', { chunks: ragStats.totalChunks, files: ragStats.files });
  } else {
    logger.info('No workspace provided - codebase tools disabled');
  }

  const workspaceTools = codebaseRAG && workspaceRoot
    ? createCodebaseTools(codebaseRAG, grepWorkspace, workspaceRoot)
    : {};
  const agentTools = createAgentTools(rl);

  const activeTools = {
    shell: shellTool,
    plan: planTool,
    ...agentTools,
  };

  const deferredTools = {
    web_search: webSearchTool,
    fetch_page: fetchPageTool,
    ...memoryTools,
    validate: validationTool,
    ...workspaceTools,
  };

  registry.registerMany(activeTools, { deferLoading: false });
  registry.registerMany(deferredTools, { deferLoading: true });

  if (enableSemanticSearch) {
    logger.info('Generating tool embeddings for semantic search...');
    await registry.generateEmbeddings();
    logger.info('Tool embeddings ready', { tools: registry.size() });
  }

  const searchTool = createToolSearchTool(registry, activationManager);
  const activateTool = createActivateToolTool(registry, activationManager);

  const wrappedDeferredTools: Record<string, any> = {};
  for (const [name, tool] of Object.entries(deferredTools)) {
    const metadata = registry.getMetadata(name);
    if (metadata) {
      wrappedDeferredTools[name] = activationManager.createDeferredWrapper(
        name,
        tool,
        metadata.description
      );
    }
  }

  const tools = {
    ...activeTools,
    ...wrappedDeferredTools,
    search_tools: searchTool,
    activate_tool: activateTool,
  };

  const instrumentedTools = instrumentTools(tools);

  logger.info('Tool registry initialized', {
    totalTools: registry.size(),
    activeTools: Object.keys(activeTools).length,
    deferredTools: Object.keys(deferredTools).length,
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

export async function cleanup(rl: readline.Interface | null) {
  logger.info('🧹 Cleaning up...');
  if (rl) {
    rl.close();
  }
  await closeMemory();
}
