import React, { useState } from 'react';
import { View, Pressable, Text, ScrollView } from 'react-native';
import type { ToolCallInfo } from '@agent/api-client';

export interface ToolCallCardProps {
  toolCall: ToolCallInfo;
  className?: string;
}

const STATUS_ICONS: Record<ToolCallInfo['status'], string> = {
  pending: '⏳',
  running: '⚙️',
  complete: '✅',
  error: '❌',
};

export function ToolCallCard({ toolCall, className = '' }: ToolCallCardProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusIcon = STATUS_ICONS[toolCall.status];
  const hasResult = toolCall.result !== undefined;
  const hasArgs = Object.keys(toolCall.args).length > 0;

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const truncateJson = (obj: unknown, maxLength = 100): string => {
    const str = JSON.stringify(obj, null, 2);
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '...';
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
          <Text className="text-sm">{statusIcon}</Text>
          <Text className="text-sm font-semibold text-gray-900 dark:text-white">
            {toolCall.toolName}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {toolCall.durationMs !== undefined && (
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {formatDuration(toolCall.durationMs)}
            </Text>
          )}
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </Text>
        </View>
      </Pressable>

      {isExpanded && (
        <View className="px-3 pb-3">
          {hasArgs && (
            <View className="mt-1">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Input:
              </Text>
              <ScrollView horizontal className="mt-1">
                <View className="bg-gray-200 dark:bg-gray-700 rounded p-2">
                  <Text className="text-xs font-mono text-gray-800 dark:text-gray-200">
                    {truncateJson(toolCall.args, 300)}
                  </Text>
                </View>
              </ScrollView>
            </View>
          )}

          {hasResult && (
            <View className="mt-2">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Output:
              </Text>
              <ScrollView horizontal className="mt-1 max-h-48">
                <View className="bg-gray-200 dark:bg-gray-700 rounded p-2">
                  <Text className="text-xs font-mono text-gray-800 dark:text-gray-200">
                    {typeof toolCall.result === 'string'
                      ? toolCall.result.slice(0, 300) + (toolCall.result.length > 300 ? '...' : '')
                      : truncateJson(toolCall.result, 300)}
                  </Text>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
