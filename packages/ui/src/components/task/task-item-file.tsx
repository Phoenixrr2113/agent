import React from 'react';
import { View, Text, Platform } from 'react-native';
import type { TaskItemFileProps } from './types';

export function TaskItemFile({
  icon,
  name,
  className = '',
}: TaskItemFileProps): React.ReactElement {
  return (
    <View
      className={`inline-flex flex-row items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 ${className}`.trim()}
    >
      {icon && <Text className="text-xs">{icon}</Text>}
      <Text
        className="text-xs text-gray-700 dark:text-gray-300"
        style={{
          fontFamily: Platform.select({
            ios: 'Menlo',
            android: 'monospace',
            default: 'monospace',
          }),
        }}
      >
        {name}
      </Text>
    </View>
  );
}
