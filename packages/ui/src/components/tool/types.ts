import type { ReactNode } from 'react';

export type ToolState = 'pending' | 'running' | 'completed' | 'error';

export interface ToolContextValue {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}

export interface ToolProps {
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export interface ToolHeaderProps {
  type?: string;
  state?: ToolState;
  durationMs?: number;
  className?: string;
}

export interface ToolContentProps {
  children: ReactNode;
  className?: string;
}

export interface ToolInputProps {
  input?: Record<string, unknown>;
  isStreaming?: boolean;
  className?: string;
}

export interface ToolOutputProps {
  output?: ReactNode | unknown;
  errorText?: string;
  className?: string;
}
