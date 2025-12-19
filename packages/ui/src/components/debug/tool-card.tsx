import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { StatusBadge } from './status-badge';
import type { ToolCardProps } from './types';

export function ToolCard({ tool, formatDuration }: ToolCardProps) {
  const [argsExpanded, setArgsExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(false);

  return (
    <View className="bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <View className="px-3 py-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <StatusBadge status={tool.status} />
          <Text className="text-sm font-medium text-gray-900 dark:text-white">
            {tool.toolName}
          </Text>
        </View>
        {tool.durationMs !== undefined && (
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {formatDuration(tool.durationMs)}
          </Text>
        )}
      </View>

      <View className="border-t border-gray-200 dark:border-gray-700 px-3 py-2">
        <Pressable
          onPress={() => setArgsExpanded(!argsExpanded)}
          className="py-1"
        >
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {argsExpanded ? '▼' : '▶'} Arguments
          </Text>
        </Pressable>
        {argsExpanded && (
          <ScrollView horizontal className="mt-2">
            <View className="bg-gray-200 dark:bg-gray-700 rounded p-2">
              <Text className="text-xs font-mono text-gray-900 dark:text-white">
                {JSON.stringify(tool.args, null, 2)}
              </Text>
            </View>
          </ScrollView>
        )}

        {tool.result !== undefined && (
          <>
            <Pressable
              onPress={() => setResultExpanded(!resultExpanded)}
              className="py-1 mt-2"
            >
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {resultExpanded ? '▼' : '▶'} Result
              </Text>
            </Pressable>
            {resultExpanded && (
              <ScrollView horizontal className="mt-2 max-h-48">
                <View className="bg-gray-200 dark:bg-gray-700 rounded p-2">
                  <Text className="text-xs font-mono text-gray-900 dark:text-white">
                    {typeof tool.result === 'string'
                      ? tool.result
                      : JSON.stringify(tool.result, null, 2)}
                  </Text>
                </View>
              </ScrollView>
            )}
          </>
        )}

        {tool.error && (
          <View className="mt-2 bg-red-500/10 rounded p-2">
            <Text className="text-xs text-red-500">{tool.error}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
