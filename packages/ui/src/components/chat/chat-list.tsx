import React, { useRef, useCallback, useEffect } from 'react';
import {
  FlatList,
  View,
  ActivityIndicator,
  Text,
  type ListRenderItem,
} from 'react-native';
import { ChatBubble } from './chat-bubble';
import type { Message } from './types';

export interface ChatListProps {
  messages: Message[];
  isLoading?: boolean;
  className?: string;
  onEndReached?: () => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
}

export function ChatList({
  messages,
  isLoading = false,
  className = '',
  onEndReached,
  ListHeaderComponent,
  ListEmptyComponent,
}: ChatListProps) {
  const listRef = useRef<FlatList<Message>>(null);

  const scrollToEnd = useCallback(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  useEffect(() => {
    const timeout = setTimeout(scrollToEnd, 100);
    return () => clearTimeout(timeout);
  }, [messages.length, scrollToEnd]);

  const renderItem: ListRenderItem<Message> = useCallback(
    ({ item }) => <ChatBubble message={item} />,
    []
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const renderFooter = useCallback(() => {
    if (!isLoading) return null;

    return (
      <View className="flex-row items-center justify-center py-4">
        <ActivityIndicator size="small" color="#3B82F6" />
        <Text className="text-sm text-gray-500 dark:text-gray-400 ml-2">
          Agent is thinking...
        </Text>
      </View>
    );
  }, [isLoading]);

  const defaultEmptyComponent = (
    <View className="items-center px-8">
      <Text className="text-xl font-semibold text-gray-600 dark:text-gray-300 text-center">
        Start a conversation
      </Text>
      <Text className="text-base text-gray-500 dark:text-gray-400 text-center mt-2">
        Send a message to begin chatting with the AI agent
      </Text>
    </View>
  );

  return (
    <FlatList
      ref={listRef}
      data={messages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      className={`flex-1 bg-white dark:bg-gray-900 ${className}`.trim()}
      contentContainerClassName={`px-4 py-2 ${messages.length === 0 ? 'flex-1 justify-center' : ''}`.trim()}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={ListEmptyComponent ?? defaultEmptyComponent}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    />
  );
}
