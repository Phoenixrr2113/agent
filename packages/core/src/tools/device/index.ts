import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { tool } from 'ai'

import type { DeviceCapabilities } from '@agent/shared'

import { z } from 'zod'

interface DeviceToolsConfig {
  serverUrl: string
  screenshotsDir?: string
}

async function saveScreenshotToFile(base64Data: string, screenshotsDir: string): Promise<string> {
  await mkdir(screenshotsDir, { recursive: true })
  const filename = `screenshot_${Date.now()}.png`
  const filepath = join(screenshotsDir, filename)
  const buffer = Buffer.from(base64Data, 'base64')
  await writeFile(filepath, buffer)
  return filepath
}

export function createDeviceTools(config: DeviceToolsConfig) {
  const screenshotsDir = config.screenshotsDir ?? join(tmpdir(), 'agent-screenshots')
  let currentDeviceId: string | null = null

  return {
    list_devices: tool({
      description: 'List all connected devices (desktop, mobile, web)',
      inputSchema: z.object({}),
      execute: async () => {
        const response = await fetch(`${config.serverUrl}/devices`)
        const { devices } = (await response.json()) as { devices: DeviceCapabilities[] }
        if (devices.length === 0) {
          return 'No devices connected'
        }
        return devices.map((d) => `${d.deviceId} (${d.platform}): ${d.deviceName}`).join('\n')
      },
    }),

    select_device: tool({
      description: 'Select a device to control',
      inputSchema: z.object({
        deviceId: z.string().describe('Device ID from list_devices'),
      }),
      execute: async ({ deviceId }: { deviceId: string }) => {
        currentDeviceId = deviceId
        return `Selected device: ${deviceId}`
      },
    }),

    device_action: tool({
      description:
        'Execute an action on the selected device. Actions: tap, double_tap, long_press, type, key, swipe, scroll, drag, screenshot, get_ui_tree',
      inputSchema: z.object({
        type: z.enum([
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
        ]),
        payload: z.record(z.unknown()),
      }),
      execute: async (action: { type: string; payload: Record<string, unknown> }) => {
        if (!currentDeviceId) {
          return 'Error: No device selected. Use select_device first.'
        }
        const response = await fetch(`${config.serverUrl}/devices/${currentDeviceId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action),
        })
        const result = (await response.json()) as { success: boolean; error?: string; data?: unknown }
        if (result.success) {
          if (result.data && typeof result.data === 'object' && 'type' in result.data) {
            const data = result.data as { type: string; base64?: string }
            if (data.type === 'screenshot' && data.base64) {
              const filepath = await saveScreenshotToFile(data.base64, screenshotsDir)
              return `Screenshot saved to: ${filepath}`
            }
          }
          return result.data ?? 'Action completed successfully'
        }
        return `Error: ${result.error}`
      },
    }),

    tap: tool({
      description: 'Tap at coordinates on the selected device',
      inputSchema: z.object({
        x: z.number().describe('X coordinate'),
        y: z.number().describe('Y coordinate'),
      }),
      execute: async ({ x, y }: { x: number; y: number }) => {
        if (!currentDeviceId) {
          return 'Error: No device selected. Use select_device first.'
        }
        const response = await fetch(`${config.serverUrl}/devices/${currentDeviceId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'tap', payload: { x, y } }),
        })
        const result = (await response.json()) as { success: boolean; error?: string }
        return result.success ? `Tapped at (${x}, ${y})` : `Error: ${result.error}`
      },
    }),

    type_text: tool({
      description: 'Type text on the selected device',
      inputSchema: z.object({
        text: z.string().describe('Text to type'),
      }),
      execute: async ({ text }: { text: string }) => {
        if (!currentDeviceId) {
          return 'Error: No device selected. Use select_device first.'
        }
        const response = await fetch(`${config.serverUrl}/devices/${currentDeviceId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'type', payload: { text } }),
        })
        const result = (await response.json()) as { success: boolean; error?: string }
        return result.success ? `Typed: ${text}` : `Error: ${result.error}`
      },
    }),

    device_screenshot: tool({
      description: 'Take a screenshot of the selected device',
      inputSchema: z.object({}),
      execute: async () => {
        if (!currentDeviceId) {
          return 'Error: No device selected. Use select_device first.'
        }
        const response = await fetch(`${config.serverUrl}/devices/${currentDeviceId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'screenshot', payload: {} }),
        })
        const result = (await response.json()) as {
          success: boolean
          error?: string
          data?: { type: string; base64: string }
        }
        if (result.success && result.data?.base64) {
          const filepath = await saveScreenshotToFile(result.data.base64, screenshotsDir)
          return `Screenshot saved to: ${filepath}`
        }
        return `Error: ${result.error ?? 'Failed to take screenshot'}`
      },
    }),

    swipe: tool({
      description: 'Swipe on the selected device',
      inputSchema: z.object({
        fromX: z.number().describe('Start X coordinate'),
        fromY: z.number().describe('Start Y coordinate'),
        toX: z.number().describe('End X coordinate'),
        toY: z.number().describe('End Y coordinate'),
        durationMs: z.number().optional().describe('Duration in milliseconds'),
      }),
      execute: async ({
        fromX,
        fromY,
        toX,
        toY,
        durationMs,
      }: {
        fromX: number
        fromY: number
        toX: number
        toY: number
        durationMs?: number
      }) => {
        if (!currentDeviceId) {
          return 'Error: No device selected. Use select_device first.'
        }
        const response = await fetch(`${config.serverUrl}/devices/${currentDeviceId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'swipe',
            payload: { fromX, fromY, toX, toY, durationMs },
          }),
        })
        const result = (await response.json()) as { success: boolean; error?: string }
        return result.success
          ? `Swiped from (${fromX}, ${fromY}) to (${toX}, ${toY})`
          : `Error: ${result.error}`
      },
    }),
  }
}


