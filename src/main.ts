import 'dotenv/config';
import { initializeAgent, cleanup } from './application/initialization.js';
import { createAgent } from './application/orchestrator.js';
import { runLoopMode } from './application/modes/loop.js';
import { runOnceMode } from './application/modes/once.js';

const RUN_MODE = process.env.RUN_MODE || 'once';

console.log(`🤖 Starting agent in ${RUN_MODE} mode...\n`);

const { tools, mcpClients, usedClients, codebaseRAG, readline: rl } = await initializeAgent();

const agent = createAgent(tools);

process.on('SIGINT', () => {
  console.log('\n\n👋 Caught interrupt signal');
  cleanup(mcpClients, usedClients, rl);
  process.exit(0);
});

if (RUN_MODE === 'loop') {
  await runLoopMode(agent, mcpClients, usedClients, codebaseRAG, rl);
} else {
  await runOnceMode(agent, mcpClients, usedClients, codebaseRAG, rl);
}
