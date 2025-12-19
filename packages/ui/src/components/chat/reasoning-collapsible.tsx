import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';

export interface ReasoningCollapsibleProps {
  content: string;
  durationMs?: number;
  defaultExpanded?: boolean;
  className?: string;
}

export function ReasoningCollapsible({
  content,
  durationMs,
  defaultExpanded = false,
  className = '',
}: ReasoningCollapsibleProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <View
      className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 my-1 overflow-hidden ${className}`.trim()}
    >
      <Pressable
        className="flex-row justify-between items-center px-3 py-2"
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View className="flex-row items-center gap-1">
          <Text className="text-sm text-gray-500 dark:text-gray-400">💭</Text>
          <Text className="text-sm italic text-gray-500 dark:text-gray-400">
            Thinking
            {durationMs !== undefined && ` (${formatDuration(durationMs)})`}
          </Text>
        </View>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {isExpanded ? '▼' : '▶'}
        </Text>
      </Pressable>

      {isExpanded && (
        <View className="px-3 pb-3">
          <Text className="text-sm italic text-gray-600 dark:text-gray-300 leading-5">
            {content}
          </Text>
        </View>
      )}
    </View>
  );
}
