import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  StatBadge,
  SessionList,
  RoundCard,
  LogViewer,
  type AgentSession,
  type MessageRound,
  type ToolExecution,
  type LogEntry,
  type DebugStats,
} from '@agent/ui';
import { useSettings } from '@/context/settings';

interface SerializableDashboardState {
  sessions: AgentSession[];
  activeSessionIds: string[];
  totalRounds: number;
  totalToolCalls: number;
  totalErrors: number;
}

export default function DebugScreen(): React.ReactElement {
  const { settings } = useSettings();
  const [sessions, setSessions] = useState<Map<string, AgentSession>>(new Map());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<DebugStats>({
    sessions: 0,
    rounds: 0,
    toolCalls: 0,
    errors: 0,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const handleWebSocketMessage = useCallback(
    (event: { type: string; data: Record<string, unknown> }) => {
      switch (event.type) {
        case 'state:snapshot': {
          const state = event.data.state as SerializableDashboardState;
          const sessionMap = new Map<string, AgentSession>();
          state.sessions.forEach((s) => sessionMap.set(s.sessionId, s));
          setSessions(sessionMap);
          setStats({
            sessions: state.sessions.length,
            rounds: state.totalRounds,
            toolCalls: state.totalToolCalls,
            errors: state.totalErrors,
          });
          if (!selectedSessionId && state.sessions.length > 0) {
            setSelectedSessionId(state.sessions[0].sessionId);
          }
          break;
        }
        case 'session:created': {
          const session = event.data.session as AgentSession;
          setSessions((prev) => new Map(prev).set(session.sessionId, session));
          if (!selectedSessionId) {
            setSelectedSessionId(session.sessionId);
          }
          break;
        }
        case 'round:started':
        case 'round:updated':
        case 'round:completed': {
          const sessionId = event.data.sessionId as string;
          const round = event.data.round as MessageRound | undefined;
          if (round) {
            setSessions((prev) => {
              const next = new Map(prev);
              const session = next.get(sessionId);
              if (session) {
                const roundIndex = session.rounds.findIndex(
                  (r) => r.roundId === round.roundId
                );
                if (roundIndex >= 0) {
                  session.rounds[roundIndex] = round;
                } else {
                  session.rounds.push(round);
                }
                next.set(sessionId, { ...session });
              }
              return next;
            });
          }
          break;
        }
        case 'tool:started':
        case 'tool:completed': {
          const sessionId = event.data.sessionId as string;
          const roundId = event.data.roundId as string;
          const tool = event.data.tool as ToolExecution;
          setSessions((prev) => {
            const next = new Map(prev);
            const session = next.get(sessionId);
            if (session) {
              const round = session.rounds.find((r) => r.roundId === roundId);
              if (round) {
                const toolIndex = round.toolExecutions.findIndex(
                  (t) => t.toolCallId === tool.toolCallId
                );
                if (toolIndex >= 0) {
                  round.toolExecutions[toolIndex] = tool;
                } else {
                  round.toolExecutions.push(tool);
                }
                next.set(sessionId, { ...session });
              }
            }
            return next;
          });
          setStats((prev) => ({
            ...prev,
            toolCalls: prev.toolCalls + (event.type === 'tool:started' ? 1 : 0),
          }));
          break;
        }
        case 'log': {
          const logEntry = event.data as unknown as LogEntry;
          setLogs((prev) => {
            const newLogs = [...prev, logEntry];
            return newLogs.slice(-500);
          });
          break;
        }
      }
    },
    [selectedSessionId]
  );

  useEffect(() => {
    const wsUrl = settings.serverUrl.replace('http', 'ws') + '/dashboard/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    return () => ws.close();
  }, [settings.serverUrl, handleWebSocketMessage]);

  const toggleRound = (roundId: string) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(roundId)) {
        next.delete(roundId);
      } else {
        next.add(roundId);
      }
      return next;
    });
  };

  const selectedSession = selectedSessionId ? sessions.get(selectedSessionId) : null;
  const sessionList = [...sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
      <View className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-2">
              <View className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {connected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <StatBadge label="Sessions" value={stats.sessions} />
              <StatBadge label="Rounds" value={stats.rounds} />
              <StatBadge label="Tools" value={stats.toolCalls} />
              {stats.errors > 0 && (
                <StatBadge label="Errors" value={stats.errors} variant="error" />
              )}
            </View>
          </View>
        </View>
      </View>

      <View className="flex-1 flex-row">
        <View className="w-1/3 border-r border-gray-200 dark:border-gray-700">
          <View className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <Text className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase">
              Sessions
            </Text>
          </View>
          <SessionList
            sessions={sessionList}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
          />
        </View>

        <View className="flex-1 flex-col">
          {selectedSession ? (
            <ScrollView className="flex-1 p-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  Session: {selectedSession.sessionId.slice(0, 12)}...
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedSession.rounds.length} round
                  {selectedSession.rounds.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {selectedSession.rounds.map((round) => (
                <RoundCard
                  key={round.roundId}
                  round={round}
                  expanded={expandedRounds.has(round.roundId)}
                  onToggle={() => toggleRound(round.roundId)}
                  formatDuration={formatDuration}
                  formatTime={formatTime}
                />
              ))}
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-lg font-medium text-gray-500 dark:text-gray-400">
                No session selected
              </Text>
              <Text className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Send a message or select a session
              </Text>
            </View>
          )}
        </View>

        <View className="w-64 border-l border-gray-200 dark:border-gray-700 flex-col">
          <View className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <Text className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase">
              Logs ({logs.length})
            </Text>
          </View>
          <LogViewer logs={logs} />
        </View>
      </View>
    </SafeAreaView>
  );
}
