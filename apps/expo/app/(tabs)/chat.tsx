import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Platform,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentClient } from '@agent/api-client';
import {
  useAgentChat,
  StreamingText,
  ToolCallCard,
  ReasoningCollapsible,
  StepIndicator,
  type StreamingMessage,
} from '@agent/ui';
import { useSettings } from '@/context/settings';

interface DisplayItem {
  type: 'reasoning' | 'content' | 'tool';
  key: string;
  data: unknown;
}

function buildDisplayItems(message: StreamingMessage): DisplayItem[] {
  const items: DisplayItem[] = [];
  
  if (message.role === 'user') {
    items.push({ type: 'content', key: 'content', data: message.content });
    return items;
  }

  if (message.reasoning?.content) {
    items.push({ 
      type: 'reasoning', 
      key: 'reasoning', 
      data: message.reasoning 
    });
  }

  for (const tc of message.toolCalls) {
    items.push({ type: 'tool', key: tc.toolCallId, data: tc });
  }

  if (message.content) {
    items.push({ type: 'content', key: 'content', data: message.content });
  }

  return items;
}

export default function ChatScreen(): React.ReactElement {
  const { settings } = useSettings();
  const clientRef = useRef<AgentClient | null>(null);
  const flatListRef = useRef<FlatList<StreamingMessage>>(null);
  const [input, setInput] = useState('');
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

  const { messages, isStreaming, sendMessage, currentStep } = useAgentChat({
    client: clientRef.current!,
    onError: (error) => setServerError(error.message),
  });

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isStreaming || !clientRef.current) return;

    setInput('');
    setServerError(null);
    await sendMessage(content);
  }, [input, isStreaming, sendMessage]);

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: StreamingMessage }): React.ReactElement => {
    const isUser = item.role === 'user';
    const isAssistantStreaming = item.status === 'streaming';
    const displayItems = buildDisplayItems(item);

    return (
      <View className={`my-1 max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}>
        <View
          className={`px-4 py-2.5 rounded-2xl ${
            isUser
              ? 'bg-primary rounded-br-sm'
              : 'bg-gray-100 dark:bg-gray-800 rounded-bl-sm'
          }`}
        >
          {displayItems.map((di) => {
            if (di.type === 'reasoning') {
              const reasoning = di.data as { content: string; durationMs?: number };
              const hasContent = reasoning.content && !reasoning.content.includes('[REDACTED]');
              if (!hasContent) return null;
              return (
                <ReasoningCollapsible
                  key={di.key}
                  content={reasoning.content}
                  durationMs={reasoning.durationMs}
                />
              );
            }
            if (di.type === 'tool') {
              const tc = di.data as import('@agent/api-client').ToolCallInfo;
              return <ToolCallCard key={di.key} toolCall={tc} />;
            }
            if (di.type === 'content') {
              if (isUser) {
                return (
                  <Text key={di.key} className="text-base leading-6 text-white">
                    {di.data as string}
                  </Text>
                );
              }
              const content = di.data as string;
              if (!content) return null;
              return (
                <StreamingText
                  key={di.key}
                  text={content}
                  isStreaming={isAssistantStreaming}
                />
              );
            }
            return null;
          })}
        </View>

        <Text className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
          {formatTime(item.timestamp)}
          {item.status === 'streaming' && ' • Streaming...'}
          {item.status === 'error' && ' • Failed'}
        </Text>
      </View>
    );
  };

  const canSend = input.trim().length > 0 && !isStreaming && isConnected;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
      <View className="flex-row items-center justify-center py-3 border-b border-gray-200 dark:border-gray-700 gap-2">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white">
          AI Agent
        </Text>
        <View className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        {isStreaming && <StepIndicator currentStep={currentStep} isStreaming />}
      </View>

      {serverError && (
        <View className="mx-4 mt-2 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
          <Text className="text-sm text-red-600 dark:text-red-400">{serverError}</Text>
        </View>
      )}

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
          />
        )}

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
                submitBehavior="submit"
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
