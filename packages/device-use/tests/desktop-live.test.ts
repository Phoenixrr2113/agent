import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { DesktopDriver } from '../src/drivers/desktop.js'

const SKIP_LIVE_TESTS = process.env['SKIP_LIVE_TESTS'] === 'true' || process.env['CI'] === 'true'

describe.skipIf(SKIP_LIVE_TESTS)('Desktop Driver Live Tests', () => {
  let driver: DesktopDriver

  beforeAll(() => {
    driver = new DesktopDriver()
  })

  describe('getCapabilities', () => {
    it('returns desktop capabilities with screen size', async () => {
      const capabilities = await driver.getCapabilities()

      expect(capabilities.platform).toBe('desktop')
      expect(capabilities.deviceId).toMatch(/^desktop-/)
      expect(capabilities.deviceName).toBeDefined()
      expect(capabilities.screenSize.width).toBeGreaterThan(0)
      expect(capabilities.screenSize.height).toBeGreaterThan(0)
      expect(capabilities.supportedActions).toContain('tap')
      expect(capabilities.supportedActions).toContain('screenshot')
      expect(capabilities.hasKeyboard).toBe(true)
    })
  })

  describe('screenshot', () => {
    it('captures screen and returns base64 image', async () => {
      const result = await driver.execute({
        type: 'screenshot',
        payload: {},
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        
        const data = result.data as { type: string; base64: string; width: number; height: number }
        expect(data.type).toBe('screenshot')
        expect(data.base64).toBeDefined()
        expect(data.base64.length).toBeGreaterThan(0)
        expect(data.width).toBeGreaterThan(0)
        expect(data.height).toBeGreaterThan(0)
      }
    })
  })

  describe('mouse actions (mock safe zone)', () => {
    it('can move mouse to safe coordinates', async () => {
      const capabilities = await driver.getCapabilities()
      const safeX = Math.min(100, capabilities.screenSize.width - 100)
      const safeY = Math.min(100, capabilities.screenSize.height - 100)

      const result = await driver.execute({
        type: 'tap',
        payload: { x: safeX, y: safeY },
      })

      expect(result.success).toBe(true)
    })

    it('can perform double tap', async () => {
      const capabilities = await driver.getCapabilities()
      const safeX = Math.min(50, capabilities.screenSize.width - 50)
      const safeY = Math.min(50, capabilities.screenSize.height - 50)

      const result = await driver.execute({
        type: 'double_tap',
        payload: { x: safeX, y: safeY },
      })

      expect(result.success).toBe(true)
    })
  })

  describe('keyboard actions', () => {
    it('can send key press events', async () => {
      const result = await driver.execute({
        type: 'key',
        payload: { key: 'Escape' },
      })

      expect(result.success).toBe(true)
    })
  })

  describe('scroll actions', () => {
    it('can perform scroll up', async () => {
      const result = await driver.execute({
        type: 'scroll',
        payload: { direction: 'up', amount: 50 },
      })

      expect(result.success).toBe(true)
    })

    it('can perform scroll down', async () => {
      const result = await driver.execute({
        type: 'scroll',
        payload: { direction: 'down', amount: 50 },
      })

      expect(result.success).toBe(true)
    })
  })
})

describe('Desktop Driver Unit Tests', () => {
  it('creates driver instance', () => {
    const driver = new DesktopDriver()
    expect(driver).toBeDefined()
  })
})
