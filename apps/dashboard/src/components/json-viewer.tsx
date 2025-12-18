import { useState } from 'react';

interface JsonViewerProps {
  data: unknown;
  collapsed?: boolean;
  maxHeight?: string;
}

export function JsonViewer({ data, collapsed = true, maxHeight = '200px' }: JsonViewerProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsed);

  const renderValue = (value: unknown, depth: number = 0): JSX.Element => {
    if (value === null) {
      return <span className="json-null">null</span>;
    }

    if (value === undefined) {
      return <span className="json-null">undefined</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="json-boolean">{String(value)}</span>;
    }

    if (typeof value === 'number') {
      return <span className="json-number">{value}</span>;
    }

    if (typeof value === 'string') {
      const displayValue = value.length > 200 ? `${value.slice(0, 200)}...` : value;
      return <span className="json-string">"{displayValue}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return <span>[]</span>;
      return (
        <span>
          {'['}
          <div className="ml-4">
            {value.slice(0, 10).map((item, i) => (
              <div key={i}>
                {renderValue(item, depth + 1)}
                {i < value.length - 1 && <span>,</span>}
              </div>
            ))}
            {value.length > 10 && <div className="text-slate-500">... {value.length - 10} more items</div>}
          </div>
          {']'}
        </span>
      );
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return <span>{'{}'}</span>;
      return (
        <span>
          {'{'}
          <div className="ml-4">
            {entries.slice(0, 20).map(([key, val], i) => (
              <div key={key}>
                <span className="json-key">"{key}"</span>: {renderValue(val, depth + 1)}
                {i < entries.length - 1 && <span>,</span>}
              </div>
            ))}
            {entries.length > 20 && <div className="text-slate-500">... {entries.length - 20} more keys</div>}
          </div>
          {'}'}
        </span>
      );
    }

    return <span>{String(value)}</span>;
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="text-xs text-slate-400 hover:text-slate-300 bg-slate-800 px-2 py-1 rounded"
      >
        Show data
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(false)}
        className="absolute top-1 right-1 text-xs text-slate-400 hover:text-slate-300 z-10"
      >
        Collapse
      </button>
      <div
        className="json-viewer bg-slate-900 rounded p-3 overflow-auto scrollbar-thin"
        style={{ maxHeight }}
      >
        {renderValue(data)}
      </div>
    </div>
  );
}
