/**
 * @agent/sdk - Spawn Agent Tool
 * Tool for spawning sub-agents with streaming output
 */

import { generateId } from 'ai';
import { z } from 'zod';

import { getSubAgentConfig, subAgentRoles } from '../../presets/sub-agent-configs';

export interface SpawnAgentOptions {
  /**
   * Maximum spawn depth to prevent infinite recursion
   * Sub-agents spawned by this tool will have depth-1
   */
  maxSpawnDepth?: number;

  /**
   * Current spawn depth (0 = main agent)
   */
  currentDepth?: number;

  /**
   * Agent factory function - must be provided to enable spawning
   * This is called to create the sub-agent instance
   */
  createAgent?: (options: {
    role: string;
    instructions?: string;
    tools?: string[];
    maxSpawnDepth?: number;
  }) => {
    stream: (input: { prompt: string }) => {
      fullStream: AsyncIterable<{ type: string; textDelta?: string }>;
      text: Promise<string>;
    };
  };

  /**
   * Optional callback for streaming sub-agent output
   * Called with each text delta chunk
   */
  onStream?: (data: SubAgentStreamData) => void;
}

export interface SubAgentStreamData {
  type: 'sub-agent-stream';
  agentId: string;
  role: string;
  text: string;
  status: 'streaming' | 'complete';
}

const DESCRIPTION = `Spawn a sub-agent for a specific task.

Use this tool when you need to delegate complex work that requires:
- Independent reasoning and decision-making
- Specialized role focus (coder, researcher, analyst)
- Autonomous task completion

The sub-agent will work independently and stream its output. You will receive a summary of the results.

Roles:
- coder: Code implementation specialist - best for writing, refactoring, debugging code
- researcher: Research specialist - best for gathering and synthesizing information
- analyst: Analysis specialist - best for data analysis and insights
- generic: General-purpose (default)

Note: Sub-agents cannot spawn their own sub-agents (prevents infinite recursion).`;

export const spawnAgentParametersSchema = z.object({
  task: z.string().describe('The task for the sub-agent to accomplish'),
  role: z.enum(subAgentRoles).default('generic').describe('The specialized role for the sub-agent'),
  context: z.string().optional().describe('Additional context to provide to the sub-agent'),
});

export type SpawnAgentInput = z.infer<typeof spawnAgentParametersSchema>;

export interface SpawnAgentResult {
  success: boolean;
  agentId?: string;
  role?: string;
  summary?: string;
  message?: string;
  error?: string;
  suggestion?: string;
}

/**
 * Execute function for spawn agent tool
 */
async function executeSpawnAgent(
  input: SpawnAgentInput,
  options: SpawnAgentOptions
): Promise<SpawnAgentResult> {
  const {
    maxSpawnDepth = 1,
    currentDepth = 0,
    createAgent,
    onStream,
  } = options;

  const { task, role, context } = input;

  // Prevent spawning if at max depth or no factory
  if (currentDepth >= maxSpawnDepth) {
    return {
      success: false,
      error: 'Maximum spawn depth reached. Sub-agents cannot spawn further sub-agents.',
      suggestion: 'Complete this task directly instead of delegating.',
    };
  }

  if (!createAgent) {
    return {
      success: false,
      error: 'Agent factory not configured. Sub-agent spawning is disabled.',
    };
  }

  const agentId = generateId();
  const roleConfig = getSubAgentConfig(role);

  // Build the sub-agent prompt
  const fullPrompt = context 
    ? `Context:\n${context}\n\nTask:\n${task}`
    : task;

  // Stream start event
  if (onStream) {
    onStream({
      type: 'sub-agent-stream',
      agentId,
      role,
      text: '',
      status: 'streaming',
    });
  }

  try {
    // Create and run the sub-agent
    const subAgent = createAgent({
      role,
      instructions: roleConfig.instructions,
      tools: roleConfig.tools,
      maxSpawnDepth: 0, // Sub-agents can't spawn further
    });

    const stream = subAgent.stream({ prompt: fullPrompt });

    // Stream sub-agent output
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'text-delta' && chunk.textDelta) {
        if (onStream) {
          onStream({
            type: 'sub-agent-stream',
            agentId,
            role,
            text: chunk.textDelta,
            status: 'streaming',
          });
        }
      }
    }

    // Get final result
    const result = await stream.text;

    // Stream completion event
    if (onStream) {
      onStream({
        type: 'sub-agent-stream',
        agentId,
        role,
        text: result,
        status: 'complete',
      });
    }

    // Return summary to parent context (not full output)
    const summary = result.length > 500 
      ? `${result.slice(0, 500)}...` 
      : result;

    return {
      success: true,
      agentId,
      role,
      summary,
      message: `Sub-agent (${role}) completed the task.`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Stream error event
    if (onStream) {
      onStream({
        type: 'sub-agent-stream',
        agentId,
        role,
        text: `Error: ${errorMessage}`,
        status: 'complete',
      });
    }

    return {
      success: false,
      agentId,
      role,
      error: errorMessage,
    };
  }
}

/**
 * Creates a spawn agent tool definition for use with AI SDK
 * 
 * @param options - Spawn options including depth limits, agent factory, and stream callback
 * @returns Tool definition object compatible with AI SDK
 */
export function createSpawnAgentTool(options: SpawnAgentOptions = {}) {
  return {
    description: DESCRIPTION,
    inputSchema: spawnAgentParametersSchema,
    execute: (input: SpawnAgentInput) => executeSpawnAgent(input, options),
  };
}

export default createSpawnAgentTool;
