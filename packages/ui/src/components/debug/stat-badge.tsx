import React from 'react';
import { View, Text } from 'react-native';
import type { StatBadgeProps } from './types';

export function StatBadge({ label, value, variant = 'default' }: StatBadgeProps) {
  const valueColor = variant === 'error' ? 'text-red-500' : 'text-gray-900 dark:text-white';
  
  return (
    <View className="flex-row items-center">
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}: </Text>
      <Text className={`text-sm font-medium ${valueColor}`}>{value}</Text>
    </View>
  );
}
