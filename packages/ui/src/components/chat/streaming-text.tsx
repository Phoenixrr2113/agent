import React, { useEffect, useRef } from 'react';
import { View, Animated, Text } from 'react-native';
import { MarkdownContent } from './markdown-content';

export interface StreamingTextProps {
  text: string;
  isStreaming?: boolean;
  showCursor?: boolean;
  className?: string;
}

export function StreamingText({
  text,
  isStreaming = false,
  showCursor = true,
  className = '',
}: StreamingTextProps): React.ReactElement {
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
    <View className={`flex-row flex-wrap ${className}`.trim()}>
      <View className="flex-1">
        <MarkdownContent content={text} />
      </View>
      {isStreaming && showCursor && (
        <Animated.Text
          style={{ opacity: cursorOpacity }}
          className="text-base text-blue-600"
        >
          ▊
        </Animated.Text>
      )}
    </View>
  );
}
