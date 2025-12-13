import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from '../text.js';
import { useTheme } from '../../hooks/use-theme.js';
import { spacing, borderRadius, fontSize } from '../../themes/spacing.js';

export interface StepIndicatorProps {
  currentStep: number;
  isStreaming?: boolean;
  style?: ViewStyle;
}

export function StepIndicator({
  currentStep,
  isStreaming = false,
  style,
}: StepIndicatorProps): React.ReactElement | null {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isStreaming) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
    pulseAnim.setValue(1);
    return undefined;
  }, [isStreaming, pulseAnim]);

  if (currentStep === 0 && !isStreaming) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.primary, opacity: pulseAnim },
        style,
      ]}
    >
      <Text style={styles.text}>
        {isStreaming ? `Step ${currentStep}...` : `${currentStep} steps`}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
    alignSelf: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
