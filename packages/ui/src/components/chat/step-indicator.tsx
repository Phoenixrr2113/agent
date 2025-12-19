import React, { useEffect, useRef } from 'react';
import { Animated, Text } from 'react-native';

export interface StepIndicatorProps {
  currentStep: number;
  isStreaming?: boolean;
  className?: string;
}

export function StepIndicator({
  currentStep,
  isStreaming = false,
  className = '',
}: StepIndicatorProps): React.ReactElement | null {
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
      style={{ opacity: pulseAnim }}
      className={`px-3 py-1 rounded-full bg-blue-600 self-center ${className}`.trim()}
    >
      <Text className="text-xs font-semibold text-white">
        {isStreaming ? `Step ${currentStep}...` : `${currentStep} steps`}
      </Text>
    </Animated.View>
  );
}
