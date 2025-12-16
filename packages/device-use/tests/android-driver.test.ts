import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@agent/mobile-accessibility', () => ({
  click: vi.fn(),
  longPress: vi.fn(),
  swipe: vi.fn(),
  type: vi.fn(),
  pressKey: vi.fn(),
  screenshot: vi.fn(),
  getUITree: vi.fn(),
}))

import * as AgentAccessibility from '@agent/mobile-accessibility'

import { AndroidDriver } from '../src/drivers/android.js'

describe('AndroidDriver', () => {
  let driver: AndroidDriver

  beforeEach(() => {
    vi.clearAllMocks()
    driver = new AndroidDriver()
    driver.setScreenSize(1080, 1920)
  })

  describe('getCapabilities', () => {
    it('returns android capabilities', async () => {
      const capabilities = await driver.getCapabilities()

      expect(capabilities.platform).toBe('android')
      expect(capabilities.deviceId).toBe('android-device')
      expect(capabilities.screenSize).toEqual({ width: 1080, height: 1920 })
      expect(capabilities.hasKeyboard).toBe(true)
      expect(capabilities.hasUITree).toBe(true)
      expect(capabilities.supportedActions).toContain('tap')
      expect(capabilities.supportedActions).toContain('screenshot')
      expect(capabilities.supportedActions).toContain('get_ui_tree')
    })
  })

  describe('setScreenSize', () => {
    it('updates screen size used in capabilities', async () => {
      driver.setScreenSize(720, 1280)
      const capabilities = await driver.getCapabilities()

      expect(capabilities.screenSize).toEqual({ width: 720, height: 1280 })
    })
  })

  describe('execute - tap', () => {
    it('calls click with coordinates', async () => {
      vi.mocked(AgentAccessibility.click).mockResolvedValue(true)

      const result = await driver.execute({
        type: 'tap',
        payload: { x: 100, y: 200 },
      })

      expect(AgentAccessibility.click).toHaveBeenCalledWith(100, 200)
      expect(result).toEqual({ success: true })
    })

    it('returns error on failure', async () => {
      vi.mocked(AgentAccessibility.click).mockResolvedValue(false)

      const result = await driver.execute({
        type: 'tap',
        payload: { x: 100, y: 200 },
      })

      expect(result).toEqual({
        success: false,
        error: 'Tap failed',
        code: 'UNKNOWN',
      })
    })
  })

  describe('execute - double_tap', () => {
    it('calls click twice', async () => {
      vi.mocked(AgentAccessibility.click).mockResolvedValue(true)

      const result = await driver.execute({
        type: 'double_tap',
        payload: { x: 100, y: 200 },
      })

      expect(AgentAccessibility.click).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - long_press', () => {
    it('calls longPress with duration', async () => {
      vi.mocked(AgentAccessibility.longPress).mockResolvedValue(true)

      const result = await driver.execute({
        type: 'long_press',
        payload: { x: 100, y: 200 },
      })

      expect(AgentAccessibility.longPress).toHaveBeenCalledWith(100, 200, 500)
      expect(result).toEqual({ success: true })
    })

    it('returns error on failure', async () => {
      vi.mocked(AgentAccessibility.longPress).mockResolvedValue(false)

      const result = await driver.execute({
        type: 'long_press',
        payload: { x: 100, y: 200 },
      })

      expect(result).toEqual({
        success: false,
        error: 'Long press failed',
        code: 'UNKNOWN',
      })
    })
  })

  describe('execute - type', () => {
    it('calls type with text', async () => {
      vi.mocked(AgentAccessibility.type).mockResolvedValue(true)

      const result = await driver.execute({
        type: 'type',
        payload: { text: 'hello world' },
      })

      expect(AgentAccessibility.type).toHaveBeenCalledWith('hello world')
      expect(result).toEqual({ success: true })
    })

    it('returns error on failure', async () => {
      vi.mocked(AgentAccessibility.type).mockResolvedValue(false)

      const result = await driver.execute({
        type: 'type',
        payload: { text: 'hello' },
      })

      expect(result).toEqual({
        success: false,
        error: 'Type failed',
        code: 'UNKNOWN',
      })
    })
  })

  describe('execute - key', () => {
    it('calls pressKey with key action', async () => {
      vi.mocked(AgentAccessibility.pressKey).mockResolvedValue(true)

      const result = await driver.execute({
        type: 'key',
        payload: { key: 'back' },
      })

      expect(AgentAccessibility.pressKey).toHaveBeenCalledWith('back')
      expect(result).toEqual({ success: true })
    })

    it('returns error on failure', async () => {
      vi.mocked(AgentAccessibility.pressKey).mockResolvedValue(false)

      const result = await driver.execute({
        type: 'key',
        payload: { key: 'home' },
      })

      expect(result).toEqual({
        success: false,
        error: 'Key press failed',
        code: 'UNKNOWN',
      })
    })
  })

  describe('execute - swipe', () => {
    it('calls swipe with coordinates and duration', async () => {
      vi.mocked(AgentAccessibility.swipe).mockResolvedValue(true)

      const result = await driver.execute({
        type: 'swipe',
        payload: { fromX: 0, fromY: 500, toX: 0, toY: 100, durationMs: 400 },
      })

      expect(AgentAccessibility.swipe).toHaveBeenCalledWith(0, 500, 0, 100, 400)
      expect(result).toEqual({ success: true })
    })

    it('uses default duration if not provided', async () => {
      vi.mocked(AgentAccessibility.swipe).mockResolvedValue(true)

      await driver.execute({
        type: 'swipe',
        payload: { fromX: 0, fromY: 500, toX: 0, toY: 100 },
      })

      expect(AgentAccessibility.swipe).toHaveBeenCalledWith(0, 500, 0, 100, 300)
    })

    it('returns error on failure', async () => {
      vi.mocked(AgentAccessibility.swipe).mockResolvedValue(false)

      const result = await driver.execute({
        type: 'swipe',
        payload: { fromX: 0, fromY: 500, toX: 0, toY: 100 },
      })

      expect(result).toEqual({
        success: false,
        error: 'Swipe failed',
        code: 'UNKNOWN',
      })
    })
  })

  describe('execute - scroll', () => {
    it('converts scroll to swipe', async () => {
      vi.mocked(AgentAccessibility.swipe).mockResolvedValue(true)

      const result = await driver.execute({
        type: 'scroll',
        payload: { deltaX: 0, deltaY: 200 },
      })

      expect(AgentAccessibility.swipe).toHaveBeenCalledWith(540, 960, 540, 760, 300)
      expect(result).toEqual({ success: true })
    })

    it('uses provided position for scroll', async () => {
      vi.mocked(AgentAccessibility.swipe).mockResolvedValue(true)

      await driver.execute({
        type: 'scroll',
        payload: { deltaX: 100, deltaY: 200, x: 300, y: 400 },
      })

      expect(AgentAccessibility.swipe).toHaveBeenCalledWith(300, 400, 200, 200, 300)
    })
  })

  describe('execute - drag', () => {
    it('uses swipe for drag', async () => {
      vi.mocked(AgentAccessibility.swipe).mockResolvedValue(true)

      const result = await driver.execute({
        type: 'drag',
        payload: { fromX: 100, fromY: 100, toX: 200, toY: 200 },
      })

      expect(AgentAccessibility.swipe).toHaveBeenCalledWith(100, 100, 200, 200, 500)
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - screenshot', () => {
    it('returns screenshot data', async () => {
      vi.mocked(AgentAccessibility.screenshot).mockResolvedValue('base64imagedata')

      const result = await driver.execute({
        type: 'screenshot',
        payload: {},
      })

      expect(AgentAccessibility.screenshot).toHaveBeenCalled()
      expect(result).toEqual({
        success: true,
        data: {
          type: 'screenshot',
          base64: 'base64imagedata',
          format: 'png',
          width: 1080,
          height: 1920,
        },
      })
    })

    it('returns error when screenshot fails', async () => {
      vi.mocked(AgentAccessibility.screenshot).mockResolvedValue(null)

      const result = await driver.execute({
        type: 'screenshot',
        payload: {},
      })

      expect(result).toEqual({
        success: false,
        error: 'Screenshot failed',
        code: 'UNKNOWN',
      })
    })
  })

  describe('execute - get_ui_tree', () => {
    it('returns UI tree data', async () => {
      const mockTree = {
        id: 'root',
        type: 'container',
        bounds: { x: 0, y: 0, width: 1080, height: 1920 },
        clickable: false,
        focusable: false,
        enabled: true,
        visible: true,
        children: [],
      }
      vi.mocked(AgentAccessibility.getUITree).mockResolvedValue(JSON.stringify(mockTree))

      const result = await driver.execute({
        type: 'get_ui_tree',
        payload: {},
      })

      expect(AgentAccessibility.getUITree).toHaveBeenCalled()
      expect(result).toEqual({
        success: true,
        data: {
          type: 'ui_tree',
          root: mockTree,
        },
      })
    })

    it('returns error when UI tree fails', async () => {
      vi.mocked(AgentAccessibility.getUITree).mockResolvedValue(null)

      const result = await driver.execute({
        type: 'get_ui_tree',
        payload: {},
      })

      expect(result).toEqual({
        success: false,
        error: 'UI tree failed',
        code: 'UNKNOWN',
      })
    })
  })

  describe('execute - unknown action', () => {
    it('returns not supported for unknown action', async () => {
      const result = await driver.execute({
        type: 'unknown_action' as any,
        payload: {},
      })

      expect(result).toEqual({
        success: false,
        error: 'Unknown action type: unknown_action',
        code: 'NOT_SUPPORTED',
      })
    })
  })

  describe('getUITree', () => {
    it('returns parsed UI tree', async () => {
      const mockTree = {
        id: 'root',
        type: 'container',
        bounds: { x: 0, y: 0, width: 1080, height: 1920 },
        clickable: false,
        focusable: false,
        enabled: true,
        visible: true,
        children: [],
      }
      vi.mocked(AgentAccessibility.getUITree).mockResolvedValue(JSON.stringify(mockTree))

      const tree = await driver.getUITree()

      expect(tree).toEqual(mockTree)
    })

    it('throws error when UI tree not available', async () => {
      vi.mocked(AgentAccessibility.getUITree).mockResolvedValue(null)

      await expect(driver.getUITree()).rejects.toThrow('UI tree not available')
    })
  })
})
