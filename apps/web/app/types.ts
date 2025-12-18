export type AgentType = "main" | "spawned";

export interface ToolExecution {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: "pending" | "running" | "success" | "error";
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
  toolMetrics: Record<
    string,
    { count: number; totalMs: number; avgMs: number }
  >;
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
  status: "pending" | "processing" | "completed" | "error";
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
  status: "active" | "completed" | "error";
}

export interface SerializableDashboardState {
  sessions: AgentSession[];
  activeSessionIds: string[];
  totalRounds: number;
  totalToolCalls: number;
  totalErrors: number;
}
