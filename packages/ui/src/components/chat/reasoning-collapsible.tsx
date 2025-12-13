import React, { useState } from 'react';
import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from '../text.js';
import { useTheme } from '../../hooks/use-theme.js';
import { spacing, borderRadius, fontSize } from '../../themes/spacing.js';

export interface ReasoningCollapsibleProps {
  content: string;
  durationMs?: number;
  defaultExpanded?: boolean;
  style?: ViewStyle;
}

export function ReasoningCollapsible({
  content,
  durationMs,
  defaultExpanded = false,
  style,
}: ReasoningCollapsibleProps): React.ReactElement {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
        style,
      ]}
    >
      <Pressable
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.icon, { color: colors.textMuted }]}>💭</Text>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Thinking
            {durationMs !== undefined && ` (${formatDuration(durationMs)})`}
          </Text>
        </View>
        <Text style={[styles.expandIcon, { color: colors.textMuted }]}>
          {isExpanded ? '▼' : '▶'}
        </Text>
      </Pressable>

      {isExpanded && (
        <View style={styles.content}>
          <Text style={[styles.reasoningText, { color: colors.textSecondary }]}>
            {content}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginVertical: spacing.xs,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  icon: {
    fontSize: fontSize.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
  expandIcon: {
    fontSize: fontSize.xs,
  },
  content: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  reasoningText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
    fontStyle: 'italic',
  },
});
