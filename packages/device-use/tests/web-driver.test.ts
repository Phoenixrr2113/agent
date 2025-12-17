import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockPage = {
  viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
  mouse: {
    click: vi.fn(),
    dblclick: vi.fn(),
    move: vi.fn(),
    down: vi.fn(),
    up: vi.fn(),
    wheel: vi.fn(),
  },
  keyboard: {
    type: vi.fn(),
    press: vi.fn(),
    down: vi.fn(),
    up: vi.fn(),
  },
  click: vi.fn(),
  dblclick: vi.fn(),
  fill: vi.fn(),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
  evaluate: vi.fn().mockResolvedValue({ type: 'body', children: [] }),
  goto: vi.fn(),
  url: vi.fn().mockReturnValue('https://example.com'),
  title: vi.fn().mockResolvedValue('Example'),
  waitForSelector: vi.fn(),
}

const mockContext = {
  pages: vi.fn().mockReturnValue([mockPage]),
  newPage: vi.fn().mockResolvedValue(mockPage),
}

const mockBrowser = {
  contexts: vi.fn().mockReturnValue([mockContext]),
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn(),
}

vi.mock('playwright', () => ({
  chromium: {
    connectOverCDP: vi.fn().mockResolvedValue(mockBrowser),
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}))

import { WebDriver } from '../src/drivers/web.js'

describe('WebDriver', () => {
  let driver: WebDriver

  beforeEach(() => {
    vi.clearAllMocks()
    driver = new WebDriver({ cdpUrl: 'http://localhost:9222' })
  })

  afterEach(async () => {
    if (driver.isConnected()) {
      await driver.disconnect()
    }
  })

  describe('connect', () => {
    it('connects to existing browser via CDP', async () => {
      await driver.connect()

      expect(driver.isConnected()).toBe(true)
      expect(driver.isUsingExistingSession()).toBe(true)
    })

    it('launches new browser if CDP connection fails and launchIfNotConnected is true', async () => {
      const pw = await import('playwright')
      vi.mocked(pw.chromium.connectOverCDP).mockRejectedValueOnce(new Error('Connection refused'))

      const launchDriver = new WebDriver({ launchIfNotConnected: true })
      await launchDriver.connect()

      expect(launchDriver.isConnected()).toBe(true)
      expect(launchDriver.isUsingExistingSession()).toBe(false)
    })

    it('throws error if CDP fails and launchIfNotConnected is false', async () => {
      const pw = await import('playwright')
      vi.mocked(pw.chromium.connectOverCDP).mockRejectedValueOnce(new Error('Connection refused'))

      const strictDriver = new WebDriver({ launchIfNotConnected: false })

      await expect(strictDriver.connect()).rejects.toThrow('Cannot connect to browser')
    })
  })

  describe('getCapabilities', () => {
    it('returns web capabilities', async () => {
      await driver.connect()
      const capabilities = await driver.getCapabilities()

      expect(capabilities.platform).toBe('web')
      expect(capabilities.deviceId).toBe('web-browser')
      expect(capabilities.screenSize).toEqual({ width: 1920, height: 1080 })
      expect(capabilities.hasKeyboard).toBe(true)
      expect(capabilities.hasUITree).toBe(true)
      expect(capabilities.supportedActions).toContain('tap')
      expect(capabilities.supportedActions).toContain('screenshot')
    })
  })

  describe('execute - tap', () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it('clicks at coordinates', async () => {
      const result = await driver.execute({
        type: 'tap',
        payload: { x: 100, y: 200 },
      })

      expect(mockPage.mouse.click).toHaveBeenCalledWith(100, 200)
      expect(result).toEqual({ success: true })
    })

    it('clicks on element by selector', async () => {
      const result = await driver.execute({
        type: 'tap',
        payload: { x: 0, y: 0, elementId: '#submit-button' },
      })

      expect(mockPage.click).toHaveBeenCalledWith('#submit-button')
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - double_tap', () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it('double clicks at coordinates', async () => {
      const result = await driver.execute({
        type: 'double_tap',
        payload: { x: 100, y: 200 },
      })

      expect(mockPage.mouse.dblclick).toHaveBeenCalledWith(100, 200)
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - type', () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it('types text', async () => {
      const result = await driver.execute({
        type: 'type',
        payload: { text: 'hello world' },
      })

      expect(mockPage.keyboard.type).toHaveBeenCalledWith('hello world')
      expect(result).toEqual({ success: true })
    })

    it('fills element by selector', async () => {
      const result = await driver.execute({
        type: 'type',
        payload: { text: 'hello', elementId: '#input-field' },
      })

      expect(mockPage.fill).toHaveBeenCalledWith('#input-field', 'hello')
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - key', () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it('presses a key', async () => {
      const result = await driver.execute({
        type: 'key',
        payload: { key: 'Enter' },
      })

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter')
      expect(result).toEqual({ success: true })
    })

    it('handles key with modifiers', async () => {
      const result = await driver.execute({
        type: 'key',
        payload: { key: 'a', modifiers: ['ctrl'] },
      })

      expect(mockPage.keyboard.down).toHaveBeenCalledWith('Control')
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('a')
      expect(mockPage.keyboard.up).toHaveBeenCalledWith('Control')
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - scroll', () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it('scrolls by delta', async () => {
      const result = await driver.execute({
        type: 'scroll',
        payload: { deltaX: 0, deltaY: 100 },
      })

      expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 100)
      expect(result).toEqual({ success: true })
    })

    it('scrolls at position', async () => {
      const result = await driver.execute({
        type: 'scroll',
        payload: { deltaX: 0, deltaY: 100, x: 500, y: 500 },
      })

      expect(mockPage.mouse.move).toHaveBeenCalledWith(500, 500)
      expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 100)
      expect(result).toEqual({ success: true })
    })
  })

  describe('execute - screenshot', () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it('takes screenshot', async () => {
      const result = await driver.execute({
        type: 'screenshot',
        payload: {},
      })

      expect(mockPage.screenshot).toHaveBeenCalledWith({ type: 'png' })
      expect(result.success).toBe(true)
      if (result.success && result.data) {
        const data = result.data as { type: string; base64: string; format: string }
        expect(data.type).toBe('screenshot')
        expect(data.format).toBe('png')
        expect(data.base64).toBeDefined()
      }
    })
  })

  describe('execute - get_ui_tree', () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it('returns UI tree', async () => {
      const result = await driver.execute({
        type: 'get_ui_tree',
        payload: {},
      })

      expect(mockPage.evaluate).toHaveBeenCalled()
      expect(result.success).toBe(true)
    })
  })

  describe('navigate', () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it('navigates to URL', async () => {
      const result = await driver.navigate('https://example.com')

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', { waitUntil: 'domcontentloaded' })
      expect(result).toEqual({ success: true })
    })
  })

  describe('helper methods', () => {
    beforeEach(async () => {
      await driver.connect()
    })

    it('returns current URL', async () => {
      const url = await driver.getCurrentUrl()
      expect(url).toBe('https://example.com')
    })

    it('returns page title', async () => {
      const title = await driver.getTitle()
      expect(title).toBe('Example')
    })

    it('waits for selector', async () => {
      const result = await driver.waitForSelector('#element', 5000)

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#element', { timeout: 5000 })
      expect(result).toEqual({ success: true })
    })
  })

  describe('disconnect', () => {
    it('closes launched browser', async () => {
      const pw = await import('playwright')
      vi.mocked(pw.chromium.connectOverCDP).mockRejectedValueOnce(new Error('Connection refused'))

      const launchDriver = new WebDriver({ launchIfNotConnected: true })
      await launchDriver.connect()
      await launchDriver.disconnect()

      expect(mockBrowser.close).toHaveBeenCalled()
    })

    it('does not close connected session browser', async () => {
      await driver.connect()
      await driver.disconnect()

      expect(mockBrowser.close).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('returns error when not connected', async () => {
      const result = await driver.execute({
        type: 'tap',
        payload: { x: 100, y: 200 },
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Not connected')
    })

    it('returns not supported for drag action', async () => {
      await driver.connect()
      const result = await driver.execute({
        type: 'drag',
        payload: { fromX: 0, fromY: 0, toX: 100, toY: 100 },
      })

      expect(result).toEqual({ success: false, error: 'Drag not supported on web', code: 'NOT_SUPPORTED' })
    })
  })
})
