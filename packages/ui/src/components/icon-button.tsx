import React from 'react';
import { Pressable, ActivityIndicator } from 'react-native';

export type IconButtonVariant = 'default' | 'primary' | 'ghost';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  icon: React.ReactNode;
  onPress?: () => void;
}

const variantClasses: Record<IconButtonVariant, string> = {
  default: 'bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700',
  primary: 'bg-blue-600 active:bg-blue-700',
  ghost: 'bg-transparent active:bg-gray-100 dark:active:bg-gray-800',
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-11 h-11',
  lg: 'w-13 h-13',
};

export function IconButton({
  variant = 'default',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  icon,
  onPress,
}: IconButtonProps) {
  const isDisabled = disabled || loading;
  const variantClass = variantClasses[variant];
  const sizeClass = sizeClasses[size];

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      className={[
        'items-center justify-center rounded-full',
        sizeClass,
        variantClass,
        isDisabled ? 'opacity-50' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : '#6B7280'}
        />
      ) : (
        icon
      )}
    </Pressable>
  );
}
