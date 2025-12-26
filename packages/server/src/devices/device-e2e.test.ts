import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import type { Server } from 'node:http'

import type { DeviceCapabilities, DeviceAction, ActionResult } from '@agent/shared'

import { DeviceRegistry, type LocalDevice } from './registry.js'
import { createLocalDesktopDevice, type LocalDeviceDriver } from './local-desktop.js'

describe('Device E2E Tests', () => {
  describe('Local Desktop Device Integration', () => {
    let registry: DeviceRegistry
    let mockDriver: LocalDeviceDriver
    let localDevice: LocalDevice

    beforeEach(async () => {
      registry = new DeviceRegistry()

      mockDriver = {
        execute: vi.fn().mockImplementation(async (action: DeviceAction): Promise<ActionResult> => {
          switch (action.type) {
            case 'screenshot':
              return {
                success: true,
                data: {
                  type: 'screenshot',
                  format: 'png' as const,
                  base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                  width: 1920,
                  height: 1080,
                },
              }
            case 'tap':
              return { success: true }
            case 'type':
              return { success: true }
            case 'key':
              return { success: true }
            case 'scroll':
              return { success: true }
            case 'drag':
              return { success: true }
            default:
              return { success: false, error: `Unknown action: ${action.type}`, code: 'NOT_SUPPORTED' as const }
          }
        }),
        getCapabilities: vi.fn().mockResolvedValue({
          platform: 'desktop',
          deviceId: 'mock-desktop',
          deviceName: 'Mock Desktop',
          screenSize: { width: 1920, height: 1080 },
          supportedActions: ['tap', 'double_tap', 'type', 'key', 'scroll', 'drag', 'screenshot'],
          hasKeyboard: true,
          hasUITree: false,
        } as DeviceCapabilities),
      }

      localDevice = await createLocalDesktopDevice(mockDriver)
      registry.registerLocal(localDevice)
    })

    afterEach(() => {
      vi.clearAllMocks()
    })

    it('lists local desktop device correctly', () => {
      const devices = registry.listDevices()
      expect(devices).toHaveLength(1)
      expect(devices[0]?.deviceId).toBe('local-desktop')
      expect(devices[0]?.platform).toBe('desktop')
    })

    it('executes screenshot action on local device', async () => {
      const result = await registry.executeAction('local-desktop', {
        type: 'screenshot',
        payload: {},
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect((result.data as any).type).toBe('screenshot')
        expect((result.data as any).base64).toBeDefined()
      }
      expect(mockDriver.execute).toHaveBeenCalledWith({
        type: 'screenshot',
        payload: {},
      })
    })

    it('executes tap action with coordinates', async () => {
      const result = await registry.executeAction('local-desktop', {
        type: 'tap',
        payload: { x: 500, y: 300 },
      })

      expect(result.success).toBe(true)
      expect(mockDriver.execute).toHaveBeenCalledWith({
        type: 'tap',
        payload: { x: 500, y: 300 },
      })
    })

    it('executes type action with text', async () => {
      const result = await registry.executeAction('local-desktop', {
        type: 'type',
        payload: { text: 'Hello World' },
      })

      expect(result.success).toBe(true)
      expect(mockDriver.execute).toHaveBeenCalledWith({
        type: 'type',
        payload: { text: 'Hello World' },
      })
    })

    it('executes key action for keyboard shortcuts', async () => {
      const result = await registry.executeAction('local-desktop', {
        type: 'key',
        payload: { key: 'Return' },
      })

      expect(result.success).toBe(true)
      expect(mockDriver.execute).toHaveBeenCalledWith({
        type: 'key',
        payload: { key: 'Return' },
      })
    })

    it('executes scroll action', async () => {
      const result = await registry.executeAction('local-desktop', {
        type: 'scroll',
        payload: { direction: 'down', amount: 100 },
      })

      expect(result.success).toBe(true)
      expect(mockDriver.execute).toHaveBeenCalledWith({
        type: 'scroll',
        payload: { direction: 'down', amount: 100 },
      })
    })

    it('executes drag action between coordinates', async () => {
      const result = await registry.executeAction('local-desktop', {
        type: 'drag',
        payload: { startX: 100, startY: 100, endX: 200, endY: 200 },
      })

      expect(result.success).toBe(true)
      expect(mockDriver.execute).toHaveBeenCalledWith({
        type: 'drag',
        payload: { startX: 100, startY: 100, endX: 200, endY: 200 },
      })
    })

    it('returns error for unknown device', async () => {
      const result = await registry.executeAction('unknown-device', {
        type: 'tap',
        payload: { x: 100, y: 100 },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Device not found')
      }
    })

    it('handles driver execution errors gracefully', async () => {
      mockDriver.execute = vi.fn().mockRejectedValue(new Error('Driver error'))

      const result = await registry.executeAction('local-desktop', {
        type: 'tap',
        payload: { x: 100, y: 100 },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Driver error')
      }
    })
  })

  describe('Device Selection Flow', () => {
    let registry: DeviceRegistry

    beforeEach(() => {
      registry = new DeviceRegistry()
    })

    it('supports workflow: list -> select -> action', async () => {
      const mockDriver: LocalDeviceDriver = {
        execute: vi.fn().mockResolvedValue({ success: true, data: { type: 'screenshot', base64: 'test', width: 100, height: 100 } }),
        getCapabilities: vi.fn().mockResolvedValue({
          platform: 'desktop',
          deviceId: 'workflow-device',
          deviceName: 'Workflow Device',
          screenSize: { width: 1920, height: 1080 },
          supportedActions: ['screenshot'],
          hasKeyboard: true,
          hasUITree: false,
        }),
      }

      const device = await createLocalDesktopDevice(mockDriver)
      registry.registerLocal(device)

      const devices = registry.listDevices()
      expect(devices).toHaveLength(1)
      expect(devices[0]?.deviceId).toBe('local-desktop')

      const selectedDevice = registry.getDevice('local-desktop')
      expect(selectedDevice).toBeDefined()
      expect(selectedDevice?.id).toBe('local-desktop')

      const result = await registry.executeAction('local-desktop', {
        type: 'screenshot',
        payload: {},
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Multiple Device Types', () => {
    let registry: DeviceRegistry

    beforeEach(() => {
      registry = new DeviceRegistry()
    })

    it('handles mixed local and remote devices', async () => {
      const mockLocalDriver: LocalDeviceDriver = {
        execute: vi.fn().mockResolvedValue({ success: true }),
        getCapabilities: vi.fn().mockResolvedValue({
          platform: 'desktop',
          deviceId: 'local-desktop-id',
          deviceName: 'Local Desktop',
          screenSize: { width: 1920, height: 1080 },
          supportedActions: ['tap', 'screenshot'],
          hasKeyboard: true,
          hasUITree: false,
        }),
      }

      const localDevice = await createLocalDesktopDevice(mockLocalDriver)
      registry.registerLocal(localDevice)

      const mockSocket = {
        send: vi.fn(),
        close: vi.fn(),
      } as any

      const remoteCapabilities: DeviceCapabilities = {
        platform: 'android',
        deviceId: 'remote-android',
        deviceName: 'Remote Android',
        screenSize: { width: 1080, height: 1920 },
        supportedActions: ['tap', 'swipe', 'screenshot'],
        hasKeyboard: true,
        hasUITree: true,
      }

      registry.register(mockSocket, remoteCapabilities)

      const devices = registry.listDevices()
      expect(devices).toHaveLength(2)
      expect(devices.find((d) => d.platform === 'desktop')).toBeDefined()
      expect(devices.find((d) => d.platform === 'android')).toBeDefined()

      const localResult = await registry.executeAction('local-desktop', {
        type: 'tap',
        payload: { x: 100, y: 100 },
      })
      expect(localResult.success).toBe(true)
      expect(mockLocalDriver.execute).toHaveBeenCalled()
    })
  })
})
