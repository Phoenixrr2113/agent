/**
 * @agent/sdk - Sub-Agent Role Configurations
 * Predefined configurations for specialized sub-agent roles
 */

import type { SubAgentConfig } from '../types/agent';

/**
 * Sub-agent role configurations with specialized prompts, tools, and models
 */
export const subAgentConfigs: Record<string, SubAgentConfig> = {
  coder: {
    instructions: `You are a code implementation specialist. Your focus areas:
- Writing clean, maintainable code
- Following existing patterns in the codebase
- Making minimal, targeted changes
- Running tests to verify changes work

Always read relevant code before making changes. Match the existing style.
Be thorough but efficient. Don't over-engineer simple tasks.`,
    tools: ['filesystem', 'shell', 'grep', 'glob'],
    model: 'anthropic/claude-sonnet-4',
  },

  researcher: {
    instructions: `You are a research specialist. Your focus areas:
- Gathering comprehensive information on topics
- Evaluating source credibility
- Synthesizing findings into clear summaries
- Identifying key insights and patterns

Be thorough but efficient. Focus on actionable information.
Cite sources and provide confidence levels for findings.`,
    tools: ['web'],
    model: 'google/gemini-2.0-flash-001',
  },

  analyst: {
    instructions: `You are an analysis specialist. Your focus areas:
- Breaking down complex problems
- Identifying patterns and relationships
- Evaluating trade-offs and options
- Providing data-driven recommendations

Be systematic and logical. Support conclusions with evidence.
Present findings clearly with actionable insights.`,
    tools: ['filesystem', 'reasoning'],
    model: 'anthropic/claude-sonnet-4',
  },

  generic: {
    instructions: `You are a general-purpose assistant. Adapt your approach to the task at hand.
Use tools fluidly as part of your reasoning process.
Be autonomous but ask for clarification when genuinely uncertain.`,
    tools: ['filesystem', 'shell', 'web', 'grep', 'glob'],
    model: 'anthropic/claude-sonnet-4',
  },
};

/**
 * Get configuration for a specific sub-agent role
 */
export function getSubAgentConfig(role: string): SubAgentConfig {
  return subAgentConfigs[role] ?? subAgentConfigs.generic;
}

/**
 * Available sub-agent roles
 */
export const subAgentRoles = ['coder', 'researcher', 'analyst', 'generic'] as const;
export type SubAgentRole = typeof subAgentRoles[number];
