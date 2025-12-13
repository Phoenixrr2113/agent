import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/use-theme';
import { Text } from '../text';
import { borderRadius, spacing, fontSize } from '../../themes/spacing';
import type { Message } from './types';

export interface ChatBubbleProps {
  message: Message;
  style?: ViewStyle;
}

export function ChatBubble({ message, style }: ChatBubbleProps) {
  const { colors } = useTheme();

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const bubbleStyle: ViewStyle = isUser
    ? {
        backgroundColor: colors.userBubble,
        alignSelf: 'flex-end',
        borderBottomRightRadius: borderRadius.sm,
      }
    : isSystem
    ? {
        backgroundColor: colors.backgroundSecondary,
        alignSelf: 'center',
        borderRadius: borderRadius.md,
      }
    : {
        backgroundColor: colors.assistantBubble,
        alignSelf: 'flex-start',
        borderBottomLeftRadius: borderRadius.sm,
      };

  const textColor = isUser
    ? colors.userBubbleText
    : isSystem
    ? colors.textSecondary
    : colors.assistantBubbleText;

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, isUser && styles.containerUser, style]}>
      <View style={[styles.bubble, bubbleStyle]}>
        <Text style={[styles.content, { color: textColor }]}>
          {message.content}
        </Text>
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <View style={styles.toolsContainer}>
            <Text variant="caption" color={colors.textMuted}>
              Tools: {message.toolsUsed.join(', ')}
            </Text>
          </View>
        )}
      </View>
      <Text
        variant="caption"
        color={colors.textMuted}
        style={[styles.timestamp, isUser && styles.timestampUser]}
      >
        {formatTime(message.timestamp)}
        {message.status === 'sending' && ' • Sending...'}
        {message.status === 'error' && ' • Failed'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
    maxWidth: '85%',
    alignSelf: 'flex-start',
  },
  containerUser: {
    alignSelf: 'flex-end',
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  content: {
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.5,
  },
  toolsContainer: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  timestamp: {
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  timestampUser: {
    textAlign: 'right',
    marginRight: spacing.xs,
    marginLeft: 0,
  },
});
