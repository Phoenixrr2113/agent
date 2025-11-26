import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { createCodebaseRAG } from '../core/rag/index.js';
import { grepWorkspace } from '../core/search/grep.js';
import { logger } from '../core/logger.js';

import { shellTool } from '../tools/shell.js';
import { webSearchTool } from '../tools/web-search.js';
import { fetchPageTool } from '../tools/fetch-page.js';
import { memoryTools, closeMemory } from '../tools/memory.js';
import { planTool, validationTool } from '../tools/workflow.js';
import { createCodebaseTools } from '../tools/codebase.js';
import { createAgentTools } from '../tools/agent.js';

export interface InitializationConfig {
  workspaceRoot?: string;
  enableReadline?: boolean;
}

export interface InitializationResult {
  tools: Record<string, any>;
  codebaseRAG: any;
  readline: readline.Interface | null;
}

export async function initializeAgent(config: InitializationConfig = {}): Promise<InitializationResult> {
  const { workspaceRoot, enableReadline = false } = config;

  let rl: readline.Interface | null = null;
  if (enableReadline) {
    rl = readline.createInterface({ input, output });
  }

  logger.info(`🤖 Initializing AI Agent`, { workspaceRoot: workspaceRoot || '(none)' });

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
    ? {
        ...createCodebaseTools(codebaseRAG, grepWorkspace, workspaceRoot),
        validate: validationTool,
      }
    : {};
  const agentTools = createAgentTools(rl);

  const tools = {
    shell: shellTool,
    web_search: webSearchTool,
    fetch_page: fetchPageTool,
    ...memoryTools,
    plan: planTool,
    ...workspaceTools,
    ...agentTools,
  };

  logger.info('Total tools', { count: Object.keys(tools).length });

  return {
    tools,
    codebaseRAG,
    readline: rl,
  };
}

export async function cleanup(rl: readline.Interface | null) {
  logger.info('🧹 Cleaning up...');
  if (rl) {
    rl.close();
  }
  await closeMemory();
}
