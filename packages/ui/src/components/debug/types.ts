import type { ReactNode } from 'react';

export type AgentType = 'main' | 'spawned';

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

export interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  meta: Record<string, unknown> | undefined;
  formattedMessage: string;
}

export interface DebugStats {
  sessions: number;
  rounds: number;
  toolCalls: number;
  errors: number;
}

export interface SectionProps {
  title: string;
  icon: string;
  children: ReactNode;
}

export interface StatBadgeProps {
  label: string;
  value: number;
  variant?: 'default' | 'error';
}

export interface StatusBadgeProps {
  status: string;
}

export interface MetricCardProps {
  label: string;
  value: string;
}

export interface ToolCardProps {
  tool: ToolExecution;
  formatDuration: (ms: number) => string;
}

export interface RoundCardProps {
  round: MessageRound;
  expanded: boolean;
  onToggle: () => void;
  formatDuration: (ms: number) => string;
  formatTime: (ts: number) => string;
}

export interface LogViewerProps {
  logs: LogEntry[];
}

export interface SessionListProps {
  sessions: AgentSession[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}
