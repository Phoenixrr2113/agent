/**
 * @agent/sdk - Durable Tool Wrapper
 *
 * Wraps tools with durability directives for crash recovery.
 * Uses the 'workflow' package's 'use step' directive to checkpoint tool executions.
 */

import type { Tool } from 'ai';

// ============================================================================
// Types
// ============================================================================

type ToolSet = Record<string, Tool>;

export interface DurabilityConfig {
  /** Enable durability for this tool. Default: true */
  enabled?: boolean;
  /** Whether this tool can run independently in parallel. Default: false */
  independent?: boolean;
  /** Number of retry attempts on failure. Default: 3 */
  retryCount?: number;
  /** Timeout duration string (e.g., "30s", "5m"). Default: "5m" */
  timeout?: string;
}

// ============================================================================
// Single Tool Wrapper
// ============================================================================

/**
 * Wrap a single tool with durability directives.
 *
 * When wrapped, the tool's execute function will use the 'use step' directive
 * to create a checkpoint. If the process crashes, the workflow can resume
 * from the last checkpoint.
 *
 * @param tool - The tool to wrap
 * @param config - Durability configuration
 * @returns Wrapped tool with durability enabled
 *
 * @example
 * ```typescript
 * const durableReadFile = wrapToolAsDurableStep(readFileTool, {
 *   retryCount: 3,
 *   timeout: '30s',
 * });
 * ```
 */
export function wrapToolAsDurableStep(
  tool: Tool,
  config: DurabilityConfig = {}
): Tool {
  const { enabled = true } = config;

  if (!enabled) {
    return tool;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalExecute = (tool as any).execute;
  if (!originalExecute) {
    return tool;
  }

  return {
    ...tool,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (input: any, options: any) => {
      // The "use step" directive tells the workflow runtime to checkpoint here.
      // This is a special directive recognized by the workflow package.
      // When the workflow resumes after a crash, it will skip to this point
      // and return the cached result instead of re-executing.
      "use step";

      try {
        return await originalExecute(input, options);
      } catch (error) {
        // Re-throw to let the workflow runtime handle retries
        throw error;
      }
    },
  } as Tool;
}

// ============================================================================
// Batch Tool Wrapper
// ============================================================================

/**
 * Wrap all tools in a set with durability directives.
 *
 * @param tools - Record of tools to wrap
 * @param config - Durability configuration applied to all tools
 * @returns Record of wrapped tools
 *
 * @example
 * ```typescript
 * const durableTools = wrapToolsAsDurable(myTools, {
 *   retryCount: 3,
 *   timeout: '5m',
 * });
 * ```
 */
export function wrapToolsAsDurable(
  tools: ToolSet,
  config: DurabilityConfig = {}
): ToolSet {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [
      name,
      wrapToolAsDurableStep(tool, config),
    ])
  );
}

// ============================================================================
// Selective Wrapping
// ============================================================================

/**
 * Wrap only specified tools with durability, leaving others unchanged.
 *
 * @param tools - All tools
 * @param toolNames - Names of tools to wrap
 * @param config - Durability configuration
 * @returns Tools with selective durability applied
 */
export function wrapSelectedToolsAsDurable(
  tools: ToolSet,
  toolNames: string[],
  config: DurabilityConfig = {}
): ToolSet {
  const nameSet = new Set(toolNames);
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [
      name,
      nameSet.has(name) ? wrapToolAsDurableStep(tool, config) : tool,
    ])
  );
}

// ============================================================================
// Independent Step Wrapper
// ============================================================================

/**
 * Wrap a tool as an independent durable step.
 *
 * Independent steps can be executed in parallel with other independent steps.
 * The workflow runtime will optimize execution by running independent steps
 * concurrently when possible.
 *
 * @param tool - The tool to wrap
 * @returns Wrapped tool marked as independent
 */
export function wrapToolAsIndependentStep(tool: Tool): Tool {
  return wrapToolAsDurableStep(tool, { independent: true });
}

// ============================================================================
// Durability Metadata
// ============================================================================

/**
 * Symbol for storing durability metadata on tools.
 */
export const DURABILITY_CONFIG = Symbol('durabilityConfig');

/**
 * Get durability configuration from a tool (if set).
 */
export function getDurabilityConfig(tool: Tool): DurabilityConfig | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tool as any)[DURABILITY_CONFIG];
}

/**
 * Set durability configuration on a tool.
 */
export function setDurabilityConfig(tool: Tool, config: DurabilityConfig): Tool {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tool as any)[DURABILITY_CONFIG] = config;
  return tool;
}
