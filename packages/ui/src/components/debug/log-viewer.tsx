import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { LogViewerProps, LogEntry } from './types';

function getLogColor(level: string): string {
  switch (level) {
    case 'error': return 'text-red-500';
    case 'warn': return 'text-yellow-400';
    case 'info': return 'text-blue-400';
    case 'debug': return 'text-gray-500';
    default: return 'text-gray-900 dark:text-white';
  }
}

function getLogBgColor(level: string): string {
  switch (level) {
    case 'error': return 'bg-red-500/10';
    case 'warn': return 'bg-yellow-400/10';
    default: return '';
  }
}

function LogEntryRow({ log }: { log: LogEntry }) {
  const textColor = getLogColor(log.level);
  const bgColor = getLogBgColor(log.level);
  
  return (
    <View className={`px-2 py-1 rounded mb-1 ${bgColor}`}>
      <Text className="text-xs">
        <Text className={`font-medium ${textColor}`}>
          [{log.level.toUpperCase()}]
        </Text>
        <Text className="text-gray-900 dark:text-white"> {log.message}</Text>
        {log.meta && Object.keys(log.meta).length > 0 && (
          <Text className="text-gray-500 dark:text-gray-400 ml-1">
            {JSON.stringify(log.meta)}
          </Text>
        )}
      </Text>
    </View>
  );
}

export function LogViewer({ logs }: LogViewerProps) {
  if (logs.length === 0) {
    return (
      <View className="p-4 items-center">
        <Text className="text-sm text-gray-500 dark:text-gray-400">No logs yet</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 p-2">
      {logs.map((log, i) => (
        <LogEntryRow key={i} log={log} />
      ))}
    </ScrollView>
  );
}
