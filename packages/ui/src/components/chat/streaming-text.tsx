import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Text } from '../text.js';
import { useTheme } from '../../hooks/use-theme.js';
import { fontSize } from '../../themes/spacing.js';

export interface StreamingTextProps {
  text: string;
  isStreaming?: boolean;
  showCursor?: boolean;
}

export function StreamingText({
  text,
  isStreaming = false,
  showCursor = true,
}: StreamingTextProps): React.ReactElement {
  const { colors } = useTheme();
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isStreaming && showCursor) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(cursorOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
    cursorOpacity.setValue(0);
    return undefined;
  }, [isStreaming, showCursor, cursorOpacity]);

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: colors.text }]}>
        {text}
        {isStreaming && showCursor && (
          <Animated.Text
            style={[
              styles.cursor,
              { opacity: cursorOpacity, color: colors.primary },
            ]}
          >
            ▊
          </Animated.Text>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  text: {
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.5,
  },
  cursor: {
    fontSize: fontSize.md,
  },
});
