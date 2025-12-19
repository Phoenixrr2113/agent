import { type PropsWithChildren, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View className="bg-white dark:bg-gray-900">
      <Pressable
        className="flex-row items-center gap-1.5"
        onPress={() => setIsOpen((value) => !value)}
      >
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={colorScheme === 'light' ? '#6B7280' : '#9CA3AF'}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </Text>
      </Pressable>
      {isOpen && (
        <View className="mt-1.5 ml-6 bg-white dark:bg-gray-900">
          {children}
        </View>
      )}
    </View>
  );
}
