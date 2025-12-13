import { dirname } from 'node:path';
import { resolve } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

import { createAgentRuntime } from '@agent/core';
import { logger } from '@agent/shared';

logger.reconfigure();

logger.info('\n💬 Interactive Chat Mode\n');
logger.info('Type your requests or "exit" to quit\n');

const rl = readline.createInterface({ input, output });

const workspaceRoot = process.env['WORKSPACE_ROOT'] ?? process.argv[2] ?? process.cwd();

const runtime = await createAgentRuntime({
  workspaceRoot,
  askUserHandler: async (question: string) => {
    logger.info('🤔 Agent asks', { question });
    const answer = await rl.question('👤 Your response: ');
    return answer;
  },
});

const session = runtime.createSession();

process.on('SIGINT', () => {
  void (async () => {
    logger.info('\n\n👋 Shutting down...');
    rl.close();
    await runtime.shutdown();
    process.exit(0);
  })();
});

while (true) {
  const userInput = await rl.question('👤 You: ');

  if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
    logger.info('\n👋 Goodbye!\n');
    break;
  }

  if (!userInput.trim()) {
    continue;
  }

  try {
    const result = await session.send(userInput);

    if (result.text) {
      logger.info(`\n🤖 Agent: ${result.text}\n`);
    }

    if (result.completed) {
      logger.info('✅ Task completed\n');
    }

    if (result.toolsUsed.length > 0) {
      logger.info('🔧 Tools used', { tools: result.toolsUsed.join(', ') });
    }
  } catch (error) {
    logger.error('❌ Error', { error: String(error) });
    logger.info('\n❌ An error occurred. Please try again.\n');
  }
}

rl.close();
await runtime.shutdown();
