import React from 'react';
import { View, Text } from 'react-native';
import type { Message } from './types';

export interface ChatBubbleProps {
  message: Message;
  className?: string;
}

export function ChatBubble({ message, className = '' }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const containerClass = isUser ? 'self-end' : 'self-start';
  const bubbleClass = isUser
    ? 'bg-blue-600 self-end rounded-br-sm'
    : isSystem
    ? 'bg-gray-200 dark:bg-gray-700 self-center'
    : 'bg-gray-100 dark:bg-gray-800 self-start rounded-bl-sm';
  const textClass = isUser
    ? 'text-white'
    : isSystem
    ? 'text-gray-600 dark:text-gray-300'
    : 'text-gray-900 dark:text-white';

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View className={`my-1 max-w-[85%] ${containerClass} ${className}`.trim()}>
      <View className={`px-4 py-2 rounded-2xl ${bubbleClass}`.trim()}>
        <Text className={`text-base leading-6 ${textClass}`.trim()}>
          {message.content}
        </Text>
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <View className="mt-1 pt-1 border-t border-white/20">
            <Text className="text-xs text-gray-400">
              Tools: {message.toolsUsed.join(', ')}
            </Text>
          </View>
        )}
      </View>
      <Text
        className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right mr-1' : 'ml-1'}`.trim()}
      >
        {formatTime(message.timestamp)}
        {message.status === 'sending' && ' • Sending...'}
        {message.status === 'error' && ' • Failed'}
      </Text>
    </View>
  );
}
