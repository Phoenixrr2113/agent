import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentClient } from '@agent/api-client';
import { ChatContainer, useChat, ThemeProvider, Text, useTheme, type Message } from '@agent/ui';

function ChatScreenContent() {
  const { colors } = useTheme();
  const clientRef = useRef<AgentClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const getBaseUrl = useCallback(() => {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3000';
    }
    if (Platform.OS === 'web') {
      return 'http://localhost:3000';
    }
    return 'http://localhost:3000';
  }, []);

  useEffect(() => {
    const client = new AgentClient({
      baseUrl: getBaseUrl(),
      onError: (error) => {
        console.error('Agent client error:', error);
        setServerError(error.message);
      },
    });
    clientRef.current = client;

    client.checkHealth().then((healthy) => {
      setIsConnected(healthy);
      if (!healthy) {
        setServerError('Cannot connect to agent server');
      }
    });

    return () => {
      client.endSession().catch(() => {});
    };
  }, [getBaseUrl]);

  const handleSend = useCallback(async (message: string): Promise<string> => {
    const client = clientRef.current;
    if (!client) {
      throw new Error('Client not initialized');
    }

    setServerError(null);
    const response = await client.sendMessage(message);
    return response.text;
  }, []);

  const chat = useChat({
    onSend: handleSend,
    onError: (error) => {
      setServerError(error.message);
    },
  });

  const headerComponent = serverError ? (
    <View style={[styles.errorBanner, { backgroundColor: colors.errorBackground }]}>
      <Text variant="bodySmall" color={colors.error}>
        {serverError}
      </Text>
    </View>
  ) : !isConnected ? (
    <View style={[styles.connectingBanner, { backgroundColor: colors.backgroundSecondary }]}>
      <Text variant="bodySmall" color={colors.textSecondary}>
        Connecting to agent server...
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text variant="subtitle" weight="600">
          AI Agent
        </Text>
        <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.success : colors.error }]} />
      </View>
      <ChatContainer
        messages={chat.messages}
        isLoading={chat.isLoading}
        onSend={chat.sendMessage}
        disabled={!isConnected}
        placeholder={isConnected ? 'Ask me anything...' : 'Connecting...'}
        ListHeaderComponent={headerComponent}
      />
    </SafeAreaView>
  );
}

export default function ChatScreen() {
  return (
    <ThemeProvider>
      <ChatScreenContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  errorBanner: {
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  connectingBanner: {
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
});
