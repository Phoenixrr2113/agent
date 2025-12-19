import React from 'react';
import { View, Text } from 'react-native';
import type { SourceInfo } from '@agent/api-client';

export interface SourcesListProps {
  sources: SourceInfo[];
  className?: string;
}

export function SourcesList({ sources, className = '' }: SourcesListProps): React.ReactElement | null {
  if (sources.length === 0) {
    return null;
  }

  return (
    <View className={`mt-2 ${className}`.trim()}>
      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        📚 Sources ({sources.length})
      </Text>
      <View className="gap-1">
        {sources.map((source, index) => (
          <View
            key={source.id || index}
            className="p-2 rounded bg-gray-100 dark:bg-gray-800"
          >
            <Text className="text-sm font-medium text-gray-900 dark:text-white" numberOfLines={1}>
              {source.title}
            </Text>
            {source.snippet && (
              <Text className="text-xs text-gray-600 dark:text-gray-300 mt-0.5" numberOfLines={2}>
                {source.snippet}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
