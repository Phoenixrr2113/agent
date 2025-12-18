import type { ToolExecution } from '@agent/shared';
import { StatusBadge } from './status-badge';
import { JsonViewer } from './json-viewer';

interface ToolCallCardProps {
  tool: ToolExecution;
}

export function ToolCallCard({ tool }: ToolCallCardProps) {
  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200">{tool.toolName}</span>
          <StatusBadge status={tool.status} />
        </div>
        <span className="text-xs text-slate-400">{formatDuration(tool.durationMs)}</span>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <div className="text-xs text-slate-500 mb-1">Arguments</div>
          <JsonViewer data={tool.args} collapsed={true} maxHeight="150px" />
        </div>

        {tool.result !== undefined && (
          <div>
            <div className="text-xs text-slate-500 mb-1">Result</div>
            <JsonViewer data={tool.result} collapsed={true} maxHeight="150px" />
          </div>
        )}

        {tool.error && (
          <div>
            <div className="text-xs text-red-400 mb-1">Error</div>
            <div className="text-sm text-red-300 bg-red-900/20 rounded p-2">{tool.error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
