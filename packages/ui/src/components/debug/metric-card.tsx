import React from 'react';
import { View, Text } from 'react-native';
import type { MetricCardProps } from './types';

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <View className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 items-center">
      <Text className="text-lg font-semibold text-gray-900 dark:text-white">{value}</Text>
      <Text className="text-xs text-gray-500 dark:text-gray-400">{label}</Text>
    </View>
  );
}
