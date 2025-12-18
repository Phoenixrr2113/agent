import { useCallback, useEffect, useReducer, useRef } from 'react';
import type {
  AgentSession,
  DashboardEvent,
  MessageRound,
  SerializableDashboardState,
  ToolExecution,
  RoundError,
} from '@agent/shared';

interface DashboardState {
  sessions: Map<string, AgentSession>;
  activeSessionIds: string[];
  totalRounds: number;
  totalToolCalls: number;
  totalErrors: number;
  connected: boolean;
  connectionError: string | null;
  selectedSessionId: string | null;
}

type DashboardAction =
  | { type: 'SET_SNAPSHOT'; payload: SerializableDashboardState }
  | { type: 'SESSION_CREATED'; payload: AgentSession }
  | { type: 'SESSION_UPDATED'; payload: { sessionId: string; updates: Partial<AgentSession> } }
  | { type: 'SESSION_ENDED'; payload: { sessionId: string; status: 'completed' | 'error' } }
  | { type: 'ROUND_STARTED'; payload: { sessionId: string; round: MessageRound } }
  | { type: 'ROUND_UPDATED'; payload: { sessionId: string; roundId: string; updates: Partial<MessageRound> } }
  | { type: 'ROUND_COMPLETED'; payload: { sessionId: string; roundId: string; round: MessageRound } }
  | { type: 'TOOL_STARTED'; payload: { sessionId: string; roundId: string; tool: ToolExecution } }
  | { type: 'TOOL_COMPLETED'; payload: { sessionId: string; roundId: string; toolCallId: string; tool: ToolExecution } }
  | { type: 'ERROR_OCCURRED'; payload: { sessionId: string; roundId?: string; error: RoundError } }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_CONNECTION_ERROR'; payload: string | null }
  | { type: 'SELECT_SESSION'; payload: string | null };

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_SNAPSHOT': {
      const sessions = new Map<string, AgentSession>();
      for (const session of action.payload.sessions) {
        sessions.set(session.sessionId, session);
      }
      return {
        ...state,
        sessions,
        activeSessionIds: action.payload.activeSessionIds,
        totalRounds: action.payload.totalRounds,
        totalToolCalls: action.payload.totalToolCalls,
        totalErrors: action.payload.totalErrors,
      };
    }

    case 'SESSION_CREATED': {
      const sessions = new Map(state.sessions);
      sessions.set(action.payload.sessionId, action.payload);
      return {
        ...state,
        sessions,
        activeSessionIds: [...state.activeSessionIds, action.payload.sessionId],
        selectedSessionId: state.selectedSessionId ?? action.payload.sessionId,
      };
    }

    case 'SESSION_UPDATED': {
      const sessions = new Map(state.sessions);
      const existing = sessions.get(action.payload.sessionId);
      if (existing) {
        sessions.set(action.payload.sessionId, { ...existing, ...action.payload.updates });
      }
      return { ...state, sessions };
    }

    case 'SESSION_ENDED': {
      const sessions = new Map(state.sessions);
      const existing = sessions.get(action.payload.sessionId);
      if (existing) {
        sessions.set(action.payload.sessionId, { ...existing, status: action.payload.status });
      }
      return {
        ...state,
        sessions,
        activeSessionIds: state.activeSessionIds.filter(id => id !== action.payload.sessionId),
      };
    }

    case 'ROUND_STARTED': {
      const sessions = new Map(state.sessions);
      const session = sessions.get(action.payload.sessionId);
      if (session) {
        sessions.set(action.payload.sessionId, {
          ...session,
          rounds: [...session.rounds, action.payload.round],
          updatedAt: Date.now(),
        });
      }
      return {
        ...state,
        sessions,
        totalRounds: state.totalRounds + 1,
      };
    }

    case 'ROUND_UPDATED': {
      const sessions = new Map(state.sessions);
      const session = sessions.get(action.payload.sessionId);
      if (session) {
        const rounds = session.rounds.map(r =>
          r.roundId === action.payload.roundId ? { ...r, ...action.payload.updates } : r
        );
        sessions.set(action.payload.sessionId, { ...session, rounds, updatedAt: Date.now() });
      }
      return { ...state, sessions };
    }

    case 'ROUND_COMPLETED': {
      const sessions = new Map(state.sessions);
      const session = sessions.get(action.payload.sessionId);
      if (session) {
        const rounds = session.rounds.map(r =>
          r.roundId === action.payload.roundId ? action.payload.round : r
        );
        sessions.set(action.payload.sessionId, { ...session, rounds, updatedAt: Date.now() });
      }
      return { ...state, sessions };
    }

    case 'TOOL_STARTED': {
      const sessions = new Map(state.sessions);
      const session = sessions.get(action.payload.sessionId);
      if (session) {
        const rounds = session.rounds.map(r => {
          if (r.roundId === action.payload.roundId) {
            return { ...r, toolExecutions: [...r.toolExecutions, action.payload.tool] };
          }
          return r;
        });
        sessions.set(action.payload.sessionId, { ...session, rounds });
      }
      return { ...state, sessions, totalToolCalls: state.totalToolCalls + 1 };
    }

    case 'TOOL_COMPLETED': {
      const sessions = new Map(state.sessions);
      const session = sessions.get(action.payload.sessionId);
      if (session) {
        const rounds = session.rounds.map(r => {
          if (r.roundId === action.payload.roundId) {
            const toolExecutions = r.toolExecutions.map(t =>
              t.toolCallId === action.payload.toolCallId ? action.payload.tool : t
            );
            return { ...r, toolExecutions };
          }
          return r;
        });
        sessions.set(action.payload.sessionId, { ...session, rounds });
      }
      return { ...state, sessions };
    }

    case 'ERROR_OCCURRED': {
      const sessions = new Map(state.sessions);
      const session = sessions.get(action.payload.sessionId);
      if (session && action.payload.roundId) {
        const rounds = session.rounds.map(r => {
          if (r.roundId === action.payload.roundId) {
            return { ...r, errors: [...r.errors, action.payload.error] };
          }
          return r;
        });
        sessions.set(action.payload.sessionId, { ...session, rounds });
      }
      return { ...state, sessions, totalErrors: state.totalErrors + 1 };
    }

    case 'SET_CONNECTED':
      return { ...state, connected: action.payload };

    case 'SET_CONNECTION_ERROR':
      return { ...state, connectionError: action.payload };

    case 'SELECT_SESSION':
      return { ...state, selectedSessionId: action.payload };

    default:
      return state;
  }
}

const initialState: DashboardState = {
  sessions: new Map(),
  activeSessionIds: [],
  totalRounds: 0,
  totalToolCalls: 0,
  totalErrors: 0,
  connected: false,
  connectionError: null,
  selectedSessionId: null,
};

export function useDashboard(serverUrl?: string) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = serverUrl ?? `ws://${window.location.host}/dashboard/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      dispatch({ type: 'SET_CONNECTED', payload: true });
      dispatch({ type: 'SET_CONNECTION_ERROR', payload: null });
    };

    ws.onmessage = (event) => {
      const dashboardEvent = JSON.parse(event.data as string) as DashboardEvent;

      switch (dashboardEvent.type) {
        case 'state:snapshot':
          dispatch({ type: 'SET_SNAPSHOT', payload: dashboardEvent.data.state });
          break;
        case 'session:created':
          dispatch({ type: 'SESSION_CREATED', payload: dashboardEvent.data.session });
          break;
        case 'session:updated':
          dispatch({ type: 'SESSION_UPDATED', payload: dashboardEvent.data });
          break;
        case 'session:ended':
          dispatch({ type: 'SESSION_ENDED', payload: dashboardEvent.data });
          break;
        case 'round:started':
          dispatch({ type: 'ROUND_STARTED', payload: dashboardEvent.data });
          break;
        case 'round:updated':
          dispatch({ type: 'ROUND_UPDATED', payload: dashboardEvent.data });
          break;
        case 'round:completed':
          dispatch({ type: 'ROUND_COMPLETED', payload: dashboardEvent.data });
          break;
        case 'tool:started':
          dispatch({ type: 'TOOL_STARTED', payload: dashboardEvent.data });
          break;
        case 'tool:completed':
          dispatch({ type: 'TOOL_COMPLETED', payload: dashboardEvent.data });
          break;
        case 'error:occurred':
          dispatch({ type: 'ERROR_OCCURRED', payload: dashboardEvent.data });
          break;
      }
    };

    ws.onclose = () => {
      dispatch({ type: 'SET_CONNECTED', payload: false });
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      dispatch({ type: 'SET_CONNECTION_ERROR', payload: 'Failed to connect to server' });
    };
  }, [serverUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const selectSession = useCallback((sessionId: string | null) => {
    dispatch({ type: 'SELECT_SESSION', payload: sessionId });
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const selectedSession = state.selectedSessionId
    ? state.sessions.get(state.selectedSessionId)
    : null;

  const sessionList = [...state.sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    ...state,
    selectedSession,
    sessionList,
    selectSession,
    connect,
    disconnect,
  };
}
