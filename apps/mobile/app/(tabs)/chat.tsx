import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  Platform,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentClient } from '@agent/api-client';
import { useSettings } from '@/context/settings';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function ChatScreen() {
  const { settings } = useSettings();
  const clientRef = useRef<AgentClient | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    const client = new AgentClient({
      baseUrl: settings.serverUrl,
      onError: (error) => {
        console.error('Agent client error:', error);
        setServerError(error.message);
      },
    });
    clientRef.current = client;

    client.checkHealth().then((healthy) => {
      setIsConnected(healthy);
      if (!healthy) {
        setServerError('Cannot connect to agent server. Run: pnpm server');
      }
    });

    return () => {
      client.endSession().catch(() => {});
    };
  }, [settings.serverUrl]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading || !clientRef.current) return;

    setInput('');
    setServerError(null);

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await clientRef.current.sendMessage(content);

      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View className={`my-1 max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}>
        <View
          className={`px-4 py-2.5 rounded-2xl ${
            isUser
              ? 'bg-primary rounded-br-sm'
              : 'bg-gray-100 dark:bg-gray-800 rounded-bl-sm'
          }`}
        >
          <Text className={`text-base leading-6 ${isUser ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
            {item.content}
          </Text>
        </View>
        <Text className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    );
  };

  const canSend = input.trim().length > 0 && !isLoading && isConnected;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-center py-3 border-b border-gray-200 dark:border-gray-700 gap-2">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white">
          AI Agent
        </Text>
        <View className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </View>

      {/* Error Banner */}
      {serverError && (
        <View className="mx-4 mt-2 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
          <Text className="text-sm text-red-600 dark:text-red-400">{serverError}</Text>
        </View>
      )}

      {/* Chat Area */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {messages.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-xl font-semibold text-gray-500 dark:text-gray-400 text-center mb-2">
              Start a conversation
            </Text>
            <Text className="text-sm text-gray-400 dark:text-gray-500 text-center">
              Send a message to begin chatting with the AI agent
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={
              isLoading ? (
                <View className="flex-row items-center justify-center py-4 gap-2">
                  <ActivityIndicator size="small" color="#0a7ea4" />
                  <Text className="text-sm text-gray-500">Agent is thinking...</Text>
                </View>
              ) : null
            }
          />
        )}

        {/* Input Area */}
        <View className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <View className="flex-row items-end gap-2">
            <View className="flex-1 flex-row items-end bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2 border border-gray-200 dark:border-gray-700">
              <TextInput
                className="flex-1 text-base text-gray-900 dark:text-white max-h-[120px] py-1"
                value={input}
                onChangeText={setInput}
                placeholder={isConnected ? 'Ask me anything...' : 'Connecting...'}
                placeholderTextColor="#9CA3AF"
                multiline
                editable={isConnected}
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                canSend ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <Text className="text-white text-lg font-semibold">↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
