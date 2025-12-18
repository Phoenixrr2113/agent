import { useState } from 'react';
import type { MessageRound } from '@agent/shared';
import { StatusBadge } from './status-badge';
import { ToolCallCard } from './tool-call-card';
import { JsonViewer } from './json-viewer';

interface RoundCardProps {
  round: MessageRound;
  isExpanded?: boolean;
}

export function RoundCard({ round, isExpanded: initialExpanded = false }: RoundCardProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const totalDuration = round.endTime ? round.endTime - round.startTime : Date.now() - round.startTime;

  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-700 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-300">Round {round.roundIndex + 1}</span>
          <StatusBadge status={round.status} />
          {round.toolExecutions.length > 0 && (
            <span className="text-xs text-slate-500">
              {round.toolExecutions.length} tool{round.toolExecutions.length !== 1 ? 's' : ''}
            </span>
          )}
          {round.errors.length > 0 && (
            <span className="text-xs text-red-400">
              {round.errors.length} error{round.errors.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{formatTime(round.startTime)}</span>
          <span className="text-xs text-slate-400">{formatDuration(totalDuration)}</span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Input</div>
            <div className="bg-slate-900 rounded p-3 text-sm text-slate-300 whitespace-pre-wrap">
              {round.input.message}
            </div>
          </div>

          {round.reasoning.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Reasoning</div>
              <div className="space-y-2">
                {round.reasoning.map((r, i) => (
                  <div key={i} className="bg-purple-900/20 border border-purple-800/30 rounded p-3 text-sm text-purple-200 whitespace-pre-wrap">
                    {r.content}
                    {r.durationMs && (
                      <div className="text-xs text-purple-400 mt-2">{formatDuration(r.durationMs)}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {round.toolExecutions.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Tool Executions ({round.toolExecutions.length})
              </div>
              <div className="space-y-2">
                {round.toolExecutions.map((tool) => (
                  <ToolCallCard key={tool.toolCallId} tool={tool} />
                ))}
              </div>
            </div>
          )}

          {round.output && (
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Output</div>
              <div className="bg-slate-900 rounded p-3 text-sm text-slate-300 whitespace-pre-wrap">
                {round.output.text}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                <span>Completed: {round.output.completed ? 'Yes' : 'No'}</span>
                <span>Needs Input: {round.output.needsInput ? 'Yes' : 'No'}</span>
                {round.output.pendingQuestion && (
                  <span className="text-yellow-400">Question: {round.output.pendingQuestion}</span>
                )}
              </div>
            </div>
          )}

          {round.errors.length > 0 && (
            <div>
              <div className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">Errors</div>
              <div className="space-y-2">
                {round.errors.map((error, i) => (
                  <div key={i} className="bg-red-900/20 border border-red-800/30 rounded p-3">
                    <div className="text-sm text-red-300">{error.message}</div>
                    {error.code && <div className="text-xs text-red-400 mt-1">Code: {error.code}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {round.performance && (
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Performance</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 rounded p-3">
                  <div className="text-xs text-slate-500">Total Duration</div>
                  <div className="text-lg font-medium text-slate-200">
                    {formatDuration(round.performance.totalDurationMs)}
                  </div>
                </div>
                <div className="bg-slate-900 rounded p-3">
                  <div className="text-xs text-slate-500">Agent Execution</div>
                  <div className="text-lg font-medium text-slate-200">
                    {formatDuration(round.performance.agentExecutionMs)}
                  </div>
                </div>
                <div className="bg-slate-900 rounded p-3">
                  <div className="text-xs text-slate-500">Steps Used</div>
                  <div className="text-lg font-medium text-slate-200">{round.stepsUsed}</div>
                </div>
                <div className="bg-slate-900 rounded p-3">
                  <div className="text-xs text-slate-500">Tool Calls</div>
                  <div className="text-lg font-medium text-slate-200">{round.toolExecutions.length}</div>
                </div>
              </div>

              {Object.keys(round.performance.toolMetrics).length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-slate-500 mb-2">Tool Metrics</div>
                  <JsonViewer data={round.performance.toolMetrics} collapsed={true} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
