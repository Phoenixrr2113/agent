import * as AgentAccessibility from '@agent/mobile-accessibility';
import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Alert, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DeviceScreen() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = useCallback(() => {
    const isEnabled = AgentAccessibility.isAccessibilityEnabled();
    setEnabled(isEnabled);
  }, []);

  const handleClick = useCallback(async () => {
    try {
      const result = await AgentAccessibility.click(500, 500);
      Alert.alert('Click Result', String(result));
    } catch (error) {
      Alert.alert('Error', String(error));
    }
  }, []);

  const handleShowOverlay = useCallback(() => {
    const res = AgentAccessibility.showOverlay();
    Alert.alert('Show Overlay', String(res));
  }, []);

  const handleHideOverlay = useCallback(() => {
    const res = AgentAccessibility.hideOverlay();
    Alert.alert('Hide Overlay', String(res));
  }, []);

  const isAndroid = Platform.OS === 'android';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
      <View className="py-3 px-4 border-b border-gray-200 dark:border-gray-700">
        <Text className="text-lg font-semibold text-center text-gray-900 dark:text-white">
          Device Control
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Accessibility Status
          </Text>

          <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-700 dark:text-gray-300">Service Status</Text>
              <View className={`px-3 py-1 rounded-full ${enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <Text className={`text-sm font-medium ${enabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={checkStatus}
              className="py-3 rounded-lg items-center bg-primary"
            >
              <Text className="text-white font-semibold">Refresh Status</Text>
            </Pressable>
          </View>
        </View>

        {isAndroid && (
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Actions
            </Text>

            <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 gap-3">
              <Pressable
                onPress={handleClick}
                disabled={!enabled}
                className={`py-3 rounded-lg items-center ${enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <Text className="text-white font-semibold">Click (500, 500)</Text>
              </Pressable>

              <Pressable
                onPress={handleShowOverlay}
                disabled={!enabled}
                className={`py-3 rounded-lg items-center ${enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <Text className="text-white font-semibold">Show Overlay</Text>
              </Pressable>

              <Pressable
                onPress={handleHideOverlay}
                disabled={!enabled}
                className={`py-3 rounded-lg items-center ${enabled ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <Text className="text-white font-semibold">Hide Overlay</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Information
          </Text>

          <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <Text className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {isAndroid ? (
                <>
                  This screen allows control of the device through the accessibility service.
                  {'\n\n'}
                  To enable the accessibility service:
                  {'\n'}
                  1. Go to Settings → Accessibility
                  {'\n'}
                  2. Find "Agent Accessibility Service"
                  {'\n'}
                  3. Enable the service and grant permissions
                </>
              ) : (
                <>
                  Device control features are currently only available on Android.
                  {'\n\n'}
                  On iOS, similar functionality requires different system integrations that are in development.
                </>
              )}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
