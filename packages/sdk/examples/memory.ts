/**
 * @fileoverview Memory integration example.
 * Demonstrates semantic memory for context persistence.
 */

import { createAgent } from '@agent/sdk';

async function main() {
  // Create agent with memory enabled
  const agent = createAgent({
    role: 'researcher',
    toolPreset: 'full',
    enableMemory: true,
    memoryOptions: {
      vectorStore: 'vectra',  // Local vector store
      embeddingModel: 'text-embedding-3-small',
      maxResults: 5,
    },
    workspaceRoot: process.cwd(),
  });

  // First conversation - store information
  console.log('=== First Conversation ===');
  const result1 = await agent.generate({
    prompt: `Research the authentication patterns in this codebase.
Store important findings in memory for future reference.`,
  });
  console.log(result1.text);

  // Later conversation - recall from memory
  console.log('\n=== Later Conversation ===');
  const result2 = await agent.generate({
    prompt: `What authentication patterns were found earlier?
Use memory to recall previous research.`,
  });
  console.log(result2.text);

  // Memory tools available:
  // - memory_store: Store information semantically
  // - memory_recall: Retrieve relevant memories
  // - memory_forget: Remove memories matching a query
}

// Example: Custom memory configuration
async function customMemory() {
  const agent = createAgent({
    enableMemory: true,
    memoryOptions: {
      vectorStore: 'vectra',
      indexPath: './my-memory-index',  // Custom storage location
      dimensions: 1536,
      maxResults: 10,
      minSimilarity: 0.7,  // Only return highly relevant results
    },
  });

  // Agent can now store and recall semantic memories
  await agent.generate({
    prompt: 'Remember that the API uses JWT tokens for auth',
  });

  const recall = await agent.generate({
    prompt: 'What do we know about authentication?',
  });
  console.log(recall.text);
}

main().catch(console.error);
