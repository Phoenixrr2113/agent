import fs from 'fs/promises';
import { cleanup } from '../initialization.js';
import { logger } from '../../core/logger.js';

export async function runOnceMode(
  agent: any,
  mcpClients: Record<string, any>,
  usedClients: Set<string>,
  codebaseRAG: any,
  rl: readline.Interface | null
) {
  await fs.mkdir('./logs', { recursive: true });

  const result = await agent.generate({
    prompt: 'You are a generic agent template. Ask the user what kind of agent they want you to become, then start building yourself for that purpose. Begin by assessing your current capabilities.',
  });

  logger.info(result.text);

  const timestamp = new Date().toISOString();
  await fs.appendFile('./logs/agent.log', `\n=== ${timestamp} ===\n${result.text}\n`);

  const logEntry = {
    timestamp,
    text: result.text,
    reasoningText: result.reasoningText,
    steps: result.steps.map((step: any) => ({
      text: step.text,
      toolCalls: step.toolCalls?.map((tc: any) => ({
        name: tc.toolName,
        args: tc.args,
      })),
      toolResults: step.toolResults?.map((tr: any) => ({
        name: tr.toolName,
        result: typeof tr.result === 'string' ? tr.result.substring(0, 200) : tr.result,
      })),
      finishReason: step.finishReason,
    })),
    usage: {
      ...result.totalUsage,
      reasoningTokens: result.usage.reasoningTokens,
    },
  };
  await fs.appendFile('./logs/iterations.jsonl', JSON.stringify(logEntry, null, 2) + '\n');

  logger.info('Re-indexing codebase after agent run...');
  await codebaseRAG.indexCodebase();
  const newStats = codebaseRAG.getStats();
  logger.info('RAG re-indexed', { chunks: newStats.totalChunks, files: newStats.files });

  cleanup(mcpClients, usedClients, rl);
}
