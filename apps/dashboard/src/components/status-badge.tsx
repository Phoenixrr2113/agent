interface StatusBadgeProps {
  status: 'active' | 'completed' | 'error' | 'pending' | 'processing' | 'running' | 'success';
  size?: 'sm' | 'md';
}

const statusStyles: Record<StatusBadgeProps['status'], { bg: string; text: string; dot?: string }> = {
  active: { bg: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-400' },
  running: { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' },
  processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' },
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  completed: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  success: { bg: 'bg-green-500/20', text: 'text-green-400' },
  error: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const style = statusStyles[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${style.bg} ${style.text} ${sizeClasses} font-medium`}>
      {style.dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${status === 'active' || status === 'running' || status === 'processing' ? 'animate-pulse-dot' : ''}`} />
      )}
      {status}
    </span>
  );
}
