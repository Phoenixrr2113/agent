import 'dotenv/config';
import { createAgentRuntime } from './runtime/agent-runtime.js';
import { logger } from './core/logger.js';

console.log('\n🤖 Autonomous Development Mode\n');

const runtime = await createAgentRuntime({
  // No askUserHandler = auto-approve by default
});

const session = runtime.createSession();

// Run a development task
const result = await session.send(
  'Review the codebase and identify any improvements or issues that need attention.'
);

if (result.text) {
  console.log(`\n🤖 Agent: ${result.text}\n`);
}

if (result.completed) {
  console.log('✅ Task completed\n');
}

if (result.toolsUsed.length > 0) {
  logger.info('🔧 Tools used', { tools: result.toolsUsed.join(', ') });
}

await runtime.shutdown();
