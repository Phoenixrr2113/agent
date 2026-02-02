/**
 * @fileoverview Basic agent usage example.
 * Demonstrates core API for creating and using an agent.
 */

import { createAgent } from '@agent/sdk';

async function main() {
  // Create agent with standard tools
  const agent = createAgent({
    role: 'coder',
    toolPreset: 'standard',
    workspaceRoot: process.cwd(),
    maxSteps: 20,
  });

  // Simple generation
  console.log('=== Simple Generation ===');
  const result = await agent.generate({
    prompt: 'List the files in the current directory',
  });
  console.log('Result:', result.text);
  console.log('Steps:', result.steps.length);

  // Streaming
  console.log('\n=== Streaming ===');
  const stream = agent.stream({
    prompt: 'Read package.json and explain what this project does',
  });

  for await (const chunk of stream.fullStream) {
    switch (chunk.type) {
      case 'text-delta':
        process.stdout.write(chunk.textDelta);
        break;
      case 'tool-call':
        console.log(`\n[Tool: ${chunk.toolName}]`);
        break;
      case 'data-file-content':
        console.log(`\n[File streamed: ${chunk.data.path}]`);
        break;
    }
  }

  // Get final result
  const finalResult = await stream.finalResult;
  console.log('\n\nFinal result received');
}

main().catch(console.error);
