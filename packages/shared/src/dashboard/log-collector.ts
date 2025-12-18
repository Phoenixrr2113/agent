import type {
  StreamEvent,
  StepStartData,
  StepFinishData,
  TextDeltaData,
  TextFinishData,
  ReasoningDeltaData,
  ReasoningFinishData,
  ToolCallData,
  ToolResultData,
  ErrorData,
  CompleteData,
} from '../streaming/types.js';
import type {
  AgentIdentifier,
  AgentSession,
  DashboardEvent,
  DashboardEventCallback,
  DashboardState,
  MessageRound,
  RoundError,
  RoundReasoning,
  SerializableDashboardState,
  ToolExecution,
} from './types.js';

interface LogCollectorOptions {
  maxSessions?: number;
  maxRoundsPerSession?: number;
}

interface ActiveRound {
  round: MessageRound;
  reasoningBuffer: string;
  textBuffer: string;
  toolStartTimes: Map<string, number>;
}

export function createLogCollector(options: LogCollectorOptions = {}) {
  const maxSessions = options.maxSessions ?? 100;
  const maxRoundsPerSession = options.maxRoundsPerSession ?? 100;

  const state: DashboardState = {
    sessions: new Map(),
    activeSessionIds: [],
    totalRounds: 0,
    totalToolCalls: 0,
    totalErrors: 0,
  };

  const subscribers = new Set<DashboardEventCallback>();
  const activeRounds = new Map<string, ActiveRound>();

  function emit(event: DashboardEvent): void {
    for (const callback of subscribers) {
      try {
        const result = callback(event);
        if (result instanceof Promise) {
          result.catch(() => {});
        }
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  function getRoundKey(sessionId: string, roundId: string): string {
    return `${sessionId}:${roundId}`;
  }

  function createSession(agent: AgentIdentifier): AgentSession {
    const session: AgentSession = {
      sessionId: agent.sessionId,
      agentId: agent.agentId,
      agentType: agent.agentType,
      rounds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'active',
    };

    if (agent.parentAgentId !== undefined) {
      session.parentAgentId = agent.parentAgentId;
    }
    if (agent.role !== undefined) {
      session.role = agent.role;
    }

    if (state.sessions.size >= maxSessions) {
      const oldestSessionId = [...state.sessions.keys()][0];
      if (oldestSessionId) {
        state.sessions.delete(oldestSessionId);
        state.activeSessionIds = state.activeSessionIds.filter(id => id !== oldestSessionId);
      }
    }

    state.sessions.set(agent.sessionId, session);
    state.activeSessionIds.push(agent.sessionId);

    emit({
      type: 'session:created',
      timestamp: Date.now(),
      data: { session },
    });

    return session;
  }

  function getOrCreateSession(agent: AgentIdentifier): AgentSession {
    let session = state.sessions.get(agent.sessionId);
    if (!session) {
      session = createSession(agent);
    }
    return session;
  }

  function startRound(agent: AgentIdentifier, message: string): MessageRound {
    const session = getOrCreateSession(agent);
    const roundId = crypto.randomUUID();
    const roundIndex = session.rounds.length;

    const round: MessageRound = {
      roundId,
      agentId: agent.agentId,
      sessionId: agent.sessionId,
      roundIndex,
      input: {
        message,
        timestamp: Date.now(),
      },
      reasoning: [],
      toolExecutions: [],
      errors: [],
      stepsUsed: 0,
      status: 'pending',
      startTime: Date.now(),
    };

    if (session.rounds.length >= maxRoundsPerSession) {
      session.rounds.shift();
    }

    session.rounds.push(round);
    session.updatedAt = Date.now();
    state.totalRounds++;

    const activeRound: ActiveRound = {
      round,
      reasoningBuffer: '',
      textBuffer: '',
      toolStartTimes: new Map(),
    };
    activeRounds.set(getRoundKey(agent.sessionId, roundId), activeRound);

    emit({
      type: 'round:started',
      timestamp: Date.now(),
      data: { sessionId: agent.sessionId, round },
    });

    return round;
  }

  function getCurrentRound(sessionId: string): ActiveRound | undefined {
    const session = state.sessions.get(sessionId);
    if (!session || session.rounds.length === 0) {
      return undefined;
    }
    const lastRound = session.rounds.at(-1);
    if (!lastRound) {
      return undefined;
    }
    return activeRounds.get(getRoundKey(sessionId, lastRound.roundId));
  }

  function processStreamEvent(
    agent: AgentIdentifier,
    event: StreamEvent,
    inputMessage?: string
  ): void {
    const session = state.sessions.get(agent.sessionId);

    switch (event.type) {
      case 'session:start': {
        if (inputMessage) {
          startRound(agent, inputMessage);
        }
        break;
      }

      case 'step:start': {
        const data = event.data as StepStartData;
        const active = getCurrentRound(agent.sessionId);
        if (active) {
          active.round.status = 'processing';
          active.round.stepsUsed = data.stepIndex;
          emitRoundUpdate(agent.sessionId, active.round);
        }
        break;
      }

      case 'step:finish': {
        const data = event.data as StepFinishData;
        const active = getCurrentRound(agent.sessionId);
        if (active && active.round.performance) {
          active.round.performance.stepDurations.push({
            stepIndex: data.stepIndex,
            durationMs: data.durationMs,
          });
          emitRoundUpdate(agent.sessionId, active.round);
        }
        break;
      }

      case 'text:delta': {
        const data = event.data as TextDeltaData;
        const active = getCurrentRound(agent.sessionId);
        if (active) {
          active.textBuffer += data.delta;
        }
        break;
      }

      case 'text:finish': {
        const data = event.data as TextFinishData;
        const active = getCurrentRound(agent.sessionId);
        if (active) {
          active.textBuffer = data.text;
        }
        break;
      }

      case 'reasoning:delta': {
        const data = event.data as ReasoningDeltaData;
        const active = getCurrentRound(agent.sessionId);
        if (active) {
          active.reasoningBuffer += data.delta;
        }
        break;
      }

      case 'reasoning:finish': {
        const data = event.data as ReasoningFinishData;
        const active = getCurrentRound(agent.sessionId);
        if (active) {
          const reasoning: RoundReasoning = {
            content: data.reasoning,
            durationMs: data.durationMs,
            timestamp: event.timestamp,
          };
          active.round.reasoning.push(reasoning);
          active.reasoningBuffer = '';
          emitRoundUpdate(agent.sessionId, active.round);
        }
        break;
      }

      case 'tool:call': {
        const data = event.data as ToolCallData;
        const active = getCurrentRound(agent.sessionId);
        if (active) {
          const tool: ToolExecution = {
            toolCallId: data.toolCallId,
            toolName: data.toolName,
            args: data.args,
            startTime: event.timestamp,
            status: 'running',
          };
          active.round.toolExecutions.push(tool);
          active.toolStartTimes.set(data.toolCallId, event.timestamp);
          state.totalToolCalls++;

          emit({
            type: 'tool:started',
            timestamp: event.timestamp,
            data: {
              sessionId: agent.sessionId,
              roundId: active.round.roundId,
              tool,
            },
          });
        }
        break;
      }

      case 'tool:result': {
        const data = event.data as ToolResultData;
        const active = getCurrentRound(agent.sessionId);
        if (active) {
          const tool = active.round.toolExecutions.find(
            t => t.toolCallId === data.toolCallId
          );
          if (tool) {
            const startTime = active.toolStartTimes.get(data.toolCallId);
            tool.result = data.result;
            tool.endTime = event.timestamp;
            tool.durationMs = startTime ? event.timestamp - startTime : data.durationMs;
            tool.status = 'success';
            active.toolStartTimes.delete(data.toolCallId);

            emit({
              type: 'tool:completed',
              timestamp: event.timestamp,
              data: {
                sessionId: agent.sessionId,
                roundId: active.round.roundId,
                toolCallId: data.toolCallId,
                tool,
              },
            });
          }
        }
        break;
      }

      case 'error': {
        const data = event.data as ErrorData;
        const active = getCurrentRound(agent.sessionId);
        const error: RoundError = {
          message: data.message,
          timestamp: event.timestamp,
        };
        if (data.code !== undefined) {
          error.code = data.code;
        }
        if (data.stepIndex !== undefined) {
          error.stepIndex = data.stepIndex;
        }
        state.totalErrors++;

        if (active) {
          active.round.errors.push(error);
        }

        const errorEventData: { sessionId: string; error: RoundError; roundId?: string } = {
          sessionId: agent.sessionId,
          error,
        };
        if (active?.round.roundId) {
          errorEventData.roundId = active.round.roundId;
        }

        emit({
          type: 'error:occurred',
          timestamp: event.timestamp,
          data: errorEventData,
        });
        break;
      }

      case 'complete': {
        const data = event.data as CompleteData;
        const active = getCurrentRound(agent.sessionId);
        if (active) {
          active.round.output = {
            text: data.text,
            timestamp: event.timestamp,
            completed: data.completed,
            needsInput: data.needsInput,
          };
          if (data.pendingQuestion !== undefined) {
            active.round.output.pendingQuestion = data.pendingQuestion;
          }
          active.round.stepsUsed = data.stepsUsed;
          active.round.status = 'completed';
          active.round.endTime = event.timestamp;

          const toolMetrics: Record<string, { count: number; totalMs: number; avgMs: number }> = {};
          for (const tool of active.round.toolExecutions) {
            const existing = toolMetrics[tool.toolName] ?? { count: 0, totalMs: 0, avgMs: 0 };
            existing.count++;
            existing.totalMs += tool.durationMs ?? 0;
            existing.avgMs = existing.totalMs / existing.count;
            toolMetrics[tool.toolName] = existing;
          }

          active.round.performance = {
            totalDurationMs: active.round.endTime - active.round.startTime,
            agentExecutionMs: active.round.endTime - active.round.startTime,
            stepDurations: active.round.performance?.stepDurations ?? [],
            toolMetrics,
          };

          emit({
            type: 'round:completed',
            timestamp: event.timestamp,
            data: {
              sessionId: agent.sessionId,
              roundId: active.round.roundId,
              round: active.round,
            },
          });

          activeRounds.delete(getRoundKey(agent.sessionId, active.round.roundId));
        }

        if (session) {
          session.updatedAt = event.timestamp;
          if (data.completed) {
            session.status = 'completed';
            state.activeSessionIds = state.activeSessionIds.filter(id => id !== agent.sessionId);
            emit({
              type: 'session:ended',
              timestamp: event.timestamp,
              data: { sessionId: agent.sessionId, status: 'completed' },
            });
          }
        }
        break;
      }
    }
  }

  function emitRoundUpdate(sessionId: string, round: MessageRound): void {
    emit({
      type: 'round:updated',
      timestamp: Date.now(),
      data: {
        sessionId,
        roundId: round.roundId,
        updates: {
          status: round.status,
          stepsUsed: round.stepsUsed,
          toolExecutions: round.toolExecutions,
          reasoning: round.reasoning,
          errors: round.errors,
        },
      },
    });
  }

  function getSnapshot(): SerializableDashboardState {
    return {
      sessions: [...state.sessions.values()],
      activeSessionIds: state.activeSessionIds,
      totalRounds: state.totalRounds,
      totalToolCalls: state.totalToolCalls,
      totalErrors: state.totalErrors,
    };
  }

  function subscribe(callback: DashboardEventCallback): () => void {
    subscribers.add(callback);

    callback({
      type: 'state:snapshot',
      timestamp: Date.now(),
      data: { state: getSnapshot() },
    });

    return () => {
      subscribers.delete(callback);
    };
  }

  function createEventHandler(
    agent: AgentIdentifier,
    inputMessage: string
  ): (event: StreamEvent) => void {
    let isFirstEvent = true;

    return (event: StreamEvent) => {
      if (isFirstEvent) {
        processStreamEvent(agent, event, inputMessage);
        isFirstEvent = false;
      } else {
        processStreamEvent(agent, event);
      }
    };
  }

  function getSession(sessionId: string): AgentSession | undefined {
    return state.sessions.get(sessionId);
  }

  function getAllSessions(): AgentSession[] {
    return [...state.sessions.values()];
  }

  function getActiveSessions(): AgentSession[] {
    return state.activeSessionIds
      .map(id => state.sessions.get(id))
      .filter((s): s is AgentSession => s !== undefined);
  }

  function clear(): void {
    state.sessions.clear();
    state.activeSessionIds = [];
    state.totalRounds = 0;
    state.totalToolCalls = 0;
    state.totalErrors = 0;
    activeRounds.clear();
  }

  return {
    subscribe,
    processStreamEvent,
    createEventHandler,
    getSnapshot,
    getSession,
    getAllSessions,
    getActiveSessions,
    startRound,
    clear,
    get state() {
      return state;
    },
  };
}

export type LogCollector = ReturnType<typeof createLogCollector>;

let globalLogCollector: LogCollector | null = null;

export function getLogCollector(): LogCollector {
  if (!globalLogCollector) {
    globalLogCollector = createLogCollector();
  }
  return globalLogCollector;
}

export function resetLogCollector(): void {
  if (globalLogCollector) {
    globalLogCollector.clear();
  }
  globalLogCollector = null;
}
