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
import { logger, type StreamEvent } from '@agent/shared';

// logger.reconfigure({
//   level: 'info', // Silence info/debug logs to keep CLI output clean
//   logToConsole: true
// });

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

// State for display formatting
let currentContext: 'thought' | 'tool' | 'response' | 'start' = 'start';
let hasEmittedTool = false;

function handleStreamEvent(event: StreamEvent) {
  switch (event.type) {
    case 'text:delta': {
      if (currentContext === 'tool' || currentContext === 'start') {
        process.stdout.write('\n');
        
        // If we are just starting a step and haven't used a tool, it's thoughts.
        // If we have used a tool, it's a response (or further reasoning).
        const label = hasEmittedTool ? '🤖 Response:' : '🧠 Thought:';
        
        process.stdout.write(`\n\x1b[1m${label}\x1b[0m `);
        currentContext = hasEmittedTool ? 'response' : 'thought';
      }
      process.stdout.write((event.data as any).delta);
      break;
    }
    case 'reasoning:delta':
      if (currentContext !== 'thought') {
         process.stdout.write('\n\n\x1b[1m🧠 Reasoning:\x1b[0m ');
         currentContext = 'thought';
      }
      process.stdout.write(`\x1b[90m${(event.data as any).delta}\x1b[0m`);
      break;
    case 'tool:call': {
      hasEmittedTool = true;
      currentContext = 'tool';
      const data = event.data as any;
      process.stdout.write(`\n\x1b[36m🔧 ${data.toolName}\x1b[0m`);
      if (data.args) {
        const argsStr = JSON.stringify(data.args);
        const displayArgs = argsStr.length > 200 ? argsStr.slice(0, 200) + '...' : argsStr;
        process.stdout.write(` \x1b[90m${displayArgs}\x1b[0m`);
      }
      break;
    }
    case 'tool:result':
      process.stdout.write(` \x1b[32m✓\x1b[0m`);
      break;
    case 'step:start': {
      const data = event.data as any;
      process.stdout.write(`\n\x1b[90m--- Step ${data.stepIndex} ---\x1b[0m`);
      currentContext = 'start';
      hasEmittedTool = false; 
      break;
    }
    case 'step:finish':
      break;
    case 'complete':
      process.stdout.write('\n');
      break;
  }
}

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
    currentContext = 'start'; // Reset state for new turn
    hasEmittedTool = false;
    
    // Initial label logic is handled by the first event (usually step:start -> text:delta)
    
    const result = await session.sendWithEvents(userInput, handleStreamEvent);

    if (result.completed) {
      logger.info('\n✅ Task completed\n');
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
