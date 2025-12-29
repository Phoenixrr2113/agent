import React from 'react';
import { View, Text, Platform } from 'react-native';
import type { ToolInputProps } from './types';
import { formatJson } from './helpers';

function JsonDisplay({ data }: { data: string }): React.ReactElement {
  return (
    <View className="bg-gray-900 rounded-lg p-3 overflow-hidden">
      <Text
        className="text-sm text-gray-100"
        style={{
          fontFamily: Platform.select({
            ios: 'Menlo',
            android: 'monospace',
            default: 'monospace',
          }),
        }}
      >
        {data}
      </Text>
    </View>
  );
}

export function ToolInput({
  input,
  isStreaming = false,
  className = '',
}: ToolInputProps): React.ReactElement | null {
  if (!input && !isStreaming) {
    return null;
  }

  const hasInput = input && Object.keys(input).length > 0;

  return (
    <View className={className}>
      <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
        Input
      </Text>
      {isStreaming && !hasInput ? (
        <View className="bg-gray-900 rounded-lg p-3">
          <Text className="text-sm text-gray-400 italic">Streaming...</Text>
        </View>
      ) : hasInput ? (
        <JsonDisplay data={formatJson(input)} />
      ) : null}
    </View>
  );
}
