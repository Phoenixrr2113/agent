interface StatsBarProps {
  totalSessions: number;
  activeSessions: number;
  totalRounds: number;
  totalToolCalls: number;
  totalErrors: number;
  connected: boolean;
}

export function StatsBar({
  totalSessions,
  activeSessions,
  totalRounds,
  totalToolCalls,
  totalErrors,
  connected,
}: StatsBarProps) {
  return (
    <div className="bg-slate-800 border-b border-slate-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse-dot' : 'bg-red-400'}`} />
            <span className="text-sm text-slate-400">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>

          <div className="h-4 w-px bg-slate-600" />

          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-slate-500">Sessions: </span>
              <span className="text-slate-200 font-medium">{totalSessions}</span>
              {activeSessions > 0 && (
                <span className="text-green-400 ml-1">({activeSessions} active)</span>
              )}
            </div>
            <div>
              <span className="text-slate-500">Rounds: </span>
              <span className="text-slate-200 font-medium">{totalRounds}</span>
            </div>
            <div>
              <span className="text-slate-500">Tool Calls: </span>
              <span className="text-slate-200 font-medium">{totalToolCalls}</span>
            </div>
            {totalErrors > 0 && (
              <div className="text-red-400">
                <span className="text-red-400/70">Errors: </span>
                <span className="font-medium">{totalErrors}</span>
              </div>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Agent Logs Dashboard
        </div>
      </div>
    </div>
  );
}
