/**
 * @fileoverview Custom data part types for AI SDK streaming.
 * These types define the shape of transient data streamed during agent execution.
 *
 * Usage with AI SDK:
 * ```typescript
 * import type { DataStreamWriter } from 'ai';
 *
 * const writer: DataStreamWriter = ...;
 * writer.writeData({ type: 'file-content', data: { path: '/foo.ts', content: '...', truncated: false } });
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Custom Data Part Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Union type of all custom data parts supported by the agent SDK.
 * These are streamed transiently and not persisted to conversation context.
 */
export type AgentDataParts = {
  /**
   * Streaming output from a spawned sub-agent.
   * Displayed as nested collapsible in UI.
   */
  'sub-agent-stream': SubAgentStreamData;

  /**
   * Search results from grep/glob/codebase search.
   */
  'search-result': SearchResultData;

  /**
   * File content streamed transiently (not added to context).
   */
  'file-content': FileContentData;

  /**
   * Shell command execution output.
   */
  'shell-output': ShellOutputData;

  /**
   * Progress indicator for long-running tools.
   */
  'tool-progress': ToolProgressData;

  /**
   * Reasoning/thinking step from deep reasoning tool.
   */
  'reasoning-step': ReasoningStepData;

  /**
   * Memory retrieval results.
   */
  'memory-result': MemoryResultData;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Individual Data Part Interfaces
// ═══════════════════════════════════════════════════════════════════════════════

/** Sub-agent streaming data. */
export interface SubAgentStreamData {
  /** Unique identifier for the sub-agent instance. */
  agentId: string;

  /** Role of the sub-agent. */
  role: string;

  /** Streamed text content. */
  text: string;

  /** Status of the sub-agent stream. */
  status: 'streaming' | 'complete' | 'error';

  /** Error message if status is 'error'. */
  error?: string;
}

/** Search result data from file/code search. */
export interface SearchResultData {
  /** File path relative to workspace root. */
  path: string;

  /** Matched content snippet. */
  content: string;

  /** Number of matches in the file. */
  matches: number;

  /** Line number of the first match. */
  line?: number;

  /** Search pattern used. */
  pattern?: string;
}

/** File content data for transient streaming. */
export interface FileContentData {
  /** Absolute or relative file path. */
  path: string;

  /** File content. */
  content: string;

  /** Whether content was truncated due to size limits. */
  truncated: boolean;

  /** Total file size in bytes. */
  totalBytes?: number;

  /** MIME type of the file. */
  mimeType?: string;

  /** Language identifier for syntax highlighting. */
  language?: string;

  /** Line range if partial content. */
  lineRange?: { start: number; end: number };
}

/** Shell command output data. */
export interface ShellOutputData {
  /** Command that was executed. */
  command: string;

  /** Command output (stdout + stderr). */
  output: string;

  /** Exit code of the command. */
  exitCode: number;

  /** Working directory where command was executed. */
  cwd?: string;

  /** Whether output was truncated. */
  truncated?: boolean;

  /** Execution duration in milliseconds. */
  durationMs?: number;
}

/** Tool progress indicator data. */
export interface ToolProgressData {
  /** Name of the tool being executed. */
  toolName: string;

  /** Progress percentage (0-100). */
  progress: number;

  /** Human-readable progress message. */
  message: string;

  /** Estimated time remaining in milliseconds. */
  estimatedRemaining?: number;

  /** Current step/total steps format. */
  step?: { current: number; total: number };
}

/** Reasoning step from deep reasoning tool. */
export interface ReasoningStepData {
  /** Step number in the reasoning chain. */
  stepNumber: number;

  /** Total estimated steps. */
  totalSteps: number;

  /** The reasoning thought content. */
  thought: string;

  /** Whether this is a revision of a previous thought. */
  isRevision?: boolean;

  /** Which thought number is being revised. */
  revisesThought?: number;

  /** Branch identifier for alternative reasoning paths. */
  branchId?: string;
}

/** Memory retrieval result data. */
export interface MemoryResultData {
  /** Memory entry content. */
  content: string;

  /** Similarity score (0-1). */
  score: number;

  /** Metadata associated with the memory. */
  metadata?: Record<string, unknown>;

  /** When the memory was stored. */
  timestamp?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Types
// ═══════════════════════════════════════════════════════════════════════════════

/** Type helper to get data type for a specific part type. */
export type DataPartType<K extends keyof AgentDataParts> = AgentDataParts[K];

/** Type helper for creating typed data parts. */
export interface TypedDataPart<K extends keyof AgentDataParts> {
  type: K;
  id?: string;
  data: AgentDataParts[K];
}

/** Union of all possible data parts. */
export type AnyDataPart = {
  [K in keyof AgentDataParts]: TypedDataPart<K>;
}[keyof AgentDataParts];
