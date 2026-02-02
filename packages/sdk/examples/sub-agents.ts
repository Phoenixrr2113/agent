/**
 * @fileoverview Sub-agents example.
 * Demonstrates spawning specialized sub-agents for complex tasks.
 */

import { createAgent } from '@agent/sdk';

async function main() {
  // Create coordinator agent with sub-agent capability
  const coordinator = createAgent({
    role: 'analyst',
    toolPreset: 'full',
    enableSubAgents: true,
    maxSpawnDepth: 3,
    workspaceRoot: process.cwd(),
    systemPrompt: `You are a project coordinator. 
For complex coding tasks, delegate to a coder sub-agent.
For research tasks, delegate to a researcher sub-agent.
Focus on planning and synthesis.`,
  });

  // The coordinator can spawn sub-agents via the spawn_agent tool
  const result = await coordinator.generate({
    prompt: `Analyze this codebase:
1. Have a coder review the main source files
2. Have a researcher find relevant documentation patterns
3. Synthesize their findings into recommendations`,
  });

  console.log('Coordinator Result:');
  console.log(result.text);
  console.log('\nSteps taken:', result.steps.length);

  // Access sub-agent results from steps
  for (const step of result.steps) {
    if (step.toolCalls) {
      for (const call of step.toolCalls) {
        if (call.toolName === 'spawn_agent') {
          console.log(`\nSub-agent spawned: ${call.args.role}`);
          console.log(`Task: ${call.args.task.slice(0, 100)}...`);
        }
      }
    }
  }
}

main().catch(console.error);
