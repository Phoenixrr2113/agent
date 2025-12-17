import type {
  DeviceAction,
  ActionResult,
  DeviceCapabilities,
  TapPayload,
  TypePayload,
  KeyPayload,
  SwipePayload,
  ScrollPayload,
  ScreenshotData,
} from '@agent/shared'

import type { DeviceDriver } from '../driver.js'

let playwright: typeof import('playwright') | null = null

async function loadPlaywright() {
  if (!playwright) {
    try {
      playwright = await import('playwright')
    } catch {
      throw new Error('Playwright not installed. Run: pnpm add playwright')
    }
  }
  return playwright
}

export interface WebDriverOptions {
  headless?: boolean
  cdpPorts?: number[]
  userDataDir?: string
}

const DEFAULT_CDP_PORTS = [9222, 9223, 9224, 9225, 9226, 9227, 9228, 9229, 9230]

async function discoverChromeSession(ports: number[]): Promise<string | null> {
  for (const port of ports) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 500)
      const response = await fetch(`http://localhost:${port}/json/version`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (response.ok) {
        const data = await response.json()
        if (data.webSocketDebuggerUrl) {
          return `http://localhost:${port}`
        }
      }
    } catch {
      continue
    }
  }
  return null
}

type Browser = Awaited<ReturnType<typeof import('playwright').chromium.launch>>
type BrowserContext = Awaited<ReturnType<Browser['newContext']>>
type Page = Awaited<ReturnType<BrowserContext['newPage']>>

export class WebDriver implements DeviceDriver {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private options: WebDriverOptions
  private isConnectedSession = false
  private connectionMode: 'existing' | 'launched' | 'headless' = 'launched'

  constructor(options: WebDriverOptions = {}) {
    this.options = {
      headless: options.headless,
      cdpPorts: options.cdpPorts ?? DEFAULT_CDP_PORTS,
      userDataDir: options.userDataDir,
    }
  }

  async connect(): Promise<void> {
    const pw = await loadPlaywright()

    const cdpUrl = await discoverChromeSession(this.options.cdpPorts!)
    if (cdpUrl) {
      try {
        this.browser = await pw.chromium.connectOverCDP(cdpUrl)
        this.isConnectedSession = true
        this.connectionMode = 'existing'

        const contexts = this.browser.contexts()
        if (contexts.length > 0) {
          this.context = contexts[0]!
          const pages = this.context.pages()
          this.page = pages.length > 0 ? pages[0]! : await this.context.newPage()
        } else {
          this.context = await this.browser.newContext()
          this.page = await this.context.newPage()
        }
        return
      } catch {
      }
    }

    const headless = this.options.headless ?? false
    this.browser = await pw.chromium.launch({
      headless,
      args: headless ? [] : ['--start-maximized'],
    })
    this.context = await this.browser.newContext(
      headless ? {} : { viewport: null }
    )
    this.page = await this.context.newPage()
    this.isConnectedSession = false
    this.connectionMode = headless ? 'headless' : 'launched'
  }

  async disconnect(): Promise<void> {
    if (this.browser) {
      if (!this.isConnectedSession) {
        await this.browser.close()
      }
      this.browser = null
      this.context = null
      this.page = null
    }
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    const viewport = this.page?.viewportSize() ?? { width: 1920, height: 1080 }

    const modeNames = {
      existing: 'Chrome (User Session)',
      launched: 'Chrome (Launched)',
      headless: 'Chrome (Headless)',
    }

    return {
      platform: 'web',
      deviceId: 'web-browser',
      deviceName: modeNames[this.connectionMode],
      screenSize: { width: viewport.width, height: viewport.height },
      supportedActions: [
        'tap',
        'double_tap',
        'type',
        'key',
        'scroll',
        'screenshot',
        'get_ui_tree',
      ],
      hasKeyboard: true,
      hasUITree: true,
    }
  }

  async execute(action: DeviceAction): Promise<ActionResult> {
    if (!this.page) {
      return { success: false, error: 'Not connected. Call connect() first.', code: 'UNKNOWN' }
    }

    switch (action.type) {
      case 'tap':
        return this.handleTap(action.payload as TapPayload)
      case 'double_tap':
        return this.handleDoubleTap(action.payload as TapPayload)
      case 'type':
        return this.handleType(action.payload as TypePayload)
      case 'key':
        return this.handleKey(action.payload as KeyPayload)
      case 'swipe':
        return this.handleSwipe(action.payload as SwipePayload)
      case 'scroll':
        return this.handleScroll(action.payload as ScrollPayload)
      case 'screenshot':
        return this.handleScreenshot()
      case 'get_ui_tree':
        return this.handleGetUITree()
      case 'long_press':
        return this.handleLongPress(action.payload as TapPayload)
      case 'drag':
        return { success: false, error: 'Drag not supported on web', code: 'NOT_SUPPORTED' }
      default:
        return { success: false, error: `Unknown action: ${action.type}`, code: 'NOT_SUPPORTED' }
    }
  }

  private async handleTap(payload: TapPayload): Promise<ActionResult> {
    try {
      if (payload.elementId) {
        await this.page!.click(payload.elementId)
      } else {
        await this.page!.mouse.click(payload.x, payload.y)
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' }
    }
  }

  private async handleDoubleTap(payload: TapPayload): Promise<ActionResult> {
    try {
      if (payload.elementId) {
        await this.page!.dblclick(payload.elementId)
      } else {
        await this.page!.mouse.dblclick(payload.x, payload.y)
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' }
    }
  }

  private async handleLongPress(payload: TapPayload): Promise<ActionResult> {
    try {
      await this.page!.mouse.move(payload.x, payload.y)
      await this.page!.mouse.down()
      await new Promise((resolve) => setTimeout(resolve, 500))
      await this.page!.mouse.up()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' }
    }
  }

  private async handleType(payload: TypePayload): Promise<ActionResult> {
    try {
      if (payload.elementId) {
        await this.page!.fill(payload.elementId, payload.text)
      } else {
        await this.page!.keyboard.type(payload.text)
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' }
    }
  }

  private async handleKey(payload: KeyPayload): Promise<ActionResult> {
    try {
      const key = this.mapKey(payload.key)
      const modifiers = payload.modifiers ?? []

      for (const mod of modifiers) {
        await this.page!.keyboard.down(this.mapModifier(mod))
      }

      await this.page!.keyboard.press(key)

      for (const mod of modifiers.reverse()) {
        await this.page!.keyboard.up(this.mapModifier(mod))
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' }
    }
  }

  private async handleSwipe(payload: SwipePayload): Promise<ActionResult> {
    try {
      const steps = 10
      const duration = payload.durationMs ?? 300
      const stepDelay = duration / steps

      await this.page!.mouse.move(payload.fromX, payload.fromY)
      await this.page!.mouse.down()

      for (let i = 1; i <= steps; i++) {
        const progress = i / steps
        const x = payload.fromX + (payload.toX - payload.fromX) * progress
        const y = payload.fromY + (payload.toY - payload.fromY) * progress
        await this.page!.mouse.move(x, y)
        await new Promise((resolve) => setTimeout(resolve, stepDelay))
      }

      await this.page!.mouse.up()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' }
    }
  }

  private async handleScroll(payload: ScrollPayload): Promise<ActionResult> {
    try {
      if (payload.x !== undefined && payload.y !== undefined) {
        await this.page!.mouse.move(payload.x, payload.y)
      }
      await this.page!.mouse.wheel(payload.deltaX, payload.deltaY)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' }
    }
  }

  private async handleScreenshot(): Promise<ActionResult> {
    try {
      const buffer = await this.page!.screenshot({ type: 'png' })
      const viewport = this.page!.viewportSize() ?? { width: 1920, height: 1080 }

      const data: ScreenshotData = {
        type: 'screenshot',
        base64: buffer.toString('base64'),
        format: 'png',
        width: viewport.width,
        height: viewport.height,
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' }
    }
  }

  private async handleGetUITree(): Promise<ActionResult> {
    try {
      const tree = await this.page!.evaluate(() => {
        function buildTree(element: Element): object {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)

          return {
            id: element.id || undefined,
            type: element.tagName.toLowerCase(),
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            text: element.textContent?.trim().slice(0, 100) || undefined,
            attributes: {
              class: element.className || undefined,
              href: (element as HTMLAnchorElement).href || undefined,
              src: (element as HTMLImageElement).src || undefined,
              placeholder: (element as HTMLInputElement).placeholder || undefined,
              value: (element as HTMLInputElement).value || undefined,
            },
            clickable:
              element.tagName === 'BUTTON' ||
              element.tagName === 'A' ||
              style.cursor === 'pointer',
            focusable: element.hasAttribute('tabindex') || ['INPUT', 'BUTTON', 'A', 'TEXTAREA', 'SELECT'].includes(element.tagName),
            enabled: !(element as HTMLButtonElement).disabled,
            visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0,
            children: Array.from(element.children)
              .filter((child) => {
                const childStyle = window.getComputedStyle(child)
                const childRect = child.getBoundingClientRect()
                return (
                  childStyle.display !== 'none' &&
                  childRect.width > 0 &&
                  childRect.height > 0
                )
              })
              .slice(0, 50)
              .map((child) => buildTree(child)),
          }
        }

        return buildTree(document.body)
      })

      return {
        success: true,
        data: {
          type: 'ui_tree',
          root: tree,
        },
      }
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' }
    }
  }

  private mapKey(key: string): string {
    const keyMap: Record<string, string> = {
      enter: 'Enter',
      return: 'Enter',
      tab: 'Tab',
      space: 'Space',
      escape: 'Escape',
      esc: 'Escape',
      backspace: 'Backspace',
      delete: 'Delete',
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      home: 'Home',
      end: 'End',
      pageup: 'PageUp',
      pagedown: 'PageDown',
    }
    return keyMap[key.toLowerCase()] ?? key
  }

  private mapModifier(mod: string): string {
    const modMap: Record<string, string> = {
      ctrl: 'Control',
      control: 'Control',
      alt: 'Alt',
      shift: 'Shift',
      meta: 'Meta',
      cmd: 'Meta',
      command: 'Meta',
    }
    return modMap[mod.toLowerCase()] ?? mod
  }

  async navigate(url: string): Promise<ActionResult> {
    if (!this.page) {
      return { success: false, error: 'Not connected', code: 'UNKNOWN' }
    }
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error), code: 'UNKNOWN' }
    }
  }

  async getCurrentUrl(): Promise<string | null> {
    return this.page?.url() ?? null
  }

  async getTitle(): Promise<string | null> {
    return this.page?.title() ?? null
  }

  async waitForSelector(selector: string, timeout = 5000): Promise<ActionResult> {
    if (!this.page) {
      return { success: false, error: 'Not connected', code: 'UNKNOWN' }
    }
    try {
      await this.page.waitForSelector(selector, { timeout })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error), code: 'TIMEOUT' }
    }
  }

  getPage(): Page | null {
    return this.page
  }

  isConnected(): boolean {
    return this.browser !== null && this.page !== null
  }

  isUsingExistingSession(): boolean {
    return this.isConnectedSession
  }

  getConnectionMode(): 'existing' | 'launched' | 'headless' {
    return this.connectionMode
  }
}

export { discoverChromeSession }
