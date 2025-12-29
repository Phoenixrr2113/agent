import React from 'react';
import { View, Pressable, Text } from 'react-native';
import type { ToolHeaderProps } from './types';
import { useToolContext } from './tool';
import { getStatusIcon, formatToolName, formatDuration } from './helpers';

export function ToolHeader({
  type,
  state = 'pending',
  durationMs,
  className = '',
}: ToolHeaderProps): React.ReactElement {
  const { isOpen, setIsOpen } = useToolContext();

  const statusIcon = getStatusIcon(state);
  const displayName = type ? formatToolName(type) : 'Tool';

  return (
    <Pressable
      className={`flex-row justify-between items-center px-3 py-2.5 bg-gray-100 dark:bg-gray-800 ${className}`.trim()}
      onPress={() => setIsOpen(!isOpen)}
      accessibilityRole="button"
      accessibilityLabel={`${displayName} - ${state}`}
      accessibilityHint="Double tap to expand or collapse"
    >
      <View className="flex-row items-center gap-2">
        <Text className="text-sm">{statusIcon}</Text>
        <Text className="text-sm font-semibold text-gray-900 dark:text-white">
          {displayName}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {durationMs !== undefined && (
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {formatDuration(durationMs)}
          </Text>
        )}
        <Text className="text-xs text-gray-400">
          {isOpen ? '▼' : '▶'}
        </Text>
      </View>
    </Pressable>
  );
}
