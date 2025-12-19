import React from 'react';
import { View, type ViewProps } from 'react-native';

export type SurfaceVariant = 'default' | 'elevated' | 'outlined';

export interface SurfaceProps extends ViewProps {
  variant?: SurfaceVariant;
  className?: string;
}

const variantClasses: Record<SurfaceVariant, string> = {
  default: 'bg-white dark:bg-gray-900 rounded-lg overflow-hidden',
  elevated: 'bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md',
  outlined: 'bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700',
};

export function Surface({
  variant = 'default',
  className = '',
  ...props
}: SurfaceProps) {
  const variantClass = variantClasses[variant];

  return (
    <View
      className={`${variantClass} ${className}`.trim()}
      {...props}
    />
  );
}
