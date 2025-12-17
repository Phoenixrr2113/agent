import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WebSocket } from 'ws'

import type { DeviceCapabilities, DeviceAction, ActionResult } from '@agent/shared'

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

describe('DeviceRegistry', () => {
  let registry: DeviceRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new DeviceRegistry()
  })

  describe('register', () => {
    it('registers a device and returns its id', () => {
      const socket = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })

      const deviceId = registry.register(socket, capabilities)

      expect(deviceId).toBe('device-1')
    })

    it('allows retrieving registered device', () => {
      const socket = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })

      registry.register(socket, capabilities)
      const device = registry.getDevice('device-1')

      expect(device).toBeDefined()
      expect(device?.capabilities).toEqual(capabilities)
      expect(device?.socket).toBe(socket)
    })
  })

  describe('registerLocal', () => {
    it('registers a local device', () => {
      const localDevice: LocalDevice = {
        id: 'local-desktop',
        capabilities: createMockCapabilities({ deviceId: 'local-desktop' }),
        socket: null,
        lastSeen: Date.now(),
        pendingActions: new Map(),
        executeLocal: vi.fn(),
      }

      const deviceId = registry.registerLocal(localDevice)

      expect(deviceId).toBe('local-desktop')
      expect(registry.getDevice('local-desktop')).toBe(localDevice)
    })
  })

  describe('unregister', () => {
    it('removes a device from registry', () => {
      const socket = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })

      registry.register(socket, capabilities)
      registry.unregister('device-1')

      expect(registry.getDevice('device-1')).toBeUndefined()
    })

    it('rejects pending actions when device is unregistered', () => {
      const socket = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })

      registry.register(socket, capabilities)

      const device = registry.getDevice('device-1')!
      const rejectFn = vi.fn()
      const timeout = setTimeout(() => {}, 30000)
      device.pendingActions.set('action-1', {
        resolve: vi.fn(),
        reject: rejectFn,
        timeout,
      })

      registry.unregister('device-1')

      expect(rejectFn).toHaveBeenCalledWith(new Error('Device disconnected'))
    })

    it('handles unregistering non-existent device', () => {
      expect(() => registry.unregister('non-existent')).not.toThrow()
    })
  })

  describe('listDevices', () => {
    it('returns empty array when no devices registered', () => {
      expect(registry.listDevices()).toEqual([])
    })

    it('returns all registered device capabilities', () => {
      const socket1 = createMockSocket()
      const socket2 = createMockSocket()
      const capabilities1 = createMockCapabilities({ deviceId: 'device-1' })
      const capabilities2 = createMockCapabilities({
        deviceId: 'device-2',
        platform: 'android',
      })

      registry.register(socket1, capabilities1)
      registry.register(socket2, capabilities2)

      const devices = registry.listDevices()

      expect(devices).toHaveLength(2)
      expect(devices).toContainEqual(capabilities1)
      expect(devices).toContainEqual(capabilities2)
    })
  })

  describe('executeAction', () => {
    it('returns error for non-existent device', async () => {
      const action: DeviceAction = { type: 'tap', payload: { x: 100, y: 200 } }

      const result = await registry.executeAction('non-existent', action)

      expect(result).toEqual({
        success: false,
        error: 'Device not found',
        code: 'NOT_FOUND',
      })
    })

    it('sends action to remote device via WebSocket', async () => {
      const socket = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })
      registry.register(socket, capabilities)

      const action: DeviceAction = { type: 'tap', payload: { x: 100, y: 200 } }

      const executePromise = registry.executeAction('device-1', action)

      expect(socket.send).toHaveBeenCalled()
      const sentData = JSON.parse((socket.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string)
      expect(sentData.action).toEqual(action)
      expect(sentData.actionId).toBeDefined()

      const mockResult: ActionResult = { success: true }
      registry.handleActionResult('device-1', sentData.actionId, mockResult)

      const result = await executePromise
      expect(result).toEqual(mockResult)
    })

    it('executes action on local device directly', async () => {
      const mockResult: ActionResult = { success: true }
      const localDevice: LocalDevice = {
        id: 'local-desktop',
        capabilities: createMockCapabilities({ deviceId: 'local-desktop' }),
        socket: null,
        lastSeen: Date.now() - 1000,
        pendingActions: new Map(),
        executeLocal: vi.fn().mockResolvedValue(mockResult),
      }

      registry.registerLocal(localDevice)

      const action: DeviceAction = { type: 'tap', payload: { x: 100, y: 200 } }
      const result = await registry.executeAction('local-desktop', action)

      expect(localDevice.executeLocal).toHaveBeenCalledWith(action)
      expect(result).toEqual(mockResult)
    })
  })

  describe('handleActionResult', () => {
    it('resolves pending action with result', async () => {
      const socket = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })
      registry.register(socket, capabilities)

      const action: DeviceAction = { type: 'tap', payload: { x: 100, y: 200 } }
      const executePromise = registry.executeAction('device-1', action)

      const sentData = JSON.parse((socket.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string)
      const mockResult: ActionResult = { success: true }

      registry.handleActionResult('device-1', sentData.actionId, mockResult)

      const result = await executePromise
      expect(result).toEqual(mockResult)
    })

    it('does nothing for unknown action id', () => {
      const socket = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })
      registry.register(socket, capabilities)

      expect(() => {
        registry.handleActionResult('device-1', 'unknown-action', { success: true })
      }).not.toThrow()
    })
  })

  describe('updateLastSeen', () => {
    it('updates lastSeen timestamp', async () => {
      const socket = createMockSocket()
      const capabilities = createMockCapabilities({ deviceId: 'device-1' })
      registry.register(socket, capabilities)

      const device = registry.getDevice('device-1')!
      const originalLastSeen = device.lastSeen

      await new Promise((resolve) => setTimeout(resolve, 10))
      registry.updateLastSeen('device-1')

      expect(device.lastSeen).toBeGreaterThan(originalLastSeen)
    })

    it('handles non-existent device', () => {
      expect(() => registry.updateLastSeen('non-existent')).not.toThrow()
    })
  })
})
