import React from 'react';
import { View, Pressable, Text } from 'react-native';
import type { TaskTriggerProps } from './types';
import { useTaskContext } from './task';
import { getTaskStatusIcon, formatProgress } from './helpers';

export function TaskTrigger({
  title,
  status = 'pending',
  completedCount,
  totalCount,
  className = '',
}: TaskTriggerProps): React.ReactElement {
  const { isOpen, setIsOpen } = useTaskContext();

  const statusIcon = getTaskStatusIcon(status);
  const showProgress = completedCount !== undefined && totalCount !== undefined;

  return (
    <Pressable
      className={`flex-row justify-between items-center px-3 py-3 bg-gray-50 dark:bg-gray-800 ${className}`.trim()}
      onPress={() => setIsOpen(!isOpen)}
      accessibilityRole="button"
      accessibilityLabel={`${title} - ${status}`}
      accessibilityHint="Double tap to expand or collapse"
    >
      <View className="flex-row items-center gap-2 flex-1">
        <Text className="text-sm">{statusIcon}</Text>
        <Text className="text-sm font-semibold text-gray-900 dark:text-white flex-1" numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {showProgress && (
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {formatProgress(completedCount, totalCount)}
          </Text>
        )}
        <Text className="text-xs text-gray-400">
          {isOpen ? '▼' : '▶'}
        </Text>
      </View>
    </Pressable>
  );
}
