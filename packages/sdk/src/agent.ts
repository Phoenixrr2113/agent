/**
 * @agent/sdk - Core Agent Factory
 * 
 * Creates agents using AI SDK's ToolLoopAgent pattern.
 * Provides opinionated defaults for tools, roles, and streaming.
 */

import { generateId, ToolLoopAgent, stepCountIs } from 'ai';
import type { Tool, ToolSet } from 'ai';
import type { AgentOptions, AgentRole, ToolPreset } from './types/agent';
import { resolveModel } from './models';
import { roleConfigs, getRoleSystemPrompt } from './presets/roles';
import { createToolPreset, type ToolPresetLevel } from './presets/tools';
import { createSpawnAgentTool } from './tools/spawn-agent';

// ============================================================================
// Agent Instance Type
// ============================================================================

export interface Agent {
  /** Unique identifier for this agent instance */
  agentId: string;
  
  /** Role of this agent */
  role: AgentRole;
  
  /** Stream a response (returns the ToolLoopAgent's stream result) */
  stream: (input: { prompt: string }) => ReturnType<ToolLoopAgent['stream']>;
  
  /** Generate a non-streaming response */
  generate: (input: { prompt: string }) => ReturnType<ToolLoopAgent['generate']>;
  
  /** Get the underlying ToolLoopAgent instance */
  getToolLoopAgent: () => ToolLoopAgent;
  
  /** Get the system prompt */
  getSystemPrompt: () => string;
}

// ============================================================================
// Tool Building
// ============================================================================

function buildTools(options: AgentOptions, workspaceRoot: string): ToolSet {
  const { toolPreset = 'standard', tools = {}, enableTools, disableTools } = options;
  
  // Create preset tools using factory
  let allTools: ToolSet = createToolPreset(toolPreset as ToolPresetLevel, {
    workspaceRoot,
  }) as ToolSet;
  
  // Add custom tools
  Object.assign(allTools, tools);
  
  // Filter enabled tools
  if (enableTools?.length) {
    const enabledSet = new Set(enableTools);
    allTools = Object.fromEntries(
      Object.entries(allTools).filter(([name]) => enabledSet.has(name))
    ) as ToolSet;
  }
  
  // Remove disabled tools
  if (disableTools?.length) {
    for (const name of disableTools) {
      delete allTools[name];
    }
  }
  
  return allTools;
}

// ============================================================================
// Create Agent Factory
// ============================================================================

/**
 * Creates an agent with the given options.
 * 
 * @example
 * ```typescript
 * const agent = createAgent({
 *   role: 'coder',
 *   workspaceRoot: '/my/project',
 *   toolPreset: 'standard',
 * });
 * 
 * const result = await agent.generate({ prompt: 'Create a hello world function' });
 * console.log(result.text);
 * ```
 */
export function createAgent(options: AgentOptions = {}): Agent {
  const {
    role = 'generic',
    agentId = generateId(),
    systemPrompt,
    maxSteps = 10,
    enableSubAgents = false,
    workspaceRoot = process.cwd(),
  } = options;

  // Get role configuration
  const roleConfig = roleConfigs[role];
  
  // Resolve system prompt
  const finalSystemPrompt = systemPrompt ?? roleConfig.systemPrompt;
  
  // Resolve model
  const model = options.model ?? resolveModel({
    tier: roleConfig.recommendedModel as 'fast' | 'standard' | 'reasoning' | 'powerful',
    provider: options.modelProvider as 'openrouter' | 'ollama' | 'openai' | 'anthropic' | undefined,
    modelName: options.modelName,
  });

  // Build tools
  let tools = buildTools(options, workspaceRoot);
  
  // Add spawn_agent tool if enabled
  if (enableSubAgents) {
    const spawnTool = createSpawnAgentTool({
      maxSpawnDepth: options.maxSpawnDepth ?? 2,
      currentDepth: 0,
      createAgent: (subAgentOptions) => {
        const subAgent = createAgent({
          role: subAgentOptions.role as AgentRole,
          systemPrompt: subAgentOptions.instructions,
          enableSubAgents: false, // Prevent recursion
          workspaceRoot,
          maxSteps: subAgentOptions.maxSpawnDepth ?? 5,
        });
        return {
          stream: (input: { prompt: string }) => {
            const streamPromise = subAgent.stream(input);
            return {
              fullStream: (async function* () {
                const result = await streamPromise;
                for await (const chunk of result.fullStream) {
                  yield chunk;
                }
              })(),
              text: streamPromise.then(r => r.text),
            };
          },
        };
      },
    });
    tools = { ...tools, spawn_agent: spawnTool };
  }

  // Create the ToolLoopAgent
  const toolLoopAgent = new ToolLoopAgent({
    model,
    instructions: finalSystemPrompt,
    tools,
    stopWhen: stepCountIs(maxSteps),
  });

  // Create the agent instance
  const agent: Agent = {
    agentId,
    role,
    
    getToolLoopAgent: () => toolLoopAgent,
    getSystemPrompt: () => finalSystemPrompt,
    
    stream: (input) => {
      return toolLoopAgent.stream({ prompt: input.prompt });
    },
    
    generate: (input) => {
      return toolLoopAgent.generate({ prompt: input.prompt });
    },
  };

  return agent;
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function createCoderAgent(options: Omit<AgentOptions, 'role'> = {}): Agent {
  return createAgent({ ...options, role: 'coder' });
}

export function createResearcherAgent(options: Omit<AgentOptions, 'role'> = {}): Agent {
  return createAgent({ ...options, role: 'researcher' });
}

export function createAnalystAgent(options: Omit<AgentOptions, 'role'> = {}): Agent {
  return createAgent({ ...options, role: 'analyst' });
}

export default createAgent;
