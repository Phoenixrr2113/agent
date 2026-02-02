// @agent/sdk - Main exports

// Core
export { createAgent } from './agent';
export type { AgentOptions, SubAgentConfig, WorkflowOptions, MemoryOptions } from './types/agent';

// Types
export type { ToolLifecycle, ToolContext, ToolError, ToolErrorType } from './types/lifecycle';
export type { AgentDataParts } from './streaming/data-parts';

// Streaming Types
export type {
  StreamEventType,
  StreamEvent,
  StreamEventCallback,
  StreamEventDataMap,
  SessionStartData,
  StepStartData,
  StepFinishData,
  TextDeltaData,
  TextFinishData,
  ReasoningDeltaData,
  ReasoningFinishData,
  ToolCallData,
  ToolResultData,
  SourceData,
  ErrorData,
  CompleteData,
  MessagePartType,
  MessagePart,
  ToolCallInfo,
  SourceInfo,
  StreamingMessage,
} from './types/streaming';

// Logger
export { createLogger, logger } from './utils/logger';
export type { Logger, LogLevel, LoggerOptions, LogEntry, LogSubscriber, AgentContext as LoggerAgentContext } from './utils/logger';

// Prompts
export { systemPrompt, rolePrompts } from './prompts/templates';
export { buildSystemContext, formatSystemContextBlock, buildDynamicSystemPrompt } from './prompts/context';
export type { SystemContext } from './prompts/context';

// Presets
export { toolPresets } from './presets/tools';
export { roleConfigs } from './presets/roles';
export { subAgentConfigs, getSubAgentConfig, subAgentRoles } from './presets/sub-agent-configs';
export type { SubAgentRole } from './presets/sub-agent-configs';

// Streaming
export { withTransientStreaming, streamTransient } from './streaming/transient';

// Tools
export { createSpawnAgentTool } from './tools/spawn-agent/index';

// Memory
export { createMemoryStore } from './memory/vectra-store';
export { createMemoryTools } from './memory/tools';

// Models
export { resolveModel, models } from './models';
