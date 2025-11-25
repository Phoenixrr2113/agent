import type { CoreMessage } from 'ai';
import * as readline from 'readline/promises';
import fs from 'fs/promises';
import { cleanup } from '../initialization.js';
import { logger } from '../../core/logger.js';

export async function runLoopMode(
  agent: any,
  mcpClients: Record<string, any>,
  usedClients: Set<string>,
  codebaseRAG: any,
  rl: readline.Interface | null
) {
  await fs.mkdir('./logs', { recursive: true });

  logger.info('━'.repeat(60));
  logger.info('🤖 Generic Agent Template - Interactive Mode');
  logger.info('━'.repeat(60));
  logger.info('This is a self-building agent that can become whatever you need.');
  logger.info('It will assess its capabilities and build itself for your purpose.');
  logger.info('Type "exit" or "quit" to end the conversation');
  logger.info('━'.repeat(60));

  const conversationHistory: CoreMessage[] = [
    {
      role: 'user',
      content: 'You are a generic agent template. Ask the user what kind of agent they want you to become, then start building yourself for that purpose. Begin by assessing your current capabilities and asking the user what they need.',
    },
  ];

  async function chat() {
    let isFirstMessage = true;
    let shouldWaitForInput = true;

    while (true) {
      let userInput = '';

      if (shouldWaitForInput) {
        if (!isFirstMessage) {
          if (!rl) {
            logger.error('Readline interface not initialized');
            break;
          }
          userInput = await rl.question('👤 You: ');

          if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
            logger.info('👋 Goodbye!');
            cleanup(mcpClients, usedClients, rl);
            process.exit(0);
          }

          if (!userInput.trim()) {
            continue;
          }

          conversationHistory.push({
            role: 'user',
            content: userInput,
          });
        } else {
          isFirstMessage = false;
        }
      } else {
        logger.info('🔄 Agent working...');
      }

      logger.info('🤖 Agent:');

      try {
        const result = await agent.generate({
          messages: conversationHistory,
        });

        logger.info(result.text);
        conversationHistory.push(...result.response.messages);

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

        // Determine if we should wait for input
        const hasAskUser = result.steps.some((step: any) =>
          step.toolCalls?.some((tc: any) => tc.toolName === 'ask_user')
        );

        // Check if the text response looks like a JSON tool call (fallback for weak models)
        const text = result.text.trim();
        const looksLikeJsonTool = (text.startsWith('{') && text.endsWith('}')) ||
          (text.startsWith('```json') && text.includes('plan_tool'));

        // If the last step had no tool calls, it's likely a text response, so we wait.
        // If the last step had tool calls (and not ask_user), we continue automatically.
        const lastStep = result.steps[result.steps.length - 1];
        const lastStepHasTools = lastStep?.toolCalls && lastStep.toolCalls.length > 0;

        if (hasAskUser) {
          shouldWaitForInput = true;
        } else if (lastStepHasTools || looksLikeJsonTool) {
          shouldWaitForInput = false;
          if (looksLikeJsonTool) {
            logger.warn('⚠️  Model outputted JSON text instead of calling a tool. Continuing loop...');
          }
        } else {
          shouldWaitForInput = true;
        }

      } catch (error: any) {
        logger.error('❌ Error', { message: error.message });
        await fs.appendFile('./logs/agent.log', `\n=== ERROR ${new Date().toISOString()} ===\n${error.message}\n${error.stack}\n`);
        shouldWaitForInput = true; // Always wait on error
      }
    }
  }

  chat().catch(error => {
    logger.error('Fatal error', { error: error.message, stack: error.stack });
    cleanup(mcpClients, usedClients, rl);
    process.exit(1);
  });
}
