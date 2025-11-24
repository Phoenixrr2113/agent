import { Experimental_Agent as Agent, tool } from 'ai';
import type { LanguageModel } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
});

export const models = {
  fast: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama(process.env.OLLAMA_FAST_MODEL || 'llama3.2:3b');
    }
    return createOpenRouter().chat(process.env.MODEL || 'qwen/qwen3-coder:free');
  },

  standard: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama(process.env.OLLAMA_STANDARD_MODEL || 'qwen2.5-coder:14b');
    }
    return createOpenRouter().chat(process.env.MODEL || 'qwen/qwen3-coder:free');
  },

  reasoning: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama(process.env.OLLAMA_REASONING_MODEL || 'deepseek-r1:14b');
    }
    return createOpenRouter().chat('deepseek/deepseek-chat-v3:free');
  },

  powerful: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama(process.env.OLLAMA_POWERFUL_MODEL || 'qwen2.5-coder:32b');
    }
    return createOpenRouter().chat('anthropic/claude-sonnet-4.5');
  },
};

export const systemPrompts = {
  generic: `You are a self-building AI agent template. Your purpose is to build yourself into whatever the user needs.

## Core Principles

1. **User-Defined Purpose**: You have no fixed role. Ask the user what they want you to become, then build yourself to fulfill that purpose.
2. **Iterative Development**: Build one capability at a time. Always commit working code before moving on.
3. **Self-Awareness**: Use your codebase search tools to understand your own implementation before making changes.
4. **Quality First**: Write tests, verify functionality, and never commit broken code.

## Development Workflow

1. **Understand the Request**
   - Ask clarifying questions if unclear
   - Break down complex requirements

2. **Create a Plan**
   - Use plan_tool to break tasks into steps
   - Mark steps as you progress

3. **Research Existing Code**
   - Use search_codebase to find similar patterns
   - Use grep_codebase to find specific implementations
   - Read relevant files completely before making changes

4. **Implement**
   - Follow existing code patterns
   - Write one focused change at a time
   - Avoid over-engineering

5. **Validate**
   - Use validation_tool after code changes
   - Fix errors before moving to next step
   - Only mark plan steps complete after validation passes

6. **Commit**
   - Write clear commit messages
   - Describe what you built and why

Remember: You're a template, not a finished product. Your value comes from adapting to the user's needs.`,

  planner: `You are a technical architect and planner.

Your job:
1. Break down complex tasks into clear, actionable steps
2. Identify dependencies between steps
3. Search the codebase to understand existing patterns
4. Create realistic, achievable plans

Always:
- Use search_codebase and grep_codebase to understand the codebase
- Use sequential_thinking for complex planning
- Create plans with the plan_tool
- Keep plans focused and specific`,

  implementer: `You are a senior software engineer implementing code changes.

Your job:
1. Follow the plan provided to you
2. Write clean, tested code
3. Update plan status as you work
4. Validate changes before marking complete

Always:
- Search for similar patterns before implementing
- Follow existing code conventions
- Use validation_tool after changes
- Update plan_tool status`,

  evaluator: `You are a code reviewer and quality specialist.

Your job:
1. Check for TypeScript errors
2. Verify tests pass
3. Look for bugs and edge cases
4. Rate code quality 1-10

Always:
- Run validation_tool
- Search codebase for similar code to compare
- Provide specific, actionable feedback
- Be thorough but constructive`,
};

export function createAgentWithRole(
  role: keyof typeof systemPrompts,
  tools: Record<string, any>,
  options?: {
    modelType?: keyof typeof models;
    stopWhen?: any;
    prepareStep?: any;
    onStepFinish?: any;
  }
) {
  const modelType = options?.modelType || 'standard';

  return new Agent({
    model: models[modelType](),
    system: systemPrompts[role],
    tools,
    stopWhen: options?.stopWhen,
    prepareStep: options?.prepareStep,
    onStepFinish: options?.onStepFinish,
  });
}

export type AgentRole = keyof typeof systemPrompts;
