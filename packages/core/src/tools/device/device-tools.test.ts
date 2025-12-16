import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createDeviceTools } from './index.js'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('createDeviceTools', () => {
  const serverUrl = 'http://localhost:3000'
  let deviceTools: ReturnType<typeof createDeviceTools>

  beforeEach(() => {
    vi.clearAllMocks()
    deviceTools = createDeviceTools({ serverUrl })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('list_devices', () => {
    it('returns device list when devices are connected', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          devices: [
            {
              deviceId: 'device-1',
              platform: 'desktop',
              deviceName: 'Desktop PC',
            },
            {
              deviceId: 'device-2',
              platform: 'android',
              deviceName: 'Android Phone',
            },
          ],
        }),
      })

      const result = await deviceTools.list_devices.execute({})

      expect(mockFetch).toHaveBeenCalledWith(`${serverUrl}/devices`)
      expect(result).toContain('device-1 (desktop): Desktop PC')
      expect(result).toContain('device-2 (android): Android Phone')
    })

    it('returns message when no devices connected', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ devices: [] }),
      })

      const result = await deviceTools.list_devices.execute({})

      expect(result).toBe('No devices connected')
    })
  })

  describe('select_device', () => {
    it('selects a device and returns confirmation', async () => {
      const result = await deviceTools.select_device.execute({ deviceId: 'device-1' })

      expect(result).toBe('Selected device: device-1')
    })
  })

  describe('device_action', () => {
    it('returns error when no device selected', async () => {
      const result = await deviceTools.device_action.execute({
        type: 'tap',
        payload: { x: 100, y: 200 },
      })

      expect(result).toBe('Error: No device selected. Use select_device first.')
    })

    it('executes action when device is selected', async () => {
      await deviceTools.select_device.execute({ deviceId: 'device-1' })

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ success: true }),
      })

      const result = await deviceTools.device_action.execute({
        type: 'tap',
        payload: { x: 100, y: 200 },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `${serverUrl}/devices/device-1/action`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'tap', payload: { x: 100, y: 200 } }),
        })
      )
      expect(result).toBe('Action completed successfully')
    })

    it('returns image data for screenshot action', async () => {
      await deviceTools.select_device.execute({ deviceId: 'device-1' })

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            type: 'screenshot',
            base64: 'base64imagedata',
          },
        }),
      })

      const result = await deviceTools.device_action.execute({
        type: 'screenshot',
        payload: {},
      })

      expect(result).toEqual({ type: 'image', data: 'base64imagedata' })
    })

    it('returns error message on failure', async () => {
      await deviceTools.select_device.execute({ deviceId: 'device-1' })

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Device not responding',
        }),
      })

      const result = await deviceTools.device_action.execute({
        type: 'tap',
        payload: { x: 100, y: 200 },
      })

      expect(result).toBe('Error: Device not responding')
    })
  })

  describe('tap', () => {
    it('returns error when no device selected', async () => {
      const result = await deviceTools.tap.execute({ x: 100, y: 200 })

      expect(result).toBe('Error: No device selected. Use select_device first.')
    })

    it('taps at coordinates and returns confirmation', async () => {
      await deviceTools.select_device.execute({ deviceId: 'device-1' })

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ success: true }),
      })

      const result = await deviceTools.tap.execute({ x: 100, y: 200 })

      expect(result).toBe('Tapped at (100, 200)')
    })

    it('returns error on failure', async () => {
      await deviceTools.select_device.execute({ deviceId: 'device-1' })

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ success: false, error: 'Tap failed' }),
      })

      const result = await deviceTools.tap.execute({ x: 100, y: 200 })

      expect(result).toBe('Error: Tap failed')
    })
  })

  describe('type_text', () => {
    it('returns error when no device selected', async () => {
      const result = await deviceTools.type_text.execute({ text: 'hello' })

      expect(result).toBe('Error: No device selected. Use select_device first.')
    })

    it('types text and returns confirmation', async () => {
      await deviceTools.select_device.execute({ deviceId: 'device-1' })

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ success: true }),
      })

      const result = await deviceTools.type_text.execute({ text: 'hello' })

      expect(result).toBe('Typed: hello')
    })
  })

  describe('device_screenshot', () => {
    it('returns error when no device selected', async () => {
      const result = await deviceTools.device_screenshot.execute({})

      expect(result).toBe('Error: No device selected. Use select_device first.')
    })

    it('takes screenshot and returns image data', async () => {
      await deviceTools.select_device.execute({ deviceId: 'device-1' })

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            base64: 'base64screenshotdata',
          },
        }),
      })

      const result = await deviceTools.device_screenshot.execute({})

      expect(result).toEqual({ type: 'image', data: 'base64screenshotdata' })
    })

    it('returns error on screenshot failure', async () => {
      await deviceTools.select_device.execute({ deviceId: 'device-1' })

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Screenshot not supported',
        }),
      })

      const result = await deviceTools.device_screenshot.execute({})

      expect(result).toBe('Error: Screenshot not supported')
    })
  })

  describe('swipe', () => {
    it('returns error when no device selected', async () => {
      const result = await deviceTools.swipe.execute({
        fromX: 0,
        fromY: 500,
        toX: 0,
        toY: 100,
      })

      expect(result).toBe('Error: No device selected. Use select_device first.')
    })

    it('swipes and returns confirmation', async () => {
      await deviceTools.select_device.execute({ deviceId: 'device-1' })

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ success: true }),
      })

      const result = await deviceTools.swipe.execute({
        fromX: 0,
        fromY: 500,
        toX: 0,
        toY: 100,
        durationMs: 300,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `${serverUrl}/devices/device-1/action`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            type: 'swipe',
            payload: { fromX: 0, fromY: 500, toX: 0, toY: 100, durationMs: 300 },
          }),
        })
      )
      expect(result).toBe('Swiped from (0, 500) to (0, 100)')
    })
  })
})
