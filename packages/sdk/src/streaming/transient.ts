/**
 * @agent/sdk - Transient Streaming Infrastructure
 *
 * Enables tools to stream data to the UI without persisting to conversation context.
 * This keeps the context window lean while providing rich UI feedback.
 */

import type { Tool } from 'ai';
import type { ToolContext } from '../types/lifecycle';
import type { AgentDataParts, AnyDataPart } from './data-parts';

// ============================================================================
// Types
// ============================================================================

/**
 * Interface for UI stream writer.
 * Compatible with AI SDK's DataStreamWriter.
 */
export interface TransientStreamWriter {
  writeData(data: unknown): void;
}

/**
 * Enhanced tool context with transient streaming capabilities.
 * Uses intersection type to extend ToolContext without conflicts.
 */
export type TransientToolContext = ToolContext & {
  /** Helper to stream typed transient data */
  stream: <K extends keyof AgentDataParts>(
    type: K,
    data: AgentDataParts[K]
  ) => void;
};

/**
 * Tool set is a record of tools keyed by name.
 */
type ToolSet = Record<string, Tool>;

// ============================================================================
// Main API: withTransientStreaming
// ============================================================================

/**
 * Wrap tools to enable transient streaming.
 *
 * Tools wrapped with this function will have access to a `stream()` helper
 * in their context that allows streaming data to the UI without adding
 * it to the conversation context.
 *
 * @param tools - Record of tools to wrap
 * @param writer - Stream writer for sending data to the client
 * @returns Wrapped tools with transient streaming enabled
 *
 * @example
 * ```typescript
 * const wrappedTools = withTransientStreaming(myTools, dataStream);
 *
 * // Inside a tool's execute function:
 * execute: async (input, ctx) => {
 *   ctx.stream('file-content', {
 *     path: input.path,
 *     content: fileContent,
 *     truncated: false,
 *   });
 *   return `Read ${input.path}`;
 * }
 * ```
 */
export function withTransientStreaming(
  tools: ToolSet,
  writer: TransientStreamWriter
): ToolSet {
  const wrappedTools: ToolSet = {};

  for (const [name, tool] of Object.entries(tools)) {
    wrappedTools[name] = wrapToolWithTransient(tool, writer, name);
  }

  return wrappedTools;
}

// ============================================================================
// Tool Wrapping
// ============================================================================

/**
 * Wrap a single tool with transient streaming capabilities.
 */
function wrapToolWithTransient(
  tool: Tool,
  writer: TransientStreamWriter,
  toolName: string
): Tool {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalExecute = (tool as any).execute;
  if (!originalExecute) {
    return tool;
  }

  return {
    ...tool,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (input: any, options: any) => {
      // Create enhanced context with streaming helper
      const enhancedContext: TransientToolContext = {
        ...(options || {}),
        agentId: options?.agentId || 'unknown',
        stepNumber: options?.stepNumber || 0,
        writer,
        stream: <K extends keyof AgentDataParts>(
          type: K,
          data: AgentDataParts[K]
        ) => {
          writeTransient(writer, type, data);
        },
      };

      return originalExecute(input, enhancedContext);
    },
  } as Tool;
}

// ============================================================================
// Transient Data Writers
// ============================================================================

/**
 * Stream typed transient data to the UI.
 *
 * @param writer - Stream writer instance
 * @param type - Data part type
 * @param data - Data to stream
 */
export function writeTransient<K extends keyof AgentDataParts>(
  writer: TransientStreamWriter,
  type: K,
  data: AgentDataParts[K]
): void {
  const dataPart: AnyDataPart = {
    type,
    data,
  } as AnyDataPart;

  writer.writeData({
    ...dataPart,
    transient: true,
  });
}

/**
 * Helper for tools to stream transient data from within their execute function.
 *
 * @param ctx - Tool context (must have writer)
 * @param type - Data part type
 * @param data - Data to stream
 *
 * @example
 * ```typescript
 * // Inside a tool's execute function:
 * streamTransient(ctx, 'shell-output', {
 *   command: 'npm test',
 *   output: result.stdout,
 *   exitCode: result.code,
 * });
 * ```
 */
export function streamTransient<K extends keyof AgentDataParts>(
  ctx: ToolContext,
  type: K,
  data: AgentDataParts[K]
): void {
  // Cast to TransientStreamWriter - they have compatible interfaces
  const writer = ctx.writer as unknown as TransientStreamWriter | undefined;
  if (writer) {
    writeTransient(writer, type, data);
  }
}

// ============================================================================
// Specialized Streamers
// ============================================================================

/**
 * Stream file content transiently.
 */
export function streamFileContent(
  ctx: ToolContext,
  path: string,
  content: string,
  options: {
    truncated?: boolean;
    totalBytes?: number;
    language?: string;
    lineRange?: { start: number; end: number };
  } = {}
): void {
  streamTransient(ctx, 'file-content', {
    path,
    content,
    truncated: options.truncated ?? false,
    totalBytes: options.totalBytes,
    language: options.language,
    lineRange: options.lineRange,
  });
}

/**
 * Stream shell output transiently.
 */
export function streamShellOutput(
  ctx: ToolContext,
  command: string,
  output: string,
  exitCode: number,
  options: {
    cwd?: string;
    truncated?: boolean;
    durationMs?: number;
  } = {}
): void {
  streamTransient(ctx, 'shell-output', {
    command,
    output,
    exitCode,
    cwd: options.cwd,
    truncated: options.truncated,
    durationMs: options.durationMs,
  });
}

/**
 * Stream search results transiently.
 */
export function streamSearchResult(
  ctx: ToolContext,
  path: string,
  content: string,
  matches: number,
  options: {
    line?: number;
    pattern?: string;
  } = {}
): void {
  streamTransient(ctx, 'search-result', {
    path,
    content,
    matches,
    line: options.line,
    pattern: options.pattern,
  });
}

/**
 * Stream tool progress update transiently.
 */
export function streamProgress(
  ctx: ToolContext,
  toolName: string,
  progress: number,
  message: string,
  options: {
    estimatedRemaining?: number;
    step?: { current: number; total: number };
  } = {}
): void {
  streamTransient(ctx, 'tool-progress', {
    toolName,
    progress,
    message,
    estimatedRemaining: options.estimatedRemaining,
    step: options.step,
  });
}

/**
 * Stream reasoning step transiently.
 */
export function streamReasoningStep(
  ctx: ToolContext,
  stepNumber: number,
  totalSteps: number,
  thought: string,
  options: {
    isRevision?: boolean;
    revisesThought?: number;
    branchId?: string;
  } = {}
): void {
  streamTransient(ctx, 'reasoning-step', {
    stepNumber,
    totalSteps,
    thought,
    isRevision: options.isRevision,
    revisesThought: options.revisesThought,
    branchId: options.branchId,
  });
}

/**
 * Stream sub-agent output transiently.
 */
export function streamSubAgent(
  ctx: ToolContext,
  agentId: string,
  role: string,
  text: string,
  status: 'streaming' | 'complete' | 'error',
  error?: string
): void {
  streamTransient(ctx, 'sub-agent-stream', {
    agentId,
    role,
    text,
    status,
    error,
  });
}
