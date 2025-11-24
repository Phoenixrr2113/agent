import type { CoreMessage } from 'ai';
import * as readline from 'readline/promises';
import fs from 'fs/promises';
import { cleanup } from '../initialization.js';

export async function runLoopMode(
  agent: any,
  mcpClients: Record<string, any>,
  usedClients: Set<string>,
  codebaseRAG: any,
  rl: readline.Interface | null
) {
  await fs.mkdir('./logs', { recursive: true });

  console.log('━'.repeat(60));
  console.log('🤖 Generic Agent Template - Interactive Mode');
  console.log('━'.repeat(60));
  console.log('This is a self-building agent that can become whatever you need.');
  console.log('It will assess its capabilities and build itself for your purpose.');
  console.log('\nType "exit" or "quit" to end the conversation');
  console.log('━'.repeat(60) + '\n');

  const conversationHistory: CoreMessage[] = [
    {
      role: 'user',
      content: 'You are a generic agent template. Ask the user what kind of agent they want you to become, then start building yourself for that purpose. Begin by assessing your current capabilities and asking the user what they need.',
    },
  ];

  async function chat() {
    let isFirstMessage = true;

    while (true) {
      let userInput = '';

      if (!isFirstMessage) {
        if (!rl) {
          console.error('Readline interface not initialized');
          break;
        }
        userInput = await rl.question('👤 You: ');

        if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
          console.log('\n👋 Goodbye!');
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

      console.log('\n🤖 Agent: ');

      try {
        const result = await agent.generate({
          messages: conversationHistory,
        });

        console.log(result.text);
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

        console.log('\n');
      } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        await fs.appendFile('./logs/agent.log', `\n=== ERROR ${new Date().toISOString()} ===\n${error.message}\n${error.stack}\n`);
        console.log('\n');
      }
    }
  }

  chat().catch(error => {
    console.error('Fatal error:', error);
    cleanup(mcpClients, usedClients, rl);
    process.exit(1);
  });
}
