import React, { useState } from 'react';
import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from '../text.js';
import { useTheme } from '../../hooks/use-theme.js';
import { spacing, borderRadius, fontSize } from '../../themes/spacing.js';
import type { ToolCallInfo } from '@agent/api-client';

export interface ToolCallCardProps {
  toolCall: ToolCallInfo;
  style?: ViewStyle;
}

const STATUS_ICONS: Record<ToolCallInfo['status'], string> = {
  pending: '⏳',
  running: '⚙️',
  complete: '✅',
  error: '❌',
};

export function ToolCallCard({ toolCall, style }: ToolCallCardProps): React.ReactElement {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const statusIcon = STATUS_ICONS[toolCall.status];
  const hasResult = toolCall.result !== undefined;
  const hasArgs = Object.keys(toolCall.args).length > 0;

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const truncateJson = (obj: unknown, maxLength = 100): string => {
    const str = JSON.stringify(obj, null, 2);
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '...';
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
          <Text style={styles.statusIcon}>{statusIcon}</Text>
          <Text style={[styles.toolName, { color: colors.text }]}>
            {toolCall.toolName}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {toolCall.durationMs !== undefined && (
            <Text style={[styles.duration, { color: colors.textMuted }]}>
              {formatDuration(toolCall.durationMs)}
            </Text>
          )}
          <Text style={[styles.expandIcon, { color: colors.textMuted }]}>
            {isExpanded ? '▼' : '▶'}
          </Text>
        </View>
      </Pressable>

      {isExpanded && (
        <View style={styles.details}>
          {hasArgs && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                Input:
              </Text>
              <Text
                style={[
                  styles.code,
                  { backgroundColor: colors.background, color: colors.textSecondary },
                ]}
              >
                {truncateJson(toolCall.args, 300)}
              </Text>
            </View>
          )}

          {hasResult && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                Output:
              </Text>
              <Text
                style={[
                  styles.code,
                  { backgroundColor: colors.background, color: colors.textSecondary },
                ]}
              >
                {typeof toolCall.result === 'string'
                  ? toolCall.result.slice(0, 300) + (toolCall.result.length > 300 ? '...' : '')
                  : truncateJson(toolCall.result, 300)}
              </Text>
            </View>
          )}
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIcon: {
    fontSize: fontSize.sm,
  },
  toolName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  duration: {
    fontSize: fontSize.xs,
  },
  expandIcon: {
    fontSize: fontSize.xs,
  },
  details: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  section: {
    marginTop: spacing.xs,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs / 2,
  },
  code: {
    fontSize: fontSize.xs,
    fontFamily: 'monospace',
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
});
