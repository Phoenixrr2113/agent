import { logger } from '../../core/logger.js';
import { cleanup } from '../initialization.js';

export async function runOnceMode(
  agent: any,
  mcpClients: Record<string, any>,
  usedClients: Set<string>,
  codebaseRAG: any,
  rl: any
) {
  logger.info('🔄 Running single iteration...');

  try {
    const result = await agent.generate({
      prompt: 'You are a generic agent template. Ask the user what kind of agent they want you to become, then start building yourself for that purpose. Begin by assessing your current capabilities.',
    });

    console.log('\n📝 Agent Response:\n');
    console.log(result.text);

    const toolsUsed = [...new Set(
      result.steps.flatMap((step: any) =>
        step.toolCalls?.map((tc: any) => tc.toolName) || []
      )
    )];

    if (toolsUsed.length > 0) {
      logger.info('Tools used', { tools: toolsUsed.join(', ') });
    }

    const modifiedFiles = result.steps.some((step: any) =>
      step.toolCalls?.some((tc: any) =>
        ['write_file', 'edit_file', 'create_directory'].includes(tc.toolName)
      )
    );
    if (modifiedFiles) {
      logger.info('📚 Reindexing codebase...');
      await codebaseRAG.indexCodebase();
    }

  } catch (error) {
    logger.error('Agent error', { error: String(error) });
  } finally {
    cleanup(mcpClients, usedClients, rl);
  }
}
