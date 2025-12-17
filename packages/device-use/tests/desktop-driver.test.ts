import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@nut-tree-fork/nut-js', () => ({
  mouse: {
    setPosition: vi.fn(),
    click: vi.fn(),
    doubleClick: vi.fn(),
    pressButton: vi.fn(),
    releaseButton: vi.fn(),
    drag: vi.fn(),
    scrollUp: vi.fn(),
    scrollDown: vi.fn(),
    scrollLeft: vi.fn(),
    scrollRight: vi.fn(),
  },
  keyboard: {
    type: vi.fn(),
    pressKey: vi.fn(),
    releaseKey: vi.fn(),
  },
  screen: {
    grab: vi.fn(),
    width: vi.fn().mockResolvedValue(1920),
    height: vi.fn().mockResolvedValue(1080),
  },
  Button: {
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
    MIDDLE: 'MIDDLE',
  },
  Key: {
    Return: 'Return',
    Tab: 'Tab',
    Space: 'Space',
    Escape: 'Escape',
    Backspace: 'Backspace',
    LeftControl: 'LeftControl',
    LeftAlt: 'LeftAlt',
    LeftShift: 'LeftShift',
    LeftSuper: 'LeftSuper',
    Up: 'Up',
    Down: 'Down',
    Left: 'Left',
    Right: 'Right',
    A: 'A',
    B: 'B',
    C: 'C',
  },
  Point: class Point {
    constructor(
      public x: number,
      public y: number
    ) {}
  },
}))

import { mouse, keyboard, screen } from '@nut-tree-fork/nut-js'

import { DesktopDriver } from '../src/drivers/desktop.js'

describe('DesktopDriver', () => {
  let driver: DesktopDriver

  beforeEach(() => {
    vi.clearAllMocks()
    driver = new DesktopDriver()
  })

  describe('getCapabilities', () => {
    it('returns desktop capabilities', async () => {
      const capabilities = await driver.getCapabilities()

      expect(capabilities.platform).toBe('desktop')
      expect(capabilities.deviceId).toMatch(/^desktop-(macos|linux|windows)$/)
      expect(capabilities.screenSize).toEqual({ width: 1920, height: 1080 })
      expect(capabilities.hasKeyboard).toBe(true)
      expect(capabilities.hasUITree).toBe(false)
      expect(capabilities.supportedActions).toContain('tap')
      expect(capabilities.supportedActions).toContain('screenshot')
    })
  })

  describe('execute - tap', () => {
    it('moves mouse and clicks', async () => {
      const result = await driver.execute({
        type: 'tap',
        payload: { x: 100, y: 200 },
      })

      expect(mouse.setPosition).toHaveBeenCalled()
      expect(mouse.click).toHaveBeenCalledWith('LEFT')
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - double_tap', () => {
    it('moves mouse and double clicks', async () => {
      const result = await driver.execute({
        type: 'double_tap',
        payload: { x: 100, y: 200 },
      })

      expect(mouse.setPosition).toHaveBeenCalled()
      expect(mouse.doubleClick).toHaveBeenCalledWith('LEFT')
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - long_press', () => {
    it('moves mouse, holds and releases button', async () => {
      const result = await driver.execute({
        type: 'long_press',
        payload: { x: 100, y: 200 },
      })

      expect(mouse.setPosition).toHaveBeenCalled()
      expect(mouse.pressButton).toHaveBeenCalledWith('LEFT')
      expect(mouse.releaseButton).toHaveBeenCalledWith('LEFT')
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - type', () => {
    it('types text', async () => {
      const result = await driver.execute({
        type: 'type',
        payload: { text: 'hello world' },
      })

      expect(keyboard.type).toHaveBeenCalledWith('hello world')
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - key', () => {
    it('presses a single key', async () => {
      const result = await driver.execute({
        type: 'key',
        payload: { key: 'Return' },
      })

      expect(keyboard.pressKey).toHaveBeenCalled()
      expect(keyboard.releaseKey).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it('handles key with modifiers', async () => {
      const result = await driver.execute({
        type: 'key',
        payload: { key: 'A', modifiers: ['ctrl', 'shift'] },
      })

      expect(keyboard.pressKey).toHaveBeenCalled()
      expect(keyboard.releaseKey).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - swipe', () => {
    it('performs swipe gesture', async () => {
      const result = await driver.execute({
        type: 'swipe',
        payload: { fromX: 0, fromY: 500, toX: 0, toY: 100 },
      })

      expect(mouse.setPosition).toHaveBeenCalledTimes(2)
      expect(mouse.pressButton).toHaveBeenCalledWith('LEFT')
      expect(mouse.releaseButton).toHaveBeenCalledWith('LEFT')
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - scroll', () => {
    it('scrolls down when deltaY is positive', async () => {
      const result = await driver.execute({
        type: 'scroll',
        payload: { deltaX: 0, deltaY: 100 },
      })

      expect(mouse.scrollDown).toHaveBeenCalledWith(100)
      expect(result).toEqual({ success: true })
    })

    it('scrolls up when deltaY is negative', async () => {
      const result = await driver.execute({
        type: 'scroll',
        payload: { deltaX: 0, deltaY: -100 },
      })

      expect(mouse.scrollUp).toHaveBeenCalledWith(100)
      expect(result).toEqual({ success: true })
    })

    it('scrolls right when deltaX is positive', async () => {
      const result = await driver.execute({
        type: 'scroll',
        payload: { deltaX: 100, deltaY: 0 },
      })

      expect(mouse.scrollRight).toHaveBeenCalledWith(100)
      expect(result).toEqual({ success: true })
    })

    it('scrolls left when deltaX is negative', async () => {
      const result = await driver.execute({
        type: 'scroll',
        payload: { deltaX: -100, deltaY: 0 },
      })

      expect(mouse.scrollLeft).toHaveBeenCalledWith(100)
      expect(result).toEqual({ success: true })
    })

    it('moves to position before scrolling when x/y provided', async () => {
      const result = await driver.execute({
        type: 'scroll',
        payload: { deltaX: 0, deltaY: 100, x: 500, y: 500 },
      })

      expect(mouse.setPosition).toHaveBeenCalled()
      expect(mouse.scrollDown).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - drag', () => {
    it('performs drag operation', async () => {
      const result = await driver.execute({
        type: 'drag',
        payload: { fromX: 100, fromY: 100, toX: 200, toY: 200 },
      })

      expect(mouse.setPosition).toHaveBeenCalled()
      expect(mouse.drag).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - screenshot', () => {
    it('takes and returns screenshot', async () => {
      const mockImageData = Buffer.from('mock-image-data')
      ;(screen.grab as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: mockImageData,
      })

      const result = await driver.execute({
        type: 'screenshot',
        payload: {},
      })

      expect(screen.grab).toHaveBeenCalled()
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        const data = result.data as { type: string; base64: string; format: string }
        expect(data.type).toBe('screenshot')
        expect(data.format).toBe('png')
        expect(data.base64).toBe(mockImageData.toString('base64'))
      }
    })
  })

  describe('execute - get_ui_tree', () => {
    it('returns not supported for desktop', async () => {
      const result = await driver.execute({
        type: 'get_ui_tree',
        payload: {},
      })

      expect(result).toEqual({
        success: false,
        error: 'UI tree not supported on desktop',
        code: 'NOT_SUPPORTED',
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
})
