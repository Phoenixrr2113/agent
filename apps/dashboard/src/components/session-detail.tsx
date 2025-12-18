import { useEffect, useRef } from 'react';
import type { AgentSession } from '../types';
import { StatusBadge } from './status-badge';
import { RoundCard } from './round-card';

interface SessionDetailProps {
  session: AgentSession;
}

export function SessionDetail({ session }: SessionDetailProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.rounds.length]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const totalToolCalls = session.rounds.reduce((sum, r) => sum + r.toolExecutions.length, 0);
  const totalErrors = session.rounds.reduce((sum, r) => sum + r.errors.length, 0);
  const totalDuration = session.rounds.reduce((sum, r) => {
    if (r.endTime) return sum + (r.endTime - r.startTime);
    return sum;
  }, 0);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-slate-700 px-6 py-4 bg-slate-800/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-200">
              Session {session.sessionId.slice(0, 8)}
            </h2>
            <StatusBadge status={session.status} size="md" />
          </div>
          <div className="text-sm text-slate-400">{formatTime(session.createdAt)}</div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Type</div>
            <div className="text-lg font-medium text-slate-200">{session.agentType}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Rounds</div>
            <div className="text-lg font-medium text-slate-200">{session.rounds.length}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Tool Calls</div>
            <div className="text-lg font-medium text-slate-200">{totalToolCalls}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Total Time</div>
            <div className="text-lg font-medium text-slate-200">
              {totalDuration < 1000 ? `${totalDuration}ms` : `${(totalDuration / 1000).toFixed(1)}s`}
            </div>
          </div>
        </div>

        {session.role && (
          <div className="mt-3 text-sm text-slate-400">
            Role: <span className="text-slate-300">{session.role}</span>
          </div>
        )}

        {session.parentAgentId && (
          <div className="mt-1 text-sm text-slate-400">
            Parent Agent: <span className="text-slate-300 font-mono">{session.parentAgentId.slice(0, 8)}...</span>
          </div>
        )}

        {totalErrors > 0 && (
          <div className="mt-3 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2 text-sm text-red-300">
            {totalErrors} error{totalErrors !== 1 ? 's' : ''} occurred in this session
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 scrollbar-thin">
        {session.rounds.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            <div className="text-sm">No rounds yet</div>
            <div className="text-xs mt-1">Messages will appear here as the agent processes them</div>
          </div>
        ) : (
          <div className="space-y-4">
            {session.rounds.map((round, index) => (
              <RoundCard
                key={round.roundId}
                round={round}
                isExpanded={index === session.rounds.length - 1}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
