import React, { forwardRef } from 'react';
import {
  ScrollView as RNScrollView,
  type ScrollViewProps as RNScrollViewProps,
} from 'react-native';

export interface ScrollViewProps extends RNScrollViewProps {
  inverted?: boolean;
  className?: string;
  contentClassName?: string;
}

export const ScrollView = forwardRef<RNScrollView, ScrollViewProps>(
  function ScrollView({ inverted, className = '', contentClassName = '', ...props }, ref) {
    return (
      <RNScrollView
        ref={ref}
        className={`bg-white dark:bg-gray-900 ${className}`.trim()}
        contentContainerClassName={[
          inverted ? 'flex-col-reverse' : '',
          contentClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    );
  }
);
