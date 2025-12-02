
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import { createAgentRuntime } from '@agent/core';
import { logger } from '@agent/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

logger.reconfigure();

async function runTest() {
  const promptFile = process.argv[2];

  if (!promptFile) {
    console.error('Please provide a prompt file path');
    process.exit(1);
  }

  try {
    const promptPath = resolve(process.cwd(), promptFile);
    const promptContent = await fs.readFile(promptPath, 'utf-8');

    console.log('\n🧪 Agent Test Runner\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📄 Prompt File: ${promptFile}`);
    console.log(`📝 Prompt Length: ${promptContent.length} characters`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 PROMPT:\n');
    console.log(promptContent);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🤖 Starting agent execution...\n');

    const runtime = await createAgentRuntime({
      workspaceRoot: process.cwd(),
      askUserHandler: async (question: string) => {
        logger.info('🤔 Agent asks', { question });
        return 'This is a non-interactive test. Please proceed with the best possible action based on the initial prompt.';
      },
    });

    const session = runtime.createSession();
    const startTime = Date.now();

    const result = await session.send(promptContent);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ AGENT RESPONSE:\n');
    console.log(result.text);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 EXECUTION SUMMARY:\n');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`🔧 Tools Used: ${result.toolsUsed.join(', ') || 'None'}`);
    console.log(`✓  Completed: ${result.completed ? 'Yes' : 'No'}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await runtime.shutdown();

  } catch (error) {
    console.error('Error running test:', error);
    process.exit(1);
  }
}

runTest();
