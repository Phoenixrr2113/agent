import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { createCodebaseRAG } from '../core/rag/index.js';
import { grepWorkspace } from '../core/search/grep.js';
import { logger } from '../core/logger.js';

import { shellTool } from '../tools/shell.js';
import { webSearchTool } from '../tools/web-search.js';
import { fetchPageTool } from '../tools/fetch-page.js';
import { memoryTools } from '../tools/memory.js';
import { planTool, validationTool } from '../tools/workflow.js';
import { createCodebaseTools } from '../tools/codebase.js';
import { createAgentTools } from '../tools/agent.js';

export interface InitializationConfig {
  workspaceRoot?: string;
  enableReadline?: boolean;
  enableRAG?: boolean;
}

export interface InitializationResult {
  tools: Record<string, any>;
  codebaseRAG: any;
  readline: readline.Interface | null;
}

export async function initializeAgent(config: InitializationConfig = {}): Promise<InitializationResult> {
  const {
    workspaceRoot = process.cwd(),
    enableReadline = false,
    enableRAG = true,
  } = config;

  let rl: readline.Interface | null = null;
  if (enableReadline) {
    rl = readline.createInterface({ input, output });
  }

  logger.info(`🤖 Initializing AI Agent`, { workspaceRoot });

  let codebaseRAG: any = null;
  if (enableRAG) {
    codebaseRAG = createCodebaseRAG(workspaceRoot);
    logger.info('Indexing codebase...');
    await codebaseRAG.indexCodebase();
    const ragStats = codebaseRAG.getStats();
    logger.info('RAG indexed', { chunks: ragStats.totalChunks, files: ragStats.files });
  }

  const codebaseTools = codebaseRAG
    ? createCodebaseTools(codebaseRAG, grepWorkspace, workspaceRoot)
    : {};
  const agentTools = createAgentTools(rl);

  const tools = {
    shell: shellTool,
    web_search: webSearchTool,
    fetch_page: fetchPageTool,
    ...memoryTools,
    plan: planTool,
    validate: validationTool,
    ...codebaseTools,
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
}
