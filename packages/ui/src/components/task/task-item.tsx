import React from 'react';
import { View, Text } from 'react-native';
import type { TaskItemProps } from './types';
import { getTaskStatusIcon } from './helpers';

export function TaskItem({
  children,
  status,
  className = '',
}: TaskItemProps): React.ReactElement {
  const showStatus = status !== undefined;

  return (
    <View className={`flex-row items-start gap-2 py-1.5 ${className}`.trim()}>
      {showStatus && (
        <Text className="text-sm">{getTaskStatusIcon(status)}</Text>
      )}
      <View className="flex-1">
        {typeof children === 'string' ? (
          <Text className="text-sm text-gray-700 dark:text-gray-300">{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}
