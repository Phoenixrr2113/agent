import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/use-theme';

export interface SafeAreaViewProps extends ViewProps {
  edges?: Array<keyof EdgeInsets>;
}

export function SafeAreaView({ edges = ['top', 'bottom', 'left', 'right'], style, ...props }: SafeAreaViewProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const padding = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
        padding,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
