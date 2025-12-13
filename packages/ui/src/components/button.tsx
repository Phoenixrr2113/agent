import React from 'react';
import {
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../hooks/use-theme';
import { Text } from './text';
import { borderRadius, spacing } from '../themes/spacing';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  children,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();

  const isDisabled = disabled || loading;

  const getVariantStyles = (pressed: boolean): ViewStyle => {
    const baseOpacity = isDisabled ? 0.5 : pressed ? 0.8 : 1;

    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary,
          opacity: baseOpacity,
        };
      case 'secondary':
        return {
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: baseOpacity,
        };
      case 'ghost':
        return {
          backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
          opacity: baseOpacity,
        };
      case 'destructive':
        return {
          backgroundColor: colors.error,
          opacity: baseOpacity,
        };
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'primary':
      case 'destructive':
        return '#FFFFFF';
      case 'secondary':
      case 'ghost':
        return colors.text;
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
          minHeight: 32,
        };
      case 'lg':
        return {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          minHeight: 52,
        };
      default:
        return {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          minHeight: 44,
        };
    }
  };

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        getSizeStyles(),
        getVariantStyles(pressed),
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <Text
          variant={size === 'sm' ? 'bodySmall' : 'body'}
          weight="600"
          color={getTextColor()}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
});
