import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TextInput as RNTextInput,
  Keyboard,
  Platform,
  type ViewStyle,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useTheme } from '../../hooks/use-theme';
import { TextInput } from '../text-input';
import { IconButton } from '../icon-button';
import { Text } from '../text';
import { borderRadius, spacing } from '../../themes/spacing';

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  style?: ViewStyle;
  sendIcon?: React.ReactNode;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  style,
  sendIcon,
}: ChatInputProps) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const inputRef = useRef<RNTextInput>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setText('');
      Keyboard.dismiss();
    }
  }, [text, disabled, onSend]);

  const handleKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS === 'web') {
        const nativeEvent = event.nativeEvent as TextInputKeyPressEventData & {
          shiftKey?: boolean;
          metaKey?: boolean;
          ctrlKey?: boolean;
        };

        if (
          nativeEvent.key === 'Enter' &&
          !nativeEvent.shiftKey &&
          !nativeEvent.metaKey &&
          !nativeEvent.ctrlKey
        ) {
          event.preventDefault();
          handleSend();
        }
      }
    },
    [handleSend]
  );

  const canSend = text.trim().length > 0 && !disabled;

  const defaultSendIcon = (
    <Text weight="600" color={canSend ? '#FFFFFF' : colors.textMuted}>
      ↑
    </Text>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
        style,
      ]}
    >
      <View
        style={[
          styles.inputContainer,
          { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
        ]}
      >
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.inputPlaceholder}
          multiline
          maxLength={10000}
          editable={!disabled}
          onKeyPress={handleKeyPress}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          returnKeyType="send"
          style={[styles.input, { color: colors.inputText }]}
          containerStyle={styles.inputWrapper}
        />
        <IconButton
          variant={canSend ? 'primary' : 'default'}
          size="sm"
          disabled={!canSend}
          onPress={handleSend}
          icon={sendIcon ?? defaultSendIcon}
          style={styles.sendButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  input: {
    maxHeight: 120,
    minHeight: 36,
    paddingTop: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  sendButton: {
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
});
