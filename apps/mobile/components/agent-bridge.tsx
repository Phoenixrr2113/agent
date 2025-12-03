import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import * as AgentAccessibility from '@agent/mobile-accessibility';

export function AgentBridge() {
  const [status, setStatus] = useState('Disconnected');
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  useEffect(() => {
    const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    const ws = new WebSocket(`ws://${host}:3000`);

    ws.onopen = () => {
      setStatus('Connected');
      console.log('Connected to Agent Bridge');
    };

    ws.onmessage = async (e) => {
      try {
        const command = JSON.parse(e.data as string);
        setLastCommand(JSON.stringify(command));
        console.log('Received command:', command);

        if (command.type === 'click') {
          // @ts-ignore
          const result = await AgentAccessibility.click(command.x, command.y);
          ws.send(JSON.stringify({ type: 'result', success: result }));
        } else if (command.type === 'swipe') {
          // @ts-ignore
          const result = await AgentAccessibility.swipe(command.x1, command.y1, command.x2, command.y2, command.duration);
          ws.send(JSON.stringify({ type: 'result', success: result }));
        }
      } catch (err) {
        console.error('Error processing command:', err);
        ws.send(JSON.stringify({ type: 'error', message: String(err) }));
      }
    };

    ws.onerror = (e) => {
      // @ts-ignore
      setStatus('Error: ' + (e.message || 'Unknown'));
      console.log('WebSocket Error:', e);
    };

    ws.onclose = () => {
      setStatus('Disconnected');
      console.log('Disconnected from Agent Bridge');
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Bridge Status: {status}</Text>
      {lastCommand && <Text style={styles.smallText}>Last: {lastCommand}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    marginVertical: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  smallText: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
  },
});
