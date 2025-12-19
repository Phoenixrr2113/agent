import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

export interface SafeAreaViewProps extends ViewProps {
  edges?: Array<keyof EdgeInsets>;
  className?: string;
}

export function SafeAreaView({ edges = ['top', 'bottom', 'left', 'right'], className = '', style, ...props }: SafeAreaViewProps) {
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return (
    <View
      className={`flex-1 bg-white dark:bg-gray-900 ${className}`.trim()}
      style={[padding, style]}
      {...props}
    />
  );
}
