import React from 'react';
import { View, Text } from 'react-native';
import type { SectionProps } from './types';

export function Section({ title, icon, children }: SectionProps) {
  return (
    <View className="mb-4">
      <View className="flex-row items-center gap-2 mb-2">
        <Text className="text-base">{icon}</Text>
        <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</Text>
      </View>
      {children}
    </View>
  );
}
