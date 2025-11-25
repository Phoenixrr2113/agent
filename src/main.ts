import 'dotenv/config';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { createAgentRuntime } from './runtime/agent-runtime.js';
import { logger } from './core/logger.js';

const RUN_MODE = process.env.RUN_MODE || 'once';

logger.info(`🤖 Starting agent in ${RUN_MODE} mode`);

const rl = readline.createInterface({ input, output });

const runtime = await createAgentRuntime({
  askUserHandler: async (question: string) => {
    logger.info('🤔 Agent asks', { question });
    const answer = await rl.question('👤 Your response: ');
    return answer;
  },
});

const session = runtime.createSession();

process.on('SIGINT', async () => {
  console.log('\n\n👋 Caught interrupt signal');
  rl.close();
  await runtime.shutdown();
  process.exit(0);
});

if (RUN_MODE === 'loop') {
  console.log('\n💬 Interactive mode. Type "exit" to quit.\n');

  while (true) {
    const userInput = await rl.question('👤 You: ');

    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      break;
    }

    if (!userInput.trim()) {
      continue;
    }

    const result = await session.send(userInput);

    if (result.text) {
      console.log(`\n🤖 Agent: ${result.text}\n`);
    }

    if (result.completed) {
      console.log('✅ Task completed\n');
    }

    if (result.toolsUsed.length > 0) {
      logger.info('Tools used', { tools: result.toolsUsed.join(', ') });
    }
  }
} else {
  const result = await session.send(
    'Analyze this codebase and suggest improvements.'
  );
  console.log(result.text);
}

rl.close();
await runtime.shutdown();
