#!/usr/bin/env tsx

import 'dotenv/config';
import { readFileSync } from 'fs';
import { createAgentRuntime } from '../src/runtime/agent-runtime.js';
import { logger } from '../src/core/logger.js';

const promptFile = process.argv[2];

if (!promptFile) {
  console.error('Usage: npm run test-agent <prompt-file>');
  console.error('Example: npm run test-agent tests/prompts/research-task.txt');
  process.exit(1);
}

let promptText: string;
try {
  promptText = readFileSync(promptFile, 'utf-8').trim();
} catch (error) {
  console.error(`Failed to read prompt file: ${promptFile}`);
  console.error(error);
  process.exit(1);
}

if (!promptText) {
  console.error('Prompt file is empty');
  process.exit(1);
}

console.log('\n🧪 Agent Test Runner\n');
console.log('━'.repeat(80));
console.log('📄 Prompt File:', promptFile);
console.log('📝 Prompt Length:', promptText.length, 'characters');
console.log('━'.repeat(80));
console.log('\n📋 PROMPT:\n');
console.log(promptText);
console.log('\n' + '━'.repeat(80) + '\n');

const workspaceRoot = process.env.WORKSPACE_ROOT || process.argv[3];

const runtime = await createAgentRuntime({
  workspaceRoot,
  askUserHandler: async (question: string) => {
    logger.warn('⚠️  Agent requested user input but running in non-interactive mode');
    logger.info('Question:', { question });
    return 'Please proceed with your best judgment.';
  },
});

const session = runtime.createSession();

console.log('🤖 Starting agent execution...\n');
const startTime = Date.now();

try {
  const result = await session.send(promptText);

  const duration = Date.now() - startTime;
  const durationSec = (duration / 1000).toFixed(2);

  console.log('\n' + '━'.repeat(80));
  console.log('✅ AGENT RESPONSE:\n');
  console.log(result.text);
  console.log('\n' + '━'.repeat(80));
  console.log('\n📊 EXECUTION SUMMARY:\n');
  console.log('⏱️  Duration:', durationSec, 'seconds');
  console.log('🔧 Tools Used:', result.toolsUsed.length > 0 ? result.toolsUsed.join(', ') : 'None');
  console.log('📈 Steps:', result.stepsUsed);
  console.log('✓  Completed:', result.completed ? 'Yes' : 'No');
  console.log('❓ Needs Input:', result.needsInput ? 'Yes' : 'No');
  
  if (result.pendingQuestion) {
    console.log('💬 Pending Question:', result.pendingQuestion);
  }

  console.log('\n' + '━'.repeat(80) + '\n');

} catch (error) {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
} finally {
  await runtime.shutdown();
}

