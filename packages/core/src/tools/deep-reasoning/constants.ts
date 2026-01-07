/**
 * Deep reasoning tool constants
 */

export const DEEP_REASONING_DESCRIPTION = `Think through complex problems step-by-step with deep reasoning. 
Use when you need to analyze, debug, or understand something before acting.

When to use:
- Complex debugging or troubleshooting
- Architectural decisions
- Understanding unfamiliar code
- Multi-step problem solving
- When you need to think before acting

How to use:
Call repeatedly with your reasoning steps. Each call records one thought.
- thought: Your current reasoning step - one clear idea or observation
- thoughtNumber: Current step number (1, 2, 3...)
- totalThoughts: Estimate of steps needed (adjustable as you go)
- nextThoughtNeeded: true to continue reasoning, false when done

Advanced features:
- isRevision + revisesThought: Reconsider an earlier thought
- branchFromThought + branchId: Explore alternative reasoning paths

You can use other tools between thoughts to gather information.
NOT for task tracking—use plan tool for that.`;

export const DEFAULT_MAX_HISTORY = 1000;
export const DEFAULT_MAX_BRANCH_SIZE = 100;

/**
 * When enabled, the agent uses unlimited step reasoning by default
 */
export const UNRESTRICTED_MODE_DESCRIPTION = `Deep reasoning mode is ENABLED. 
You have unlimited thinking steps - use as many as needed to fully analyze the problem.
There are no step restrictions. Think deeply and thoroughly.`;
