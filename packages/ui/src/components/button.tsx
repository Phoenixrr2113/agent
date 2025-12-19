import React from 'react';
import { Pressable, ActivityIndicator, View } from 'react-native';
import { Text } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onPress?: () => void;
}

const variantClasses: Record<ButtonVariant, { base: string; text: string }> = {
  primary: {
    base: 'bg-blue-600 active:bg-blue-700',
    text: 'text-white',
  },
  secondary: {
    base: 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 active:bg-gray-200 dark:active:bg-gray-700',
    text: 'text-gray-900 dark:text-white',
  },
  ghost: {
    base: 'bg-transparent active:bg-gray-100 dark:active:bg-gray-800',
    text: 'text-gray-900 dark:text-white',
  },
  destructive: {
    base: 'bg-red-600 active:bg-red-700',
    text: 'text-white',
  },
};

const sizeClasses: Record<ButtonSize, { button: string; text: 'body' | 'bodySmall' }> = {
  sm: { button: 'px-4 py-2 min-h-[32px]', text: 'bodySmall' },
  md: { button: 'px-6 py-3 min-h-[44px]', text: 'body' },
  lg: { button: 'px-8 py-4 min-h-[52px]', text: 'body' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  onPress,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const variantStyle = variantClasses[variant];
  const sizeStyle = sizeClasses[size];

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      className={[
        'rounded-lg items-center justify-center flex-row',
        sizeStyle.button,
        variantStyle.base,
        fullWidth ? 'w-full' : '',
        isDisabled ? 'opacity-50' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'destructive' ? '#FFFFFF' : '#6B7280'}
        />
      ) : (
        <View>
          <Text variant={sizeStyle.text} className={`font-semibold ${variantStyle.text}`}>
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
