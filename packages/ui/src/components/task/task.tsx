import React, { createContext, useContext, useState, useMemo } from 'react';
import { View } from 'react-native';
import type { TaskProps, TaskContextValue } from './types';

const TaskContext = createContext<TaskContextValue | null>(null);

export function useTaskContext(): TaskContextValue {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('Task compound components must be used within a <Task> component');
  }
  return context;
}

export function Task({
  children,
  defaultOpen = false,
  className = '',
}: TaskProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const contextValue = useMemo<TaskContextValue>(
    () => ({ isOpen, setIsOpen }),
    [isOpen]
  );

  return (
    <TaskContext.Provider value={contextValue}>
      <View
        className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 my-2 overflow-hidden ${className}`.trim()}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        {children}
      </View>
    </TaskContext.Provider>
  );
}
