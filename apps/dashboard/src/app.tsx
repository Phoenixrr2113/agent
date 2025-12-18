import { useDashboard } from './hooks';
import { SessionList, SessionDetail, StatsBar } from './components';

export function App() {
  const {
    sessions,
    activeSessionIds,
    totalRounds,
    totalToolCalls,
    totalErrors,
    connected,
    connectionError,
    selectedSession,
    sessionList,
    selectSession,
  } = useDashboard();

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <StatsBar
        totalSessions={sessions.size}
        activeSessions={activeSessionIds.length}
        totalRounds={totalRounds}
        totalToolCalls={totalToolCalls}
        totalErrors={totalErrors}
        connected={connected}
      />

      {connectionError && (
        <div className="bg-red-900/30 border-b border-red-800/50 px-6 py-2 text-sm text-red-300">
          {connectionError}. Retrying connection...
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-slate-700 bg-slate-800/30 overflow-y-auto scrollbar-thin">
          <div className="sticky top-0 bg-slate-800/90 backdrop-blur border-b border-slate-700 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Sessions</h2>
          </div>
          <SessionList
            sessions={sessionList}
            selectedSessionId={selectedSession?.sessionId ?? null}
            onSelectSession={selectSession}
          />
        </aside>

        <main className="flex-1 overflow-hidden">
          {selectedSession ? (
            <SessionDetail session={selectedSession} />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
                <div className="text-lg font-medium mb-1">No session selected</div>
                <div className="text-sm">Select a session from the sidebar to view its logs</div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
