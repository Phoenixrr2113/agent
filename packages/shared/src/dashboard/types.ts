export type AgentType = 'main' | 'spawned';

export interface AgentIdentifier {
  agentId: string;
  sessionId: string;
  agentType: AgentType;
  parentAgentId?: string;
  role?: string;
}

export interface RoundInput {
  message: string;
  timestamp: number;
}

export interface RoundOutput {
  text: string;
  timestamp: number;
  completed: boolean;
  needsInput: boolean;
  pendingQuestion?: string;
}

export interface ToolExecution {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'pending' | 'running' | 'success' | 'error';
}

export interface RoundReasoning {
  content: string;
  durationMs?: number;
  timestamp: number;
}

export interface RoundError {
  message: string;
  code?: string;
  timestamp: number;
  stepIndex?: number;
}

export interface RoundPerformance {
  totalDurationMs: number;
  agentExecutionMs: number;
  codebaseIndexingMs?: number;
  stepDurations: Array<{ stepIndex: number; durationMs: number }>;
  toolMetrics: Record<string, { count: number; totalMs: number; avgMs: number }>;
}

export interface MessageRound {
  roundId: string;
  agentId: string;
  sessionId: string;
  roundIndex: number;
  input: RoundInput;
  output?: RoundOutput;
  reasoning: RoundReasoning[];
  toolExecutions: ToolExecution[];
  errors: RoundError[];
  performance?: RoundPerformance;
  stepsUsed: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
}

export interface AgentSession {
  sessionId: string;
  agentId: string;
  agentType: AgentType;
  parentAgentId?: string;
  role?: string;
  rounds: MessageRound[];
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'completed' | 'error';
}

export interface DashboardState {
  sessions: Map<string, AgentSession>;
  activeSessionIds: string[];
  totalRounds: number;
  totalToolCalls: number;
  totalErrors: number;
}

export type DashboardEventType =
  | 'session:created'
  | 'session:updated'
  | 'session:ended'
  | 'round:started'
  | 'round:updated'
  | 'round:completed'
  | 'tool:started'
  | 'tool:completed'
  | 'error:occurred'
  | 'state:snapshot';

export interface DashboardEvent<T extends DashboardEventType = DashboardEventType> {
  type: T;
  timestamp: number;
  data: DashboardEventData[T];
}

export interface DashboardEventData {
  'session:created': { session: AgentSession };
  'session:updated': { sessionId: string; updates: Partial<AgentSession> };
  'session:ended': { sessionId: string; status: 'completed' | 'error' };
  'round:started': { sessionId: string; round: MessageRound };
  'round:updated': { sessionId: string; roundId: string; updates: Partial<MessageRound> };
  'round:completed': { sessionId: string; roundId: string; round: MessageRound };
  'tool:started': { sessionId: string; roundId: string; tool: ToolExecution };
  'tool:completed': { sessionId: string; roundId: string; toolCallId: string; tool: ToolExecution };
  'error:occurred': { sessionId: string; roundId?: string; error: RoundError };
  'state:snapshot': { state: SerializableDashboardState };
}

export interface SerializableDashboardState {
  sessions: AgentSession[];
  activeSessionIds: string[];
  totalRounds: number;
  totalToolCalls: number;
  totalErrors: number;
}

export type DashboardEventCallback = (event: DashboardEvent) => void | Promise<void>;
