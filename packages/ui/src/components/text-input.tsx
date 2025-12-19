import React, { forwardRef } from 'react';
import {
  TextInput as RNTextInput,
  View,
  type TextInputProps as RNTextInputProps,
} from 'react-native';

export interface TextInputProps extends RNTextInputProps {
  containerClassName?: string;
  className?: string;
  error?: boolean;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  function TextInput({ containerClassName = '', className = '', error, ...props }, ref) {
    const borderClass = error
      ? 'border-red-500 dark:border-red-500'
      : 'border-gray-300 dark:border-gray-600';

    return (
      <View className={`w-full ${containerClassName}`.trim()}>
        <RNTextInput
          ref={ref}
          placeholderTextColor="#9CA3AF"
          className={`border rounded-lg px-4 py-3 text-base min-h-[44px] bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${borderClass} ${className}`.trim()}
          {...props}
        />
      </View>
    );
  }
);
