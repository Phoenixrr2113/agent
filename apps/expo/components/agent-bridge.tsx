import * as AgentAccessibility from '@agent/mobile-accessibility'
import type {
  DeviceAction,
  DeviceCapabilities,
  ActionResult,
  TapPayload,
  TypePayload,
  KeyPayload,
  SwipePayload,
  ScrollPayload,
  DragPayload,
} from '@agent/shared'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native'

interface ActionMessage {
  actionId: string
  action: DeviceAction
}

const RECONNECT_DELAY_MS = 3000
const DEVICE_ID = `android-${Platform.OS}-${Date.now()}`

function getDeviceCapabilities(): DeviceCapabilities {
  const { width, height } = Dimensions.get('screen')
  return {
    platform: 'android',
    deviceId: DEVICE_ID,
    deviceName: `Android Device (${Platform.OS})`,
    screenSize: { width, height },
    supportedActions: [
      'tap',
      'double_tap',
      'long_press',
      'type',
      'key',
      'swipe',
      'scroll',
      'drag',
      'screenshot',
      'get_ui_tree',
    ],
    hasKeyboard: true,
    hasUITree: true,
  }
}

async function executeAction(action: DeviceAction): Promise<ActionResult> {
  const payload = action.payload as Record<string, unknown>

  switch (action.type) {
    case 'tap': {
      const { x, y } = payload as TapPayload
      const success = await AgentAccessibility.click(x, y)
      return success ? { success: true } : { success: false, error: 'Tap failed', code: 'UNKNOWN' }
    }

    case 'double_tap': {
      const { x, y } = payload as TapPayload
      await AgentAccessibility.click(x, y)
      await AgentAccessibility.click(x, y)
      return { success: true }
    }

    case 'long_press': {
      const { x, y } = payload as TapPayload
      const success = await AgentAccessibility.longPress(x, y, 500)
      return success
        ? { success: true }
        : { success: false, error: 'Long press failed', code: 'UNKNOWN' }
    }

    case 'type': {
      const { text } = payload as TypePayload
      const success = await AgentAccessibility.type(text)
      return success ? { success: true } : { success: false, error: 'Type failed', code: 'UNKNOWN' }
    }

    case 'key': {
      const { key } = payload as KeyPayload
      const success = await AgentAccessibility.pressKey(key)
      return success
        ? { success: true }
        : { success: false, error: 'Key press failed', code: 'UNKNOWN' }
    }

    case 'swipe': {
      const { fromX, fromY, toX, toY, durationMs } = payload as SwipePayload
      const success = await AgentAccessibility.swipe(fromX, fromY, toX, toY, durationMs ?? 300)
      return success
        ? { success: true }
        : { success: false, error: 'Swipe failed', code: 'UNKNOWN' }
    }

    case 'scroll': {
      const scrollPayload = payload as ScrollPayload
      const { width, height } = Dimensions.get('screen')
      const cx = scrollPayload.x ?? width / 2
      const cy = scrollPayload.y ?? height / 2
      const toY = cy - scrollPayload.deltaY
      const toX = cx - scrollPayload.deltaX
      await AgentAccessibility.swipe(cx, cy, toX, toY, 300)
      return { success: true }
    }

    case 'drag': {
      const { fromX, fromY, toX, toY } = payload as DragPayload
      await AgentAccessibility.swipe(fromX, fromY, toX, toY, 500)
      return { success: true }
    }

    case 'screenshot': {
      const base64 = await AgentAccessibility.screenshot()
      if (!base64) {
        return { success: false, error: 'Screenshot failed', code: 'UNKNOWN' }
      }
      const { width, height } = Dimensions.get('screen')
      return {
        success: true,
        data: {
          type: 'screenshot',
          base64,
          format: 'png',
          width,
          height,
        },
      }
    }

    case 'get_ui_tree': {
      const treeJson = await AgentAccessibility.getUITree()
      if (!treeJson) {
        return { success: false, error: 'UI tree failed', code: 'UNKNOWN' }
      }
      return {
        success: true,
        data: {
          type: 'ui_tree',
          root: JSON.parse(treeJson),
        },
      }
    }

    default:
      return {
        success: false,
        error: `Unknown action type: ${action.type}`,
        code: 'NOT_SUPPORTED',
      }
  }
}

export function AgentBridge() {
  const [status, setStatus] = useState('Disconnected')
  const [lastAction, setLastAction] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost'
    const ws = new WebSocket(`ws://${host}:3000`)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('Connected')
      console.log('[AgentBridge] Connected to server')

      const capabilities = getDeviceCapabilities()
      ws.send(
        JSON.stringify({
          type: 'device:register',
          capabilities,
        })
      )
      console.log('[AgentBridge] Registered device:', capabilities.deviceId)
    }

    ws.onmessage = async (e) => {
      try {
        const message = JSON.parse(e.data as string) as ActionMessage
        if (!message.actionId || !message.action) {
          console.warn('[AgentBridge] Invalid message format:', message)
          return
        }

        const { actionId, action } = message
        setLastAction(`${action.type}`)
        console.log('[AgentBridge] Executing action:', action.type, actionId)

        const result = await executeAction(action)
        ws.send(
          JSON.stringify({
            type: 'action:result',
            actionId,
            result,
          })
        )
        console.log('[AgentBridge] Action result:', result.success)
      } catch (error) {
        console.error('[AgentBridge] Error processing message:', error)
      }
    }

    ws.onerror = (e) => {
      console.error('[AgentBridge] WebSocket error:', e)
      setStatus('Error')
    }

    ws.onclose = () => {
      setStatus('Disconnected')
      console.log('[AgentBridge] Disconnected, reconnecting...')
      wsRef.current = null

      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, RECONNECT_DELAY_MS)
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Bridge: {status}</Text>
      {lastAction && <Text style={styles.smallText}>Last: {lastAction}</Text>}
    </View>
  )
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
})
