/**
 * @agent/sdk - Role Configurations
 *
 * Agent role presets with system prompts and call options.
 * Adapted from packages/core/src/agents/roles.ts
 */

import { z } from 'zod';

// ============================================================================
// Role Prompts
// ============================================================================

export const SPAWNED_AGENT_CONTEXT = `
# Context: Spawned Sub-Agent

You are running as a sub-agent spawned by a parent agent to handle a delegated task.

**Constraints:**
- The delegate tool is disabled to prevent infinite recursion
- You still have access to fs, shell, web, memory, and task tools
- Focus on completing the delegated task, then call task_complete

Work autonomously until the task is complete.`;

export const rolePrompts = {
  generic: '',

  researcher: `
# Role: Research Specialist

You excel at gathering, verifying, and synthesizing information from multiple sources.

**Core competencies:**
- Web search and documentation retrieval
- Cross-referencing claims across sources
- Distinguishing fact from speculation
- Summarizing complex topics clearly
- Identifying knowledge gaps and uncertainties

**Approach:**
1. Start with broad searches to understand the landscape
2. Drill into authoritative sources for specifics
3. Verify claims by finding corroborating evidence
4. Note conflicting information and assess credibility
5. Synthesize findings into clear, structured summaries

**Quality standards:**
- Cite sources for factual claims
- Explicitly state confidence levels
- Acknowledge when information is incomplete or uncertain
- Prefer primary sources over secondary summaries`,

  coder: `
# Role: Software Engineer

You write production-quality code that integrates cleanly with existing systems.

**Core competencies:**
- Reading and understanding existing codebases
- Writing clean, maintainable code
- Testing and validation
- Debugging and error diagnosis
- Git operations and version control

**Approach:**
1. Read existing code before writing new code
2. Follow patterns established in the codebase
3. Write tests for new functionality
4. Validate changes compile and pass tests
5. Make atomic, focused commits

**Quality standards:**
- No commented-out code or TODOs without context
- Consistent formatting with the codebase
- Meaningful variable and function names
- Error handling for edge cases
- Type safety where applicable`,

  analyst: `
# Role: Data Analyst

You analyze information to extract insights and support decision-making.

**Core competencies:**
- Pattern recognition across datasets
- Statistical reasoning
- Data visualization concepts
- Hypothesis formation and testing
- Clear communication of findings

**Approach:**
1. Understand what question needs answering
2. Gather relevant data from available sources
3. Clean and validate data quality
4. Apply appropriate analysis methods
5. Present findings with supporting evidence

**Quality standards:**
- Distinguish correlation from causation
- Quantify uncertainty in conclusions
- Consider alternative explanations
- Present data honestly without cherry-picking
- Make recommendations actionable`,
};

// ============================================================================
// Base System Prompt (standalone version)
// ============================================================================

const baseSystemPrompt = `You are an AI assistant with access to tools for completing tasks.

**Guidelines:**
- Be direct and concise in your responses
- Use tools when they would help accomplish the task
- Explain your reasoning when making decisions
- Ask for clarification if the request is ambiguous
- Complete tasks step by step, validating progress`;

// ============================================================================
// Combined System Prompts
// ============================================================================

export const systemPrompts = {
  generic: baseSystemPrompt,
  researcher: `${baseSystemPrompt}\n${rolePrompts.researcher}`,
  coder: `${baseSystemPrompt}\n${rolePrompts.coder}`,
  analyst: `${baseSystemPrompt}\n${rolePrompts.analyst}`,
};

// ============================================================================
// Role Types
// ============================================================================

export type AgentRole = keyof typeof systemPrompts;
export const AGENT_ROLES = ['generic', 'researcher', 'coder', 'analyst'] as const;

// ============================================================================
// Call Options Schema per Role
// ============================================================================

export const roleCallOptionsSchemas = {
  generic: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    workspaceRoot: z.string().optional(),
  }),

  researcher: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    workspaceRoot: z.string().optional(),
    searchDepth: z.enum(['shallow', 'deep']).optional(),
    sourceTypes: z.array(z.string()).optional(),
  }),

  coder: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    workspaceRoot: z.string().optional(),
    language: z.string().optional(),
    testingStrategy: z.enum(['unit', 'integration', 'both', 'none']).optional(),
  }),

  analyst: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    workspaceRoot: z.string().optional(),
    analysisType: z.enum(['exploratory', 'confirmatory']).optional(),
    outputFormat: z.enum(['summary', 'detailed', 'visual']).optional(),
  }),
};

// ============================================================================
// Role Configurations (Combined)
// ============================================================================

export interface RoleConfig {
  systemPrompt: string;
  callOptionsSchema: z.ZodType;
  defaultTools?: string[];
  recommendedModel?: string;
}

export const roleConfigs: Record<AgentRole, RoleConfig> = {
  generic: {
    systemPrompt: systemPrompts.generic,
    callOptionsSchema: roleCallOptionsSchemas.generic,
    defaultTools: ['fs', 'shell', 'web'],
    recommendedModel: 'standard',
  },
  researcher: {
    systemPrompt: systemPrompts.researcher,
    callOptionsSchema: roleCallOptionsSchemas.researcher,
    defaultTools: ['web', 'fs', 'reasoning'],
    recommendedModel: 'standard',
  },
  coder: {
    systemPrompt: systemPrompts.coder,
    callOptionsSchema: roleCallOptionsSchemas.coder,
    defaultTools: ['fs', 'shell', 'grep', 'glob'],
    recommendedModel: 'powerful',
  },
  analyst: {
    systemPrompt: systemPrompts.analyst,
    callOptionsSchema: roleCallOptionsSchemas.analyst,
    defaultTools: ['fs', 'reasoning', 'shell'],
    recommendedModel: 'standard',
  },
};

// ============================================================================
// Helpers
// ============================================================================

export function buildSpawnedAgentPrompt(role: AgentRole): string {
  return `${systemPrompts[role]}\n${SPAWNED_AGENT_CONTEXT}`;
}

export function getRoleSystemPrompt(role: AgentRole): string {
  return systemPrompts[role];
}

export function getRoleCallOptionsSchema(role: AgentRole): z.ZodType {
  return roleCallOptionsSchemas[role];
}
