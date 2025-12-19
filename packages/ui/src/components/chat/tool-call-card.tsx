import React, { useState } from 'react';
import { View, Pressable, Text, ScrollView, Platform } from 'react-native';
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

const MAX_COLLAPSED_LENGTH = 500;

function JsonDisplay({ data, maxLength }: { data: string; maxLength?: number }) {
  const displayData = maxLength && data.length > maxLength 
    ? data.slice(0, maxLength) + '\n...' 
    : data;

  return (
    <View className="bg-gray-900 rounded-lg p-3 overflow-hidden">
      <Text 
        className="text-sm text-gray-100"
        style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }}
      >
        {displayData}
      </Text>
    </View>
  );
}

export function ToolCallCard({ toolCall, className = '' }: ToolCallCardProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullInput, setShowFullInput] = useState(false);
  const [showFullOutput, setShowFullOutput] = useState(false);

  const statusIcon = STATUS_ICONS[toolCall.status];
  const hasResult = toolCall.result !== undefined;
  const hasArgs = Object.keys(toolCall.args).length > 0;

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatJson = (obj: unknown): string => {
    return JSON.stringify(obj, null, 2);
  };

  const argsJson = formatJson(toolCall.args);
  const resultJson = toolCall.result !== undefined
    ? (typeof toolCall.result === 'string' ? toolCall.result : formatJson(toolCall.result))
    : '';

  const isArgsLong = argsJson.length > MAX_COLLAPSED_LENGTH;
  const isResultLong = resultJson.length > MAX_COLLAPSED_LENGTH;

  return (
    <View
      className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 my-2 overflow-hidden ${className}`.trim()}
    >
      <Pressable
        className="flex-row justify-between items-center px-3 py-2.5 bg-gray-100 dark:bg-gray-800"
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View className="flex-row items-center gap-2">
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
          <Text className="text-xs text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </Text>
        </View>
      </Pressable>

      {isExpanded && (
        <View className="p-3">
          {hasArgs && (
            <View>
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Input:
              </Text>
              <JsonDisplay 
                data={argsJson} 
                maxLength={showFullInput ? undefined : MAX_COLLAPSED_LENGTH} 
              />
              {isArgsLong && (
                <Pressable onPress={() => setShowFullInput(!showFullInput)}>
                  <Text className="text-xs text-blue-500 mt-1">
                    {showFullInput ? 'Show less' : 'Show more'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {hasResult && (
            <View className="mt-3">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Output:
              </Text>
              <ScrollView className="max-h-64">
                <JsonDisplay 
                  data={resultJson}
                  maxLength={showFullOutput ? undefined : MAX_COLLAPSED_LENGTH} 
                />
              </ScrollView>
              {isResultLong && (
                <Pressable onPress={() => setShowFullOutput(!showFullOutput)}>
                  <Text className="text-xs text-blue-500 mt-1">
                    {showFullOutput ? 'Show less' : 'Show more'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
