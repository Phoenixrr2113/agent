import React from 'react';
import { View, StyleSheet, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '../hooks/use-theme';
import { borderRadius, spacing } from '../themes/spacing';

export type SurfaceVariant = 'default' | 'elevated' | 'outlined';

export interface SurfaceProps extends ViewProps {
  variant?: SurfaceVariant;
  padding?: keyof typeof spacing | number;
  radius?: keyof typeof borderRadius | number;
}

export function Surface({
  variant = 'default',
  padding,
  radius,
  style,
  ...props
}: SurfaceProps) {
  const { colors } = useTheme();

  const paddingValue = padding !== undefined
    ? (typeof padding === 'number' ? padding : spacing[padding])
    : undefined;

  const radiusValue = radius !== undefined
    ? (typeof radius === 'number' ? radius : borderRadius[radius])
    : borderRadius.md;

  const variantStyles: ViewStyle = (() => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.surfaceElevated,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        };
      case 'outlined':
        return {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        };
      default:
        return {
          backgroundColor: colors.surface,
        };
    }
  })();

  return (
    <View
      style={[
        styles.base,
        variantStyles,
        { borderRadius: radiusValue },
        paddingValue !== undefined ? { padding: paddingValue } : undefined,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
