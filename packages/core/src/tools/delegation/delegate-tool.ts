import { tool } from 'ai';
import { z } from 'zod';

import { logger } from '@agent/shared';
import { success, error } from '../utils/tool-result.js';
import { ToolError, ToolErrorType } from '../middleware/index.js';
import { getChainExecutor } from '../chaining/tools.js';
import { getPersistentTaskManager } from '../background-tasks/task-manager.js';
import type { ChainStep } from '../chaining/types.js';

const DESCRIPTION = `A unified tool for delegating work to sub-agents, tool chains, or background tasks.
Use this when a task is too complex for direct execution, requires parallel work, or needs to run asynchronously.

When to use this tool:
- Complex multi-step tasks that benefit from planning before execution
- Work that should run in the background while you continue other tasks
- Tasks that need a specialized sub-agent (coder, researcher, analyst)
- Parallel operations that can execute independently

When NOT to use this tool:
- Simple single-tool operations (just call the tool directly)
- Quick read/write/search operations (use fs tool)
- Anything you can do in 2-3 tool calls

Actions:
- steps: Plan and execute a sequence of tool calls (chain). Best for 3-10 related operations.
- agent: Spawn an autonomous sub-agent for complex tasks requiring independent reasoning.
- background: Start a shell command that runs in the background (for long-running processes).

Action-specific guidance:

## steps (Tool Chaining)
Plans and executes multiple tool calls in sequence. Use for:
- Multi-file operations (read A, modify B based on A, write C)
- Search-then-act patterns (glob files, then read matching ones)
- Any workflow with clear step dependencies

Key features:
- Results from earlier steps are available to later steps via $stepId
- Error handling: retry, skip, or abort on failure
- Max 20 steps per chain (break larger workflows into multiple chains)

## agent (Sub-Agent Spawning)
Spawns a detached sub-agent that works autonomously. Use for:
- Tasks requiring deep research or analysis
- Code generation/refactoring with multiple decisions
- Work that takes many steps with uncertain outcomes

Roles:
- coder: Specialized for code tasks
- researcher: Optimized for gathering and synthesizing information
- analyst: Focused on data analysis and insights
- generic: General-purpose (default)

Note: Sub-agents run in background processes. Use the \`task\` tool to check status/output.

## background (Background Shell)
Runs a shell command in the background. Use for:
- Dev servers (npm run dev, python -m http.server)
- Long-running builds
- Processes you need to monitor over time

Note: Returns a taskId. Use \`task\` tool to check status, get output, or cancel.

Parameters explained:
- action: Required. One of: steps, agent, background
- goal: For steps action. Describes what the chain accomplishes.
- steps: For steps action. Array of tool calls to execute in sequence.
- task: For agent action. The task description for the sub-agent.
- role: For agent action. Optional role specialization.
- command: For background action. Shell command to execute.
- cwd: For background action. Working directory.

You should:
1. Use 'steps' for deterministic multi-tool workflows
2. Use 'agent' only when the task needs autonomous reasoning
3. Use 'background' for processes that need to keep running
4. Check task status before assuming completion
5. Keep chain steps under 10 for reliability`;

const delegateInputSchema = z.object({
  action: z.enum(['steps', 'agent', 'background']).describe('Type of delegation'),
  
  goal: z.string().optional().describe('For steps: what the chain accomplishes'),
  steps: z.array(z.object({
    id: z.string().describe('Unique step identifier'),
    tool: z.string().describe('Tool name to execute'),
    args: z.record(z.unknown()).describe('Arguments to pass to the tool'),
    dependsOn: z.array(z.string()).optional().describe('Step IDs whose results this step needs'),
    onError: z.enum(['retry', 'skip', 'abort']).optional().describe('Error handling (default: abort)'),
    maxRetries: z.number().optional().describe('Max retry attempts (default: 1)'),
  })).optional().describe('For steps: array of tool calls'),

  task: z.string().optional().describe('For agent: task description for sub-agent'),
  role: z.enum(['coder', 'researcher', 'analyst', 'generic']).optional().describe('For agent: role specialization'),
  maxSteps: z.number().optional().describe('For agent: max reasoning steps (default: 50)'),

  command: z.string().optional().describe('For background: shell command to run'),
  cwd: z.string().optional().describe('For background: working directory'),
});

export function createDelegateTool(workspaceRoot: string) {
  return tool({
    description: DESCRIPTION,
    inputSchema: delegateInputSchema,
    execute: async (input) => {
      const { action } = input;

      switch (action) {
        case 'steps': {
          const { goal, steps } = input;
          
          if (!goal) {
            throw new ToolError('goal is required for steps action', ToolErrorType.INVALID_INPUT);
          }
          if (!steps || steps.length === 0) {
            throw new ToolError('steps array is required and must not be empty', ToolErrorType.INVALID_INPUT);
          }
          if (steps.length > 20) {
            return error('Chain too large. Maximum 20 steps. Break into multiple chains or use agent action.', {
              stepsProvided: steps.length,
            });
          }

          const executor = getChainExecutor();
          if (!executor) {
            return error('Chain executor not initialized');
          }

          const chain = executor.createChain(goal, steps as ChainStep[]);
          
          const result = await executor.executeChain(chain.id);

          if (result.status === 'complete') {
            return success({
              status: 'complete',
              chainId: chain.id,
              stepsCompleted: result.completedSteps.length,
              results: result.completedSteps.map(s => ({
                stepId: s.stepId,
                tool: s.tool,
                result: s.result,
                durationMs: s.durationMs,
              })),
              totalDurationMs: result.totalDurationMs,
            });
          }

          return success({
            status: 'error',
            chainId: chain.id,
            stepsCompleted: result.completedSteps.length,
            completedResults: result.completedSteps.map(s => ({
              stepId: s.stepId,
              tool: s.tool,
              result: s.result,
            })),
            failedStep: result.failedStep ? {
              stepId: result.failedStep.stepId,
              tool: result.failedStep.tool,
              error: result.failedStep.error,
            } : undefined,
            remainingSteps: result.remainingSteps,
            recommendation: 'Review the error. Options: retry with modified args, skip the step, or take alternative action.',
          });
        }

        case 'agent': {
          const { task: agentTask, role = 'generic', maxSteps = 50 } = input;
          
          if (!agentTask) {
            throw new ToolError('task is required for agent action', ToolErrorType.INVALID_INPUT);
          }

          const taskManager = getPersistentTaskManager();
          
          const subAgentScript = `
const { createAgent } = require('@agent/core');
const agent = createAgent({ 
  workspaceRoot: '${workspaceRoot}',
  role: '${role}',
  maxSteps: ${maxSteps}
});
agent.run('${agentTask.replace(/'/g, "\\'")}').catch(console.error);
`;

          const taskId = taskManager.startTask(
            `node -e "${subAgentScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
            workspaceRoot
          );

          logger.info(`Spawned sub-agent`, { taskId, role, task: agentTask.slice(0, 100) });

          return success({
            taskId,
            type: 'sub-agent',
            role,
            message: `Sub-agent spawned to work on: ${agentTask.slice(0, 100)}...`,
            hint: 'Use task tool with action: status to check progress',
          });
        }

        case 'background': {
          const { command, cwd } = input;
          
          if (!command) {
            throw new ToolError('command is required for background action', ToolErrorType.INVALID_INPUT);
          }

          const taskManager = getPersistentTaskManager();
          
          const taskId = taskManager.startTask(command, cwd || workspaceRoot);

          logger.info(`Started background task`, { taskId, command: command.slice(0, 50) });

          return success({
            taskId,
            type: 'background-shell',
            command,
            message: 'Background task started',
            hint: 'Use task tool with action: status to check progress, action: output to get logs',
          });
        }

        default:
          throw new ToolError(`Unknown action: ${action}`, ToolErrorType.INVALID_INPUT);
      }
    },
  });
}
