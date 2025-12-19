import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { StatusBadge } from './status-badge';
import type { SessionListProps } from './types';

export function SessionList({
  sessions,
  selectedSessionId,
  onSelectSession,
}: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <View className="p-4 items-center">
        <Text className="text-sm text-gray-500 dark:text-gray-400">No sessions yet</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      {sessions.map((session) => (
        <Pressable
          key={session.sessionId}
          onPress={() => onSelectSession(session.sessionId)}
          className={`px-4 py-3 border-b border-gray-200 dark:border-gray-700 ${
            selectedSessionId === session.sessionId
              ? 'bg-gray-100 dark:bg-gray-800'
              : ''
          }`}
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-sm font-medium text-gray-900 dark:text-white">
              {session.sessionId.slice(0, 8)}
            </Text>
            <StatusBadge status={session.status} />
          </View>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {session.agentType === 'spawned' ? 'Sub-agent' : 'Main'} •{' '}
            {session.rounds.length} rounds
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
