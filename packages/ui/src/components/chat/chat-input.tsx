import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Keyboard,
  Platform,
  Pressable,
  Text,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  sendIcon?: React.ReactNode;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  className = '',
  sendIcon,
}: ChatInputProps) {
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
    <Text className={canSend ? 'text-white font-semibold' : 'text-gray-400 font-semibold'}>
      ↑
    </Text>
  );

  return (
    <View
      className={`px-4 py-2 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 ${className}`.trim()}
    >
      <View className="flex-row items-end rounded-3xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 pl-4 pr-1 py-1">
        <RNTextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={10000}
          editable={!disabled}
          onKeyPress={handleKeyPress}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          returnKeyType="send"
          className="flex-1 text-base text-gray-900 dark:text-white max-h-[120px] min-h-[36px] py-2 bg-transparent"
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          className={`ml-1 mb-1 w-8 h-8 rounded-full items-center justify-center ${
            canSend ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
          } ${!canSend ? 'opacity-50' : ''}`.trim()}
        >
          {sendIcon ?? defaultSendIcon}
        </Pressable>
      </View>
    </View>
  );
}
