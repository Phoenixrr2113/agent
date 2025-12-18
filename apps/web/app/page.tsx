"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  AgentSession,
  MessageRound,
  ToolExecution,
  SerializableDashboardState,
} from "./types";

interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  meta: Record<string, unknown> | undefined;
  formattedMessage: string;
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Map<string, AgentSession>>(
    new Map()
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState({
    sessions: 0,
    rounds: 0,
    toolCalls: 0,
    errors: 0,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"sessions" | "logs">("sessions");
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000/dashboard/ws");
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    return () => ws.close();
  }, []);

  const handleWebSocketMessage = useCallback(
    (event: { type: string; data: Record<string, unknown> }) => {
      switch (event.type) {
        case "state:snapshot": {
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
        case "session:created": {
          const session = event.data.session as AgentSession;
          setSessions((prev) => new Map(prev).set(session.sessionId, session));
          if (!selectedSessionId) {
            setSelectedSessionId(session.sessionId);
          }
          break;
        }
        case "round:started":
        case "round:updated":
        case "round:completed": {
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
        case "tool:started":
        case "tool:completed": {
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
            toolCalls: prev.toolCalls + (event.type === "tool:started" ? 1 : 0),
          }));
          break;
        }
        case "log": {
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

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      await fetch("http://localhost:3000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

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

  const selectedSession = selectedSessionId
    ? sessions.get(selectedSessionId)
    : null;
  const sessionList = [...sessions.values()].sort(
    (a, b) => b.updatedAt - a.updatedAt
  );

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="bg-surface border-b border-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${connected ? "bg-success animate-pulse-dot" : "bg-error"}`}
              />
              <span className="text-sm text-text-secondary">
                {connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-4 text-sm">
              <StatBadge label="Sessions" value={stats.sessions} />
              <StatBadge label="Rounds" value={stats.rounds} />
              <StatBadge label="Tools" value={stats.toolCalls} />
              {stats.errors > 0 && (
                <StatBadge
                  label="Errors"
                  value={stats.errors}
                  variant="error"
                />
              )}
            </div>
          </div>
          <div className="text-xs text-text-muted font-medium">
            Agent Debug Console
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-border bg-surface/30 overflow-y-auto scrollbar-thin">
          <div className="sticky top-0 bg-surface/90 backdrop-blur border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
              Sessions
            </h2>
          </div>
          {sessionList.length === 0 ? (
            <div className="p-4 text-center text-text-muted text-sm">
              No sessions yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sessionList.map((session) => (
                <button
                  key={session.sessionId}
                  className={`w-full text-left px-4 py-3 hover:bg-surface-elevated/50 transition-colors ${
                    selectedSessionId === session.sessionId
                      ? "bg-surface-elevated"
                      : ""
                  }`}
                  onClick={() => setSelectedSessionId(session.sessionId)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground truncate">
                      {session.sessionId.slice(0, 8)}
                    </span>
                    <StatusBadge status={session.status} />
                  </div>
                  <div className="text-xs text-text-muted">
                    {session.agentType === "spawned" ? "Sub-agent" : "Main"} •{" "}
                    {session.rounds.length} rounds
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedSession ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Session: {selectedSession.sessionId.slice(0, 12)}...
                </h2>
                <div className="text-sm text-text-muted">
                  {selectedSession.rounds.length} round
                  {selectedSession.rounds.length !== 1 ? "s" : ""}
                </div>
              </div>

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
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-muted">
              <div className="text-center">
                <div className="text-lg font-medium mb-1">
                  No session selected
                </div>
                <div className="text-sm">
                  Send a message or select a session
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-border p-4 bg-surface">
            <div className="flex items-end gap-3 max-w-4xl mx-auto">
              <div className="flex-1 bg-background border border-border rounded-xl px-4 py-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Send a message to test the agent..."
                  disabled={isLoading}
                  rows={1}
                  className="w-full bg-transparent resize-none outline-none text-foreground placeholder:text-text-muted"
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className={`p-3 rounded-xl transition-colors ${
                  input.trim() && !isLoading
                    ? "bg-primary hover:bg-primary-hover text-white"
                    : "bg-surface-elevated text-text-muted cursor-not-allowed"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </div>
        </main>

        <aside className="w-80 border-l border-border bg-surface/30 flex flex-col overflow-hidden">
          <div className="flex border-b border-border">
            <button
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === "sessions" ? "text-foreground border-b-2 border-primary" : "text-text-muted hover:text-text-secondary"}`}
              onClick={() => setActiveTab("sessions")}
            >
              Sessions
            </button>
            <button
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === "logs" ? "text-foreground border-b-2 border-primary" : "text-text-muted hover:text-text-secondary"}`}
              onClick={() => setActiveTab("logs")}
            >
              Logs ({logs.length})
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {activeTab === "logs" ? (
              <div className="p-2 space-y-1 font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="text-text-muted text-center py-4">No logs yet</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className={`px-2 py-1 rounded ${getLogBgColor(log.level)}`}>
                      <span className={`font-medium ${getLogColor(log.level)}`}>
                        [{log.level.toUpperCase()}]
                      </span>{" "}
                      <span className="text-foreground">{log.message}</span>
                      {log.meta && Object.keys(log.meta).length > 0 && (
                        <span className="text-text-muted ml-1">
                          {JSON.stringify(log.meta)}
                        </span>
                      )}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            ) : (
              <div className="p-4 text-sm text-text-muted">
                Select a session from the left sidebar to view details.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatBadge({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "error";
}) {
  return (
    <div className={variant === "error" ? "text-error" : ""}>
      <span className="text-text-muted">{label}: </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function getLogColor(level: string): string {
  switch (level) {
    case "error": return "text-error";
    case "warn": return "text-yellow-400";
    case "info": return "text-primary-light";
    case "debug": return "text-text-muted";
    default: return "text-foreground";
  }
}

function getLogBgColor(level: string): string {
  switch (level) {
    case "error": return "bg-error/10";
    case "warn": return "bg-yellow-400/10";
    default: return "";
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    active: "bg-success/20 text-success",
    completed: "bg-text-muted/20 text-text-muted",
    error: "bg-error/20 text-error",
    processing: "bg-primary/20 text-primary-light",
    pending: "bg-text-muted/20 text-text-muted",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded ${colors[status as keyof typeof colors] || colors.pending}`}
    >
      {status}
    </span>
  );
}

function RoundCard({
  round,
  expanded,
  onToggle,
  formatDuration,
  formatTime,
}: {
  round: MessageRound;
  expanded: boolean;
  onToggle: () => void;
  formatDuration: (ms: number) => string;
  formatTime: (ts: number) => string;
}) {
  const duration = round.endTime
    ? round.endTime - round.startTime
    : Date.now() - round.startTime;

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-elevated/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            Round {round.roundIndex + 1}
          </span>
          <StatusBadge status={round.status} />
          <span className="text-xs text-text-muted">
            {round.stepsUsed} steps • {round.toolExecutions.length} tools
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            {formatDuration(duration)}
          </span>
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          <div className="p-4 space-y-4">
            <Section title="Input" icon="📥">
              <div className="bg-background rounded-lg p-3 text-sm text-foreground">
                {round.input.message}
              </div>
            </Section>

            {round.reasoning.length > 0 && (
              <Section title="Reasoning" icon="🧠">
                <div className="space-y-2">
                  {round.reasoning.map((r, i) => (
                    <div
                      key={i}
                      className="bg-background rounded-lg p-3 text-sm text-text-secondary"
                    >
                      <pre className="whitespace-pre-wrap font-mono text-xs">
                        {r.content}
                      </pre>
                      {r.durationMs && (
                        <div className="text-xs text-text-muted mt-2">
                          {formatDuration(r.durationMs)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {round.toolExecutions.length > 0 && (
              <Section title="Tool Calls" icon="🔧">
                <div className="space-y-2">
                  {round.toolExecutions.map((tool) => (
                    <ToolCard
                      key={tool.toolCallId}
                      tool={tool}
                      formatDuration={formatDuration}
                    />
                  ))}
                </div>
              </Section>
            )}

            {round.output && (
              <Section title="Output" icon="📤">
                <div className="bg-background rounded-lg p-3 text-sm text-foreground">
                  <pre className="whitespace-pre-wrap">{round.output.text}</pre>
                </div>
              </Section>
            )}

            {round.errors.length > 0 && (
              <Section title="Errors" icon="❌">
                <div className="space-y-2">
                  {round.errors.map((err, i) => (
                    <div
                      key={i}
                      className="bg-error/10 border border-error/30 rounded-lg p-3"
                    >
                      <div className="text-sm text-error font-medium">
                        {err.code && <span>[{err.code}] </span>}
                        {err.message}
                      </div>
                      {err.stepIndex !== undefined && (
                        <div className="text-xs text-error/70 mt-1">
                          Step {err.stepIndex}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {round.performance && (
              <Section title="Performance" icon="⚡">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard
                    label="Total"
                    value={formatDuration(round.performance.totalDurationMs)}
                  />
                  <MetricCard
                    label="Execution"
                    value={formatDuration(round.performance.agentExecutionMs)}
                  />
                  <MetricCard label="Steps" value={String(round.stepsUsed)} />
                  <MetricCard
                    label="Tools"
                    value={String(round.toolExecutions.length)}
                  />
                </div>
                {Object.keys(round.performance.toolMetrics).length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-text-muted mb-2">
                      Tool Metrics
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(round.performance.toolMetrics).map(
                        ([name, metrics]) => (
                          <div
                            key={name}
                            className="bg-background rounded p-2 text-xs"
                          >
                            <div className="font-medium text-foreground truncate">
                              {name}
                            </div>
                            <div className="text-text-muted">
                              {metrics.count}x • avg{" "}
                              {formatDuration(metrics.avgMs)}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="text-sm font-medium text-text-secondary">{title}</span>
      </div>
      {children}
    </div>
  );
}

function ToolCard({
  tool,
  formatDuration,
}: {
  tool: ToolExecution;
  formatDuration: (ms: number) => string;
}) {
  const [argsExpanded, setArgsExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(false);

  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={tool.status} />
          <span className="text-sm font-medium text-foreground">
            {tool.toolName}
          </span>
        </div>
        {tool.durationMs && (
          <span className="text-xs text-text-muted">
            {formatDuration(tool.durationMs)}
          </span>
        )}
      </div>

      <div className="border-t border-border px-3 py-2 space-y-2">
        <button
          onClick={() => setArgsExpanded(!argsExpanded)}
          className="w-full text-left text-xs text-text-muted hover:text-text-secondary"
        >
          {argsExpanded ? "▼" : "▶"} Arguments
        </button>
        {argsExpanded && (
          <pre className="text-xs bg-surface-elevated rounded p-2 overflow-x-auto">
            {JSON.stringify(tool.args, null, 2)}
          </pre>
        )}

        {tool.result !== undefined && (
          <>
            <button
              onClick={() => setResultExpanded(!resultExpanded)}
              className="w-full text-left text-xs text-text-muted hover:text-text-secondary"
            >
              {resultExpanded ? "▼" : "▶"} Result
            </button>
            {resultExpanded && (
              <pre className="text-xs bg-surface-elevated rounded p-2 overflow-x-auto max-h-48">
                {typeof tool.result === "string"
                  ? tool.result
                  : JSON.stringify(tool.result, null, 2)}
              </pre>
            )}
          </>
        )}

        {tool.error && (
          <div className="text-xs text-error bg-error/10 rounded p-2">
            {tool.error}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background rounded-lg p-2 text-center">
      <div className="text-lg font-semibold text-foreground">{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}
