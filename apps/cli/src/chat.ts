import 'dotenv/config';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { createAgentRuntime } from '@agent/core';
import { logger } from '@agent/shared';

console.log('\n💬 Interactive Chat Mode\n');
console.log('Type your requests or "exit" to quit\n');

const rl = readline.createInterface({ input, output });

const workspaceRoot = process.env.WORKSPACE_ROOT || process.argv[2];

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
    console.log('\n\n👋 Shutting down...');
    rl.close();
    await runtime.shutdown();
    process.exit(0);
  })();
});

while (true) {
  const userInput = await rl.question('👤 You: ');

  if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
    console.log('\n👋 Goodbye!\n');
    break;
  }

  if (!userInput.trim()) {
    continue;
  }

  try {
    const result = await session.send(userInput);

    if (result.text) {
      console.log(`\n🤖 Agent: ${result.text}\n`);
    }

    if (result.completed) {
      console.log('✅ Task completed\n');
    }

    if (result.toolsUsed.length > 0) {
      logger.info('🔧 Tools used', { tools: result.toolsUsed.join(', ') });
    }
  } catch (error) {
    logger.error('❌ Error', { error: String(error) });
    console.log('\n❌ An error occurred. Please try again.\n');
  }
}

rl.close();
await runtime.shutdown();
