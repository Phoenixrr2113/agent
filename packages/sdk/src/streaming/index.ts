/**
 * @agent/sdk - Streaming Module
 *
 * Exports for transient streaming and custom data parts.
 */

// Data part types
export {
  type AgentDataParts,
  type SubAgentStreamData,
  type SearchResultData,
  type FileContentData,
  type ShellOutputData,
  type ToolProgressData,
  type ReasoningStepData,
  type MemoryResultData,
  type DataPartType,
  type TypedDataPart,
  type AnyDataPart,
} from './data-parts';

// Transient streaming
export {
  withTransientStreaming,
  writeTransient,
  streamTransient,
  streamFileContent,
  streamShellOutput,
  streamSearchResult,
  streamProgress,
  streamReasoningStep,
  streamSubAgent,
  type TransientStreamWriter,
  type TransientToolContext,
} from './transient';
