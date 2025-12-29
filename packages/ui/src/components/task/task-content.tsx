import React from 'react';
import { View } from 'react-native';
import type { TaskContentProps } from './types';
import { useTaskContext } from './task';

export function TaskContent({
  children,
  className = '',
}: TaskContentProps): React.ReactElement | null {
  const { isOpen } = useTaskContext();

  if (!isOpen) {
    return null;
  }

  return (
    <View className={`px-3 pb-3 ${className}`.trim()}>
      {children}
    </View>
  );
}
