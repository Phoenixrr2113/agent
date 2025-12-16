import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WebSocket } from 'ws'

import type { DeviceCapabilities, DeviceAction, ActionResult } from '@agent/shared'

import { createLocalDesktopDevice, type LocalDeviceDriver } from './local-desktop.js'
import { DeviceRegistry, type LocalDevice } from './registry.js'

function createMockSocket(): WebSocket {
  return {
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket
}

function createMockCapabilities(overrides: Partial<DeviceCapabilities> = {}): DeviceCapabilities {
  return {
    platform: 'desktop',
    deviceId: 'test-device',
    deviceName: 'Test Device',
    screenSize: { width: 1920, height: 1080 },
    supportedActions: ['tap', 'type', 'screenshot'],
    hasKeyboard: true,
    hasUITree: false,
    ...overrides,
  }
}

describe('Device System Integration', () => {
  let registry: DeviceRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new DeviceRegistry()
  })

  describe('Multi-device Selection', () => {
    it('supports multiple devices simultaneously', async () => {
      const socket1 = createMockSocket()
      const socket2 = createMockSocket()
      const capabilities1 = createMockCapabilities({ deviceId: 'device-1', platform: 'desktop' })
      const capabilities2 = createMockCapabilities({ deviceId: 'device-2', platform: 'android' })

      registry.register(socket1, capabilities1)
      registry.register(socket2, capabilities2)

      const devices = registry.listDevices()
      expect(devices).toHaveLength(2)
      expect(devices.find((d) => d.deviceId === 'device-1')).toBeDefined()
      expect(devices.find((d) => d.deviceId === 'device-2')).toBeDefined()
    })

    it('can execute actions on different devices', async () => {
      const socket1 = createMockSocket()
      const socket2 = createMockSocket()
      const capabilities1 = createMockCapabilities({ deviceId: 'device-1' })
      const capabilities2 = createMockCapabilities({ deviceId: 'device-2' })

      registry.register(socket1, capabilities1)
      registry.register(socket2, capabilities2)

      const action: DeviceAction = { type: 'tap', payload: { x: 100, y: 200 } }

      const promise1 = registry.executeAction('device-1', action)
      const promise2 = registry.executeAction('device-2', action)

      expect(socket1.send).toHaveBeenCalled()
      expect(socket2.send).toHaveBeenCalled()

      const sent1 = JSON.parse((socket1.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string)
      const sent2 = JSON.parse((socket2.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string)

      registry.handleActionResult('device-1', sent1.actionId, { success: true })
      registry.handleActionResult('device-2', sent2.actionId, { success: true })

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(result1).toEqual({ success: true })
      expect(result2).toEqual({ success: true })
    })
  })

  describe('Local Desktop Mode', () => {
    it('creates local device with driver', async () => {
      const mockDriver: LocalDeviceDriver = {
        execute: vi.fn().mockResolvedValue({ success: true }),
        getCapabilities: vi.fn().mockResolvedValue(createMockCapabilities({ deviceId: 'local-desktop' })),
      }

      const localDevice = await createLocalDesktopDevice(mockDriver)

      expect(localDevice.id).toBe('local-desktop')
      expect(localDevice.socket).toBeNull()
      expect(localDevice.capabilities.platform).toBe('desktop')
    })

    it('executes actions directly via driver', async () => {
      const mockResult: ActionResult = { success: true }
      const mockDriver: LocalDeviceDriver = {
        execute: vi.fn().mockResolvedValue(mockResult),
        getCapabilities: vi.fn().mockResolvedValue(createMockCapabilities({ deviceId: 'local-desktop' })),
      }

      const localDevice = await createLocalDesktopDevice(mockDriver)
      registry.registerLocal(localDevice)

      const action: DeviceAction = { type: 'tap', payload: { x: 100, y: 200 } }
      const result = await registry.executeAction('local-desktop', action)

      expect(mockDriver.execute).toHaveBeenCalledWith(action)
      expect(result).toEqual(mockResult)
    })

    it('mixes local and remote devices', async () => {
      const mockDriver: LocalDeviceDriver = {
        execute: vi.fn().mockResolvedValue({ success: true }),
        getCapabilities: vi.fn().mockResolvedValue(createMockCapabilities({ deviceId: 'local-desktop' })),
      }

      const localDevice = await createLocalDesktopDevice(mockDriver)
      registry.registerLocal(localDevice)

      const remoteSocket = createMockSocket()
      registry.register(remoteSocket, createMockCapabilities({ deviceId: 'remote-device', platform: 'android' }))

      const devices = registry.listDevices()
      expect(devices).toHaveLength(2)

      const localResult = await registry.executeAction('local-desktop', { type: 'screenshot', payload: {} })
      expect(mockDriver.execute).toHaveBeenCalled()
      expect(localResult).toEqual({ success: true })

      const remotePromise = registry.executeAction('remote-device', { type: 'screenshot', payload: {} })
      expect(remoteSocket.send).toHaveBeenCalled()
      const sent = JSON.parse((remoteSocket.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string)
      registry.handleActionResult('remote-device', sent.actionId, { success: true, data: { type: 'screenshot', base64: 'abc', format: 'png', width: 100, height: 100 } })
      const remoteResult = await remotePromise
      expect(remoteResult.success).toBe(true)
    })
  })

  describe('Device Lifecycle', () => {
    it('removes device on disconnect', () => {
      const socket = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })

      registry.register(socket, capabilities)
      expect(registry.listDevices()).toHaveLength(1)

      registry.unregister('device-1')
      expect(registry.listDevices()).toHaveLength(0)
    })

    it('rejects pending actions on disconnect', async () => {
      const socket = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })

      registry.register(socket, capabilities)

      const action: DeviceAction = { type: 'tap', payload: { x: 100, y: 200 } }
      const promise = registry.executeAction('device-1', action)

      registry.unregister('device-1')

      await expect(promise).rejects.toThrow('Device disconnected')
    })

    it('allows re-registration after disconnect', () => {
      const socket1 = createMockSocket()
      const socket2 = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })

      registry.register(socket1, capabilities)
      registry.unregister('device-1')
      registry.register(socket2, capabilities)

      expect(registry.listDevices()).toHaveLength(1)
      expect(registry.getDevice('device-1')?.socket).toBe(socket2)
    })
  })

  describe('Action Flow', () => {
    it('tracks action timing', async () => {
      const socket = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })

      registry.register(socket, capabilities)
      registry.updateLastSeen('device-1')

      const beforeLastSeen = registry.getDevice('device-1')!.lastSeen

      await new Promise((resolve) => setTimeout(resolve, 10))
      registry.updateLastSeen('device-1')

      const afterLastSeen = registry.getDevice('device-1')!.lastSeen
      expect(afterLastSeen).toBeGreaterThan(beforeLastSeen)
    })

    it('handles screenshot data correctly', async () => {
      const socket = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })

      registry.register(socket, capabilities)

      const action: DeviceAction = { type: 'screenshot', payload: {} }
      const promise = registry.executeAction('device-1', action)

      const sent = JSON.parse((socket.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string)
      const screenshotResult: ActionResult = {
        success: true,
        data: {
          type: 'screenshot',
          base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          format: 'png',
          width: 1920,
          height: 1080,
        },
      }

      registry.handleActionResult('device-1', sent.actionId, screenshotResult)

      const result = await promise
      expect(result.success).toBe(true)
      if (result.success && result.data && typeof result.data === 'object' && 'type' in result.data) {
        expect(result.data.type).toBe('screenshot')
      }
    })
  })
})
