import React, { forwardRef } from 'react';
import {
  TextInput as RNTextInput,
  StyleSheet,
  View,
  type TextInputProps as RNTextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../hooks/use-theme';
import { borderRadius, spacing, fontSize } from '../themes/spacing';

export interface TextInputProps extends RNTextInputProps {
  containerStyle?: ViewStyle;
  error?: boolean;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  function TextInput({ containerStyle, error, style, ...props }, ref) {
    const { colors } = useTheme();

    return (
      <View style={[styles.container, containerStyle]}>
        <RNTextInput
          ref={ref}
          placeholderTextColor={colors.inputPlaceholder}
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBackground,
              borderColor: error ? colors.error : colors.inputBorder,
              color: colors.inputText,
            },
            style,
          ]}
          {...props}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    minHeight: 44,
  },
});
