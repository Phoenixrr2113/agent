import React, { isValidElement } from 'react';
import { View, Text, Platform, ScrollView } from 'react-native';
import type { ToolOutputProps } from './types';
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

export function ToolOutput({
  output,
  errorText,
  className = '',
}: ToolOutputProps): React.ReactElement | null {
  const hasOutput = output !== undefined && output !== null;
  const hasError = !!errorText;

  if (!hasOutput && !hasError) {
    return null;
  }

  if (hasError) {
    return (
      <View className={`mt-3 ${className}`.trim()}>
        <Text className="text-xs font-medium text-red-500 dark:text-red-400 mb-2">
          Error
        </Text>
        <View className="bg-red-950 border border-red-800 rounded-lg p-3">
          <Text className="text-sm text-red-300">{errorText}</Text>
        </View>
      </View>
    );
  }

  const isReactElement = isValidElement(output);
  const outputContent = isReactElement
    ? output
    : typeof output === 'string'
      ? output
      : formatJson(output);

  return (
    <View className={`mt-3 ${className}`.trim()}>
      <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
        Output
      </Text>
      <ScrollView className="max-h-64">
        {isReactElement ? (
          output
        ) : (
          <JsonDisplay data={outputContent as string} />
        )}
      </ScrollView>
    </View>
  );
}
