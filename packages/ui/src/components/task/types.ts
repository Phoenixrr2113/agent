import type { ReactNode } from 'react';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'error';

export interface TaskContextValue {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}

export interface TaskProps {
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export interface TaskTriggerProps {
  title: string;
  status?: TaskStatus;
  completedCount?: number;
  totalCount?: number;
  className?: string;
}

export interface TaskContentProps {
  children: ReactNode;
  className?: string;
}

export interface TaskItemProps {
  children: ReactNode;
  status?: TaskStatus;
  className?: string;
}

export interface TaskItemFileProps {
  icon?: ReactNode;
  name: string;
  className?: string;
}
