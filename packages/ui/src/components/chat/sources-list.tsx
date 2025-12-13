import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from '../text.js';
import { useTheme } from '../../hooks/use-theme.js';
import { spacing, borderRadius, fontSize } from '../../themes/spacing.js';
import type { SourceInfo } from '@agent/api-client';

export interface SourcesListProps {
  sources: SourceInfo[];
  style?: ViewStyle;
}

export function SourcesList({ sources, style }: SourcesListProps): React.ReactElement | null {
  const { colors } = useTheme();

  if (sources.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>
        📚 Sources ({sources.length})
      </Text>
      <View style={styles.list}>
        {sources.map((source, index) => (
          <View
            key={source.id || index}
            style={[styles.sourceItem, { backgroundColor: colors.backgroundSecondary }]}
          >
            <Text style={[styles.sourceTitle, { color: colors.text }]} numberOfLines={1}>
              {source.title}
            </Text>
            {source.snippet && (
              <Text style={[styles.snippet, { color: colors.textSecondary }]} numberOfLines={2}>
                {source.snippet}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
  },
  label: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  list: {
    gap: spacing.xs,
  },
  sourceItem: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  sourceTitle: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  snippet: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs / 2,
  },
});
