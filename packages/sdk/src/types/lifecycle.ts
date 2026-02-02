/**
 * @fileoverview Tool lifecycle types for hook-based tool execution.
 * Extends patterns from packages/core/src/tools/middleware/lifecycle.ts with
 * new streaming and durability features.
 *
 * Hook execution order:
 * 1. shouldBypass → If returns { bypass: true }, skip execution and return cached result
 * 2. beforeExecute → Transform/enrich input before validation
 * 3. validate → Validate transformed input, throw on failure
 * 4. execute → Core tool logic (with onStream callbacks)
 * 5. afterExecute → Transform output before returning
 * 6. cleanup → Always runs (finally block), regardless of success/failure
 *
 * Error handling:
 * - onError is called if execute or any step before it throws
 * - cleanup always runs
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Stream Writer Interface
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Interface for stream writers that can write typed data parts.
 * Compatible with AI SDK's various stream writer types.
 */
export interface StreamWriter {
  write(data: unknown): void;
  writeData?(data: unknown): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Lifecycle Interface
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Lifecycle hooks for tool execution.
 * @template TInput - Input parameter type for the tool
 * @template TOutput - Output/return type for the tool
 */
export interface ToolLifecycle<TInput, TOutput> {
  // ─────────────────────────────────────────────────────────────────────────────
  // Existing Hooks (from core)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Transform input before validation.
   * Use for normalization, defaults, or enrichment.
   */
  beforeExecute?: (input: TInput, ctx: ToolContext) => Promise<TInput> | TInput;

  /**
   * Validate input after beforeExecute.
   * Return { valid: false } to reject execution.
   */
  validate?: (input: TInput, ctx: ToolContext) => Promise<ValidationResult> | ValidationResult;

  /**
   * Transform output after successful execution.
   * Use for formatting, sanitization, or enrichment.
   */
  afterExecute?: (
    input: TInput,
    output: TOutput,
    ctx: ToolContext
  ) => Promise<TOutput> | TOutput;

  /**
   * Handle errors during execution.
   * Return a fallback value or 'throw' to re-throw.
   */
  onError?: (
    error: ToolError,
    input: TInput,
    ctx: ToolContext
  ) => Promise<TOutput | 'throw'> | TOutput | 'throw';

  /**
   * Cleanup after execution (always called).
   * Runs in finally block regardless of success/failure.
   */
  cleanup?: (input: TInput, didSucceed: boolean, ctx: ToolContext) => Promise<void> | void;

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW Hooks
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Stream data during execution for transient display.
   * Called periodically during long-running operations.
   */
  onStream?: (data: unknown, ctx: ToolContext) => void;

  /**
   * Check if execution can be bypassed (caching, memoization).
   * Return { bypass: true, result: cachedValue } to skip execution.
   */
  shouldBypass?: (
    input: TInput,
    ctx: ToolContext
  ) => Promise<BypassResult<TOutput>> | BypassResult<TOutput>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Durability Configuration
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Configuration for workflow durability.
   * When enabled, tool execution is wrapped in a "use step" directive.
   */
  durability?: DurabilityConfig;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Context
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context passed to lifecycle hooks.
 */
export interface ToolContext {
  /** Stream writer for transient data streaming. */
  writer?: StreamWriter;

  /** Unique identifier for the current agent instance. */
  agentId: string;

  /** Current step number in the agent execution. */
  stepNumber: number;

  /** ID of parent agent if this is a sub-agent tool. */
  parentAgentId?: string;

  /** Workflow run ID for resumable executions. */
  workflowRunId?: string;

  /** Workspace root directory for path resolution. */
  workspaceRoot?: string;

  /** Additional metadata passed from agent options. */
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Validation Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of input validation.
 */
export interface ValidationResult {
  /** Whether validation passed. */
  valid: boolean;

  /** Error message if validation failed. */
  error?: string;

  /** Error type for categorization. */
  errorType?: ToolErrorType;
}

/**
 * Result of bypass check.
 */
export interface BypassResult<TOutput> {
  /** Whether to bypass execution. */
  bypass: boolean;

  /** Cached result to return if bypassing. */
  result?: TOutput;

  /** Reason for bypass (for logging/debugging). */
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Durability Configuration
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for workflow durability.
 */
export interface DurabilityConfig {
  /** Enable durable execution for this tool. Default: true */
  enabled: boolean;

  /**
   * Whether this tool is independent (can run in parallel with other independent tools).
   * If true, uses "use step" without blocking.
   */
  independent: boolean;

  /** Number of retry attempts on failure. Default: 3 */
  retryCount?: number;

  /** Timeout for execution. Format: "30s", "5m", "1h". Default: "5m" */
  timeout?: string;

  /** Custom step name for workflow state. */
  stepName?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Error Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error types for tool execution failures.
 */
export enum ToolErrorType {
  /** Requested file or directory not found. */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  /** Path is outside allowed workspace. */
  PATH_NOT_IN_WORKSPACE = 'PATH_NOT_IN_WORKSPACE',

  /** Expected directory but found file. */
  PATH_IS_NOT_A_DIRECTORY = 'PATH_IS_NOT_A_DIRECTORY',

  /** Expected file but found directory. */
  PATH_IS_NOT_A_FILE = 'PATH_IS_NOT_A_FILE',

  /** Insufficient permissions. */
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  /** Operation exceeded timeout. */
  TIMEOUT = 'TIMEOUT',

  /** Input validation failed. */
  INVALID_INPUT = 'INVALID_INPUT',

  /** Shell command blocked by security filter. */
  COMMAND_BLOCKED = 'COMMAND_BLOCKED',

  /** Content exceeds size limit. */
  CONTENT_TOO_LARGE = 'CONTENT_TOO_LARGE',

  /** General operation failure. */
  OPERATION_FAILED = 'OPERATION_FAILED',

  /** Network/HTTP request failed. */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** Rate limit exceeded. */
  RATE_LIMITED = 'RATE_LIMITED',
}

/**
 * Structured error class for tool failures.
 */
export class ToolError extends Error {
  public readonly type: ToolErrorType;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    type: ToolErrorType,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ToolError';
    this.type = type;
    this.details = details;
  }

  /**
   * Serialize error for tool response.
   */
  toJSON(): Record<string, unknown> {
    return {
      success: false,
      error: this.message,
      errorType: this.type,
      ...this.details,
    };
  }

  /**
   * Create a FILE_NOT_FOUND error.
   */
  static fileNotFound(path: string): ToolError {
    return new ToolError(`File not found: ${path}`, ToolErrorType.FILE_NOT_FOUND, { path });
  }

  /**
   * Create a PATH_NOT_IN_WORKSPACE error.
   */
  static pathNotInWorkspace(path: string, workspaceRoot: string): ToolError {
    return new ToolError(
      `Path is outside workspace: ${path}`,
      ToolErrorType.PATH_NOT_IN_WORKSPACE,
      { path, workspaceRoot }
    );
  }

  /**
   * Create an INVALID_INPUT error.
   */
  static invalidInput(message: string, details?: Record<string, unknown>): ToolError {
    return new ToolError(message, ToolErrorType.INVALID_INPUT, details);
  }

  /**
   * Create a TIMEOUT error.
   */
  static timeout(operation: string, timeoutMs: number): ToolError {
    return new ToolError(
      `Operation timed out: ${operation}`,
      ToolErrorType.TIMEOUT,
      { operation, timeoutMs }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Lifecycle Tool Configuration
// ═══════════════════════════════════════════════════════════════════════════════

import type { z } from 'zod';

/**
 * Configuration for creating a lifecycle-enabled tool.
 */
export interface LifecycleToolConfig<TSchema extends z.ZodType, TOutput> {
  /** Tool name for logging and identification. */
  name: string;

  /** Description shown to the LLM. */
  description: string;

  /** Zod schema for input validation. */
  inputSchema: TSchema;

  /** Lifecycle hooks including the core execute function. */
  lifecycle: ToolLifecycle<z.infer<TSchema>, TOutput> & {
    /** Core execution logic (required). */
    execute: (input: z.infer<TSchema>, ctx: ToolContext) => Promise<TOutput>;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type for a tool execute function with context.
 */
export type ToolExecuteFn<TInput, TOutput> = (input: TInput, ctx: ToolContext) => Promise<TOutput>;

/**
 * Infer the input type from a LifecycleToolConfig.
 */
export type InferToolInput<T> = T extends LifecycleToolConfig<infer TSchema, unknown>
  ? z.infer<TSchema>
  : never;

/**
 * Infer the output type from a LifecycleToolConfig.
 */
export type InferToolOutput<T> = T extends LifecycleToolConfig<z.ZodType, infer TOutput>
  ? TOutput
  : never;
