import { StyleSheet, Button, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import * as AgentAccessibility from '@agent/mobile-accessibility';
import { useState, useEffect } from 'react';

export default function HomeScreen() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = () => {
    // @ts-ignore
    const isEnabled = AgentAccessibility.isAccessibilityEnabled();
    setEnabled(isEnabled);
  };

  const handleClick = async () => {
    try {
      // @ts-ignore
      const result = await AgentAccessibility.click(500, 500);
      Alert.alert('Click Result', String(result));
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Agent Accessibility</ThemedText>
      <ThemedText>Status: {enabled ? 'Enabled' : 'Disabled'}</ThemedText>
      <Button title="Refresh Status" onPress={checkStatus} />

      <Button title="Click (500, 500)" onPress={handleClick} disabled={!enabled} />

      <Button title="Show Overlay" onPress={() => {
        // @ts-ignore
        const res = AgentAccessibility.showOverlay();
        Alert.alert('Show Overlay', String(res));
      }} disabled={!enabled} />

      <Button title="Hide Overlay" onPress={() => {
        // @ts-ignore
        const res = AgentAccessibility.hideOverlay();
        Alert.alert('Hide Overlay', String(res));
      }} disabled={!enabled} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 20,
  },
});
