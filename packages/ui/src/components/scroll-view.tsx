import React, { forwardRef } from 'react';
import {
  ScrollView as RNScrollView,
  type ScrollViewProps as RNScrollViewProps,
} from 'react-native';
import { useTheme } from '../hooks/use-theme';

export interface ScrollViewProps extends RNScrollViewProps {
  inverted?: boolean;
}

export const ScrollView = forwardRef<RNScrollView, ScrollViewProps>(
  function ScrollView({ inverted, style, contentContainerStyle, ...props }, ref) {
    const { colors } = useTheme();

    return (
      <RNScrollView
        ref={ref}
        style={[{ backgroundColor: colors.background }, style]}
        contentContainerStyle={[
          inverted && { flexDirection: 'column-reverse' },
          contentContainerStyle,
        ]}
        {...props}
      />
    );
  }
);
