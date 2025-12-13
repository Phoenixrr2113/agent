import { mouse, keyboard, screen, Button, Key, Point } from '@nut-tree-fork/nut-js'

import type {
  DeviceAction,
  ActionResult,
  DeviceCapabilities,
  TapPayload,
  TypePayload,
  KeyPayload,
  SwipePayload,
  ScrollPayload,
  DragPayload,
} from '@agent/shared'

import type { DeviceDriver } from '../driver.js'

export class DesktopDriver implements DeviceDriver {
  private platform: 'macos' | 'linux' | 'windows'

  constructor() {
    this.platform = this.detectPlatform()
  }

  private detectPlatform(): 'macos' | 'linux' | 'windows' {
    const p = process.platform
    if (p === 'darwin') return 'macos'
    if (p === 'win32') return 'windows'
    return 'linux'
  }

  async execute(action: DeviceAction): Promise<ActionResult> {
    switch (action.type) {
      case 'tap':
        return this.handleTap(action.payload as TapPayload)
      case 'double_tap':
        return this.handleDoubleTap(action.payload as TapPayload)
      case 'long_press':
        return this.handleLongPress(action.payload as TapPayload)
      case 'type':
        return this.handleType(action.payload as TypePayload)
      case 'key':
        return this.handleKey(action.payload as KeyPayload)
      case 'swipe':
        return this.handleSwipe(action.payload as SwipePayload)
      case 'scroll':
        return this.handleScroll(action.payload as ScrollPayload)
      case 'drag':
        return this.handleDrag(action.payload as DragPayload)
      case 'screenshot':
        return this.handleScreenshot()
      case 'get_ui_tree':
        return { success: false, error: 'UI tree not supported on desktop', code: 'NOT_SUPPORTED' }
      default:
        return { success: false, error: `Unknown action type: ${action.type}`, code: 'NOT_SUPPORTED' }
    }
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    const screenSize = await this.getScreenSize()
    return {
      platform: 'desktop',
      deviceId: `desktop-${this.platform}`,
      deviceName: `${this.platform.charAt(0).toUpperCase()}${this.platform.slice(1)} Desktop`,
      screenSize,
      supportedActions: ['tap', 'double_tap', 'type', 'key', 'scroll', 'drag', 'screenshot'],
      hasKeyboard: true,
      hasUITree: false,
    }
  }

  private async handleTap(payload: TapPayload): Promise<ActionResult> {
    await mouse.setPosition(new Point(payload.x, payload.y))
    await mouse.click(Button.LEFT)
    return { success: true }
  }

  private async handleDoubleTap(payload: TapPayload): Promise<ActionResult> {
    await mouse.setPosition(new Point(payload.x, payload.y))
    await mouse.doubleClick(Button.LEFT)
    return { success: true }
  }

  private async handleLongPress(payload: TapPayload): Promise<ActionResult> {
    await mouse.setPosition(new Point(payload.x, payload.y))
    await mouse.pressButton(Button.LEFT)
    await new Promise((resolve) => setTimeout(resolve, 500))
    await mouse.releaseButton(Button.LEFT)
    return { success: true }
  }

  private async handleType(payload: TypePayload): Promise<ActionResult> {
    await keyboard.type(payload.text)
    return { success: true }
  }

  private async handleKey(payload: KeyPayload): Promise<ActionResult> {
    const keys: Key[] = []

    if (payload.modifiers) {
      for (const mod of payload.modifiers) {
        switch (mod) {
          case 'ctrl':
            keys.push(Key.LeftControl)
            break
          case 'alt':
            keys.push(Key.LeftAlt)
            break
          case 'shift':
            keys.push(Key.LeftShift)
            break
          case 'meta':
            keys.push(Key.LeftSuper)
            break
        }
      }
    }

    keys.push(this.mapKeyToNutJS(payload.key))

    for (const k of keys) {
      await keyboard.pressKey(k)
    }
    for (const k of keys.reverse()) {
      await keyboard.releaseKey(k)
    }

    return { success: true }
  }

  private async handleSwipe(payload: SwipePayload): Promise<ActionResult> {
    await mouse.setPosition(new Point(payload.fromX, payload.fromY))
    await mouse.pressButton(Button.LEFT)
    await mouse.setPosition(new Point(payload.toX, payload.toY))
    await mouse.releaseButton(Button.LEFT)
    return { success: true }
  }

  private async handleScroll(payload: ScrollPayload): Promise<ActionResult> {
    if (payload.x !== undefined && payload.y !== undefined) {
      await mouse.setPosition(new Point(payload.x, payload.y))
    }

    if (payload.deltaY > 0) {
      await mouse.scrollDown(Math.abs(payload.deltaY))
    } else if (payload.deltaY < 0) {
      await mouse.scrollUp(Math.abs(payload.deltaY))
    }

    if (payload.deltaX > 0) {
      await mouse.scrollRight(Math.abs(payload.deltaX))
    } else if (payload.deltaX < 0) {
      await mouse.scrollLeft(Math.abs(payload.deltaX))
    }

    return { success: true }
  }

  private async handleDrag(payload: DragPayload): Promise<ActionResult> {
    await mouse.setPosition(new Point(payload.fromX, payload.fromY))
    await mouse.drag([new Point(payload.toX, payload.toY)])
    return { success: true }
  }

  private async handleScreenshot(): Promise<ActionResult> {
    const image = await screen.grab()
    const base64 = (image as { data: Buffer }).data.toString('base64')
    const { width, height } = await this.getScreenSize()
    return {
      success: true,
      data: {
        type: 'screenshot',
        base64,
        format: 'png',
        width,
        height,
      },
    }
  }

  private async getScreenSize(): Promise<{ width: number; height: number }> {
    const width = await screen.width()
    const height = await screen.height()
    return { width, height }
  }

  private mapKeyToNutJS(key: string): Key {
    const keyMap: Record<string, Key> = {
      Return: Key.Return,
      Enter: Key.Return,
      Tab: Key.Tab,
      Space: Key.Space,
      Escape: Key.Escape,
      Esc: Key.Escape,
      Delete: Key.Delete,
      Backspace: Key.Backspace,
      Up: Key.Up,
      Down: Key.Down,
      Left: Key.Left,
      Right: Key.Right,
      Home: Key.Home,
      End: Key.End,
      PageUp: Key.PageUp,
      PageDown: Key.PageDown,
      F1: Key.F1,
      F2: Key.F2,
      F3: Key.F3,
      F4: Key.F4,
      F5: Key.F5,
      F6: Key.F6,
      F7: Key.F7,
      F8: Key.F8,
      F9: Key.F9,
      F10: Key.F10,
      F11: Key.F11,
      F12: Key.F12,
      LeftAlt: Key.LeftAlt,
      RightAlt: Key.RightAlt,
      LeftControl: Key.LeftControl,
      LeftCtrl: Key.LeftControl,
      RightControl: Key.RightControl,
      RightCtrl: Key.RightControl,
      LeftShift: Key.LeftShift,
      RightShift: Key.RightShift,
      LeftSuper: Key.LeftSuper,
      LeftCmd: Key.LeftSuper,
      LeftWin: Key.LeftSuper,
      RightSuper: Key.RightSuper,
      RightCmd: Key.RightSuper,
      RightWin: Key.RightSuper,
    }

    return keyMap[key] || (Key[key as keyof typeof Key] as Key) || (key as unknown as Key)
  }
}

