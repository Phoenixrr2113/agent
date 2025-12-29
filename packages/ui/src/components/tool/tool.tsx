import React, { createContext, useContext, useState, useMemo } from 'react';
import { View } from 'react-native';
import type { ToolProps, ToolContextValue } from './types';

const ToolContext = createContext<ToolContextValue | null>(null);

export function useToolContext(): ToolContextValue {
  const context = useContext(ToolContext);
  if (!context) {
    throw new Error('Tool compound components must be used within a <Tool> component');
  }
  return context;
}

export function Tool({
  children,
  defaultOpen = false,
  className = '',
}: ToolProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const contextValue = useMemo<ToolContextValue>(
    () => ({ isOpen, setIsOpen }),
    [isOpen]
  );

  return (
    <ToolContext.Provider value={contextValue}>
      <View
        className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 my-2 overflow-hidden ${className}`.trim()}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        {children}
      </View>
    </ToolContext.Provider>
  );
}
