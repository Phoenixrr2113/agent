import React from 'react';
import {
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../hooks/use-theme';
import { borderRadius, spacing } from '../themes/spacing';

export type IconButtonVariant = 'default' | 'primary' | 'ghost';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  style?: ViewStyle;
  icon: React.ReactNode;
}

export function IconButton({
  variant = 'default',
  size = 'md',
  loading = false,
  disabled,
  style,
  icon,
  ...props
}: IconButtonProps) {
  const { colors } = useTheme();

  const isDisabled = disabled || loading;

  const getVariantStyles = (pressed: boolean): ViewStyle => {
    const baseOpacity = isDisabled ? 0.5 : pressed ? 0.7 : 1;

    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary,
          opacity: baseOpacity,
        };
      case 'ghost':
        return {
          backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
          opacity: baseOpacity,
        };
      default:
        return {
          backgroundColor: colors.backgroundSecondary,
          opacity: baseOpacity,
        };
    }
  };

  const getSizeValue = (): number => {
    switch (size) {
      case 'sm':
        return 32;
      case 'lg':
        return 52;
      default:
        return 44;
    }
  };

  const sizeValue = getSizeValue();

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        getVariantStyles(pressed),
        {
          width: sizeValue,
          height: sizeValue,
          borderRadius: sizeValue / 2,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : colors.icon}
        />
      ) : (
        icon
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
