import React from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '../hooks/use-theme';
import { fontSize } from '../themes/spacing';

export type TextVariant = 'body' | 'bodySmall' | 'bodyLarge' | 'title' | 'subtitle' | 'caption' | 'label';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
}

export function Text({
  variant = 'body',
  color,
  weight,
  align,
  style,
  ...props
}: TextProps) {
  const { colors } = useTheme();

  const variantStyle = styles[variant];

  return (
    <RNText
      style={[
        variantStyle,
        { color: color ?? colors.text },
        weight ? { fontWeight: weight } : undefined,
        align ? { textAlign: align } : undefined,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.5,
  },
  bodySmall: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  bodyLarge: {
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * 1.5,
  },
  title: {
    fontSize: fontSize.xxxl,
    lineHeight: fontSize.xxxl * 1.2,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * 1.3,
    fontWeight: '600',
  },
  caption: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.4,
  },
  label: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
    fontWeight: '500',
  },
});
