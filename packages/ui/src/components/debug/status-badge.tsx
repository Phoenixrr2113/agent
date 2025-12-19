import React from 'react';
import { View, Text } from 'react-native';
import type { StatusBadgeProps } from './types';

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-500',
  completed: 'bg-gray-500/20 text-gray-500',
  error: 'bg-red-500/20 text-red-500',
  processing: 'bg-blue-500/20 text-blue-400',
  pending: 'bg-gray-500/20 text-gray-500',
  running: 'bg-blue-500/20 text-blue-400',
  success: 'bg-green-500/20 text-green-500',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const colorClass = statusColors[status] || statusColors.pending;
  
  return (
    <View className={`px-2 py-0.5 rounded ${colorClass}`}>
      <Text className="text-xs font-medium">{status}</Text>
    </View>
  );
}
