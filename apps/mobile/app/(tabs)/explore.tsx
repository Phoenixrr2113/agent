import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentClient } from '@agent/api-client';
import { useSettings } from '@/context/settings';

export default function SettingsScreen() {
  const { settings, updateSettings, isLoading } = useSettings();
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const testConnection = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const client = new AgentClient({ baseUrl: serverUrl });
      const healthy = await client.checkHealth();

      if (healthy) {
        setTestResult('success');
        Alert.alert('Success', 'Connected to agent server successfully!');
      } else {
        setTestResult('error');
        Alert.alert('Error', 'Server is not responding. Check the URL and make sure the server is running.');
      }
    } catch (error) {
      setTestResult('error');
      Alert.alert('Error', `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  }, [serverUrl]);

  const saveSettings = useCallback(async () => {
    await updateSettings({ serverUrl });
    Alert.alert('Saved', 'Settings have been saved.');
  }, [serverUrl, updateSettings]);

  const resetToDefault = useCallback(() => {
    const defaultUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
    setServerUrl(defaultUrl);
    updateSettings({ serverUrl: defaultUrl });
  }, [updateSettings]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <Text className="text-gray-500">Loading settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
      {/* Header */}
      <View className="py-3 px-4 border-b border-gray-200 dark:border-gray-700">
        <Text className="text-lg font-semibold text-center text-gray-900 dark:text-white">
          Settings
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Server Configuration */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Server Configuration
          </Text>

          <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Agent Server URL
            </Text>
            <TextInput
              className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-base text-gray-900 dark:text-white mb-3"
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://localhost:3000"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <View className="flex-row gap-2">
              <Pressable
                onPress={testConnection}
                disabled={isTesting}
                className={`flex-1 py-3 rounded-lg items-center ${
                  isTesting ? 'bg-gray-300 dark:bg-gray-600' : 'bg-primary'
                }`}
              >
                <Text className="text-white font-semibold">
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Text>
              </Pressable>

              <Pressable
                onPress={saveSettings}
                className="flex-1 py-3 rounded-lg items-center bg-green-500"
              >
                <Text className="text-white font-semibold">Save</Text>
              </Pressable>
            </View>

            {testResult && (
              <View className={`mt-3 p-3 rounded-lg ${
                testResult === 'success'
                  ? 'bg-green-50 dark:bg-green-900/30'
                  : 'bg-red-50 dark:bg-red-900/30'
              }`}>
                <Text className={`text-sm ${
                  testResult === 'success'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {testResult === 'success' ? '✓ Connection successful' : '✗ Connection failed'}
                </Text>
              </View>
            )}

            <Pressable onPress={resetToDefault} className="mt-3">
              <Text className="text-sm text-primary text-center">Reset to Default</Text>
            </Pressable>
          </View>
        </View>

        {/* App Info */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            About
          </Text>

          <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <View className="flex-row justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <Text className="text-gray-600 dark:text-gray-400">Version</Text>
              <Text className="text-gray-900 dark:text-white">0.1.0</Text>
            </View>
            <View className="flex-row justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <Text className="text-gray-600 dark:text-gray-400">Platform</Text>
              <Text className="text-gray-900 dark:text-white">{Platform.OS}</Text>
            </View>
            <View className="flex-row justify-between py-2">
              <Text className="text-gray-600 dark:text-gray-400">Package</Text>
              <Text className="text-gray-900 dark:text-white">@agent/mobile</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Quick Start
          </Text>

          <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <Text className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              1. Start the agent server:{'\n'}
              <Text className="font-mono text-primary">pnpm server</Text>
              {'\n\n'}
              2. The server runs on port 3000 by default.
              {'\n\n'}
              3. For Android emulator, use:{'\n'}
              <Text className="font-mono text-primary">http://10.0.2.2:3000</Text>
              {'\n\n'}
              4. For iOS simulator or web, use:{'\n'}
              <Text className="font-mono text-primary">http://localhost:3000</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
