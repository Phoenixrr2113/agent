import type { CoreMessage } from 'ai';
import type readline from 'readline/promises';
import { logger } from '../../core/logger.js';
import { cleanup } from '../initialization.js';

export async function runLoopMode(
  agent: any,
  mcpClients: Record<string, any>,
  usedClients: Set<string>,
  codebaseRAG: any,
  rl: readline.Interface | null
) {
  if (!rl) {
    logger.error('Readline interface required for loop mode');
    return;
  }

  let conversationHistory: CoreMessage[] = [];

  logger.info('💬 Interactive mode started. Type "exit" to quit.\n');

  while (true) {
    const userInput = await rl.question('👤 You: ');

    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      logger.info('👋 Goodbye!');
      break;
    }

    if (!userInput.trim()) {
      continue;
    }

    conversationHistory.push({ role: 'user', content: userInput });

    try {
      const result = await agent.generate({ messages: conversationHistory });

      conversationHistory = result.response.messages;

      const modifiedFiles = result.steps.some((step: any) =>
        step.toolCalls?.some((tc: any) =>
          ['write_file', 'edit_file', 'create_directory', 'move_file', 'rename_file'].includes(tc.toolName)
        )
      );
      if (modifiedFiles) {
        logger.info('📚 Reindexing codebase...');
        await codebaseRAG.indexCodebase();
      }

      if (result.text) {
        console.log(`\n🤖 Agent: ${result.text}\n`);
      }

      const toolsUsed = [...new Set(
        result.steps.flatMap((step: any) =>
          step.toolCalls?.map((tc: any) => tc.toolName) || []
        )
      )];

      if (toolsUsed.length > 0) {
        logger.info('🔧 Tools used', { tools: toolsUsed.join(', ') });
      }

      const completedTask = result.steps.some((step: any) =>
        step.toolCalls?.some((tc: any) => tc.toolName === 'task_complete')
      );

      if (completedTask) {
        logger.info('✅ Task marked complete');
      }

    } catch (error) {
      logger.error('Agent error', { error: String(error) });
      console.log('\n❌ An error occurred. Please try again.\n');
    }
  }

  cleanup(mcpClients, usedClients, rl);
}
