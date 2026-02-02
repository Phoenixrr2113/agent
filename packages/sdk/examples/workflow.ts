/**
 * @fileoverview Workflow integration example.
 * Demonstrates durable, resumable agent execution.
 */

import { createAgent } from '@agent/sdk';
// import { createDurableAgent } from '@agent/sdk/workflow';

async function basicWorkflow() {
  // Standard agent with durability enabled
  const agent = createAgent({
    role: 'coder',
    toolPreset: 'standard',
    durable: true,
    workspaceRoot: process.cwd(),
    workflowOptions: {
      enabled: true,
      // Tools marked as durable will be wrapped in workflow steps
    },
  });

  // When durable is true:
  // - Tool executions are wrapped in workflow "use step" directives
  // - Execution can resume from checkpoints on failure
  // - Results are persisted for crash recovery

  const result = await agent.generate({
    prompt: 'Refactor the utils.ts file to use async/await',
  });

  console.log('Completed with durability');
  console.log('Steps executed:', result.steps.length);
}

async function checkpointExample() {
  // Example: Custom checkpoint handling
  const agent = createAgent({
    role: 'coder',
    durable: true,
    workflowOptions: {
      enabled: true,
      onCheckpoint: async (stepId, state) => {
        console.log(`Checkpoint: Step ${stepId}`);
        // Custom persistence logic here
      },
      onResume: async (stepId) => {
        console.log(`Resuming from step ${stepId}`);
        // Return persisted state if available
        return null;
      },
    },
  });

  await agent.generate({ prompt: 'Complex multi-step task...' });
}

async function main() {
  console.log('=== Basic Workflow ===');
  await basicWorkflow();

  console.log('\n=== Checkpoint Example ===');
  await checkpointExample();
}

main().catch(console.error);
