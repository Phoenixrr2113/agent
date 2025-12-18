import type { AgentSession } from '../types';
import { StatusBadge } from './status-badge';

interface SessionListProps {
  sessions: AgentSession[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

export function SessionList({ sessions, selectedSessionId, onSelectSession }: SessionListProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center text-slate-500">
        <div className="text-sm">No sessions yet</div>
        <div className="text-xs mt-1">Sessions will appear here when agents start running</div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-700">
      {sessions.map((session) => (
        <button
          key={session.sessionId}
          onClick={() => onSelectSession(session.sessionId)}
          className={`w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors ${
            selectedSessionId === session.sessionId ? 'bg-slate-700/70' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-slate-200 truncate max-w-[150px]">
              {session.sessionId.slice(0, 8)}...
            </span>
            <StatusBadge status={session.status} />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{session.agentType === 'spawned' ? 'Sub-agent' : 'Main'}</span>
            {session.role && <span className="text-slate-500">{session.role}</span>}
          </div>

          <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
            <span>{session.rounds.length} round{session.rounds.length !== 1 ? 's' : ''}</span>
            <span>{formatTime(session.updatedAt)}</span>
          </div>

          {session.parentAgentId && (
            <div className="text-xs text-slate-600 mt-1 truncate">
              Parent: {session.parentAgentId.slice(0, 8)}...
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
