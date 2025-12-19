import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
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
  const [expanded, setExpanded] = useState(false);
  const textColor = getLogColor(log.level);
  const bgColor = getLogBgColor(log.level);
  
  const metaStr = log.meta && Object.keys(log.meta).length > 0 
    ? JSON.stringify(log.meta, null, 2) 
    : null;
  
  const isLong = log.message.length > 80 || (metaStr && metaStr.length > 100);
  
  return (
    <Pressable 
      onPress={() => isLong && setExpanded(!expanded)}
      className={`px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 ${bgColor}`}
    >
      <View className="flex-row items-start gap-2">
        <Text className={`text-xs font-mono font-medium ${textColor} w-12`}>
          {log.level.toUpperCase()}
        </Text>
        <View className="flex-1">
          <Text 
            numberOfLines={expanded ? undefined : 2}
            className="text-xs font-mono text-gray-900 dark:text-white"
          >
            {log.message}
          </Text>
          {metaStr && expanded && (
            <ScrollView horizontal className="mt-1">
              <Text className="text-xs font-mono text-gray-500 dark:text-gray-400">
                {metaStr}
              </Text>
            </ScrollView>
          )}
          {isLong && !expanded && (
            <Text className="text-xs text-blue-500 mt-0.5">
              Tap to expand...
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function LogViewer({ logs }: LogViewerProps) {
  if (logs.length === 0) {
    return (
      <View className="flex-1 p-4 items-center justify-center">
        <Text className="text-sm text-gray-500 dark:text-gray-400">No logs yet</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900">
      {logs.slice().reverse().map((log, i) => (
        <LogEntryRow key={logs.length - i} log={log} />
      ))}
    </ScrollView>
  );
}
