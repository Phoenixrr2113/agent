import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

export type TextVariant = 'body' | 'bodySmall' | 'bodyLarge' | 'title' | 'subtitle' | 'caption' | 'label';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  className?: string;
}

const variantClasses: Record<TextVariant, string> = {
  body: 'text-base leading-6 text-gray-900 dark:text-white',
  bodySmall: 'text-sm leading-5 text-gray-900 dark:text-white',
  bodyLarge: 'text-lg leading-7 text-gray-900 dark:text-white',
  title: 'text-3xl leading-9 font-bold text-gray-900 dark:text-white',
  subtitle: 'text-xl leading-7 font-semibold text-gray-900 dark:text-white',
  caption: 'text-xs leading-4 text-gray-500 dark:text-gray-400',
  label: 'text-sm leading-5 font-medium text-gray-900 dark:text-white',
};

export function Text({
  variant = 'body',
  className = '',
  ...props
}: TextProps) {
  const variantClass = variantClasses[variant];

  return (
    <RNText
      className={`${variantClass} ${className}`.trim()}
      {...props}
    />
  );
}
