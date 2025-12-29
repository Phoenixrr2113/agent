import React from 'react';
import { View } from 'react-native';
import type { ToolContentProps } from './types';
import { useToolContext } from './tool';

export function ToolContent({
  children,
  className = '',
}: ToolContentProps): React.ReactElement | null {
  const { isOpen } = useToolContext();

  if (!isOpen) {
    return null;
  }

  return (
    <View className={`p-3 ${className}`.trim()}>
      {children}
    </View>
  );
}
