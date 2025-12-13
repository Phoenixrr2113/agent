import React, { useRef, useCallback, useEffect } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  ActivityIndicator,
  type ViewStyle,
  type ListRenderItem,
} from 'react-native';
import { useTheme } from '../../hooks/use-theme';
import { ChatBubble } from './chat-bubble';
import { Text } from '../text';
import { spacing } from '../../themes/spacing';
import type { Message } from './types';

export interface ChatListProps {
  messages: Message[];
  isLoading?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  onEndReached?: () => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
}

export function ChatList({
  messages,
  isLoading = false,
  style,
  contentContainerStyle,
  onEndReached,
  ListHeaderComponent,
  ListEmptyComponent,
}: ChatListProps) {
  const { colors } = useTheme();
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text variant="caption" color={colors.textMuted} style={styles.loadingText}>
          Agent is thinking...
        </Text>
      </View>
    );
  }, [isLoading, colors]);

  const defaultEmptyComponent = (
    <View style={styles.emptyContainer}>
      <Text variant="subtitle" color={colors.textSecondary} align="center">
        Start a conversation
      </Text>
      <Text variant="body" color={colors.textMuted} align="center" style={styles.emptySubtext}>
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
      style={[styles.list, { backgroundColor: colors.background }, style]}
      contentContainerStyle={[
        styles.contentContainer,
        messages.length === 0 && styles.emptyContentContainer,
        contentContainerStyle,
      ]}
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

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyContentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  loadingText: {
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptySubtext: {
    marginTop: spacing.sm,
  },
});
