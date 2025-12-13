import * as AgentAccessibility from '@agent/mobile-accessibility'

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
  UIElement,
} from '@agent/shared'

import type { DeviceDriver } from '../driver.js'

export class AndroidDriver implements DeviceDriver {
  private screenSize: { width: number; height: number } = { width: 1080, height: 1920 }

  setScreenSize(width: number, height: number): void {
    this.screenSize = { width, height }
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
        return this.handleGetUITree()
      default:
        return { success: false, error: `Unknown action type: ${action.type}`, code: 'NOT_SUPPORTED' }
    }
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    return {
      platform: 'android',
      deviceId: 'android-device',
      deviceName: 'Android Device',
      screenSize: this.screenSize,
      supportedActions: [
        'tap',
        'double_tap',
        'long_press',
        'type',
        'key',
        'swipe',
        'scroll',
        'drag',
        'screenshot',
        'get_ui_tree',
      ],
      hasKeyboard: true,
      hasUITree: true,
    }
  }

  async getUITree(): Promise<UIElement> {
    const treeJson = await AgentAccessibility.getUITree()
    if (!treeJson) {
      throw new Error('UI tree not available')
    }
    return JSON.parse(treeJson) as UIElement
  }

  private async handleTap(payload: TapPayload): Promise<ActionResult> {
    const success = await AgentAccessibility.click(payload.x, payload.y)
    return success ? { success: true } : { success: false, error: 'Tap failed', code: 'UNKNOWN' }
  }

  private async handleDoubleTap(payload: TapPayload): Promise<ActionResult> {
    await AgentAccessibility.click(payload.x, payload.y)
    await AgentAccessibility.click(payload.x, payload.y)
    return { success: true }
  }

  private async handleLongPress(payload: TapPayload): Promise<ActionResult> {
    const success = await AgentAccessibility.longPress(payload.x, payload.y, 500)
    return success
      ? { success: true }
      : { success: false, error: 'Long press failed', code: 'UNKNOWN' }
  }

  private async handleType(payload: TypePayload): Promise<ActionResult> {
    const success = await AgentAccessibility.type(payload.text)
    return success ? { success: true } : { success: false, error: 'Type failed', code: 'UNKNOWN' }
  }

  private async handleKey(payload: KeyPayload): Promise<ActionResult> {
    const success = await AgentAccessibility.pressKey(payload.key)
    return success ? { success: true } : { success: false, error: 'Key press failed', code: 'UNKNOWN' }
  }

  private async handleSwipe(payload: SwipePayload): Promise<ActionResult> {
    const duration = payload.durationMs ?? 300
    const success = await AgentAccessibility.swipe(
      payload.fromX,
      payload.fromY,
      payload.toX,
      payload.toY,
      duration
    )
    return success ? { success: true } : { success: false, error: 'Swipe failed', code: 'UNKNOWN' }
  }

  private async handleScroll(payload: ScrollPayload): Promise<ActionResult> {
    const { width, height } = this.screenSize
    const cx = payload.x ?? width / 2
    const cy = payload.y ?? height / 2
    const toY = cy - payload.deltaY
    const toX = cx - payload.deltaX
    await AgentAccessibility.swipe(cx, cy, toX, toY, 300)
    return { success: true }
  }

  private async handleDrag(payload: DragPayload): Promise<ActionResult> {
    await AgentAccessibility.swipe(payload.fromX, payload.fromY, payload.toX, payload.toY, 500)
    return { success: true }
  }

  private async handleScreenshot(): Promise<ActionResult> {
    const base64 = await AgentAccessibility.screenshot()
    if (!base64) {
      return { success: false, error: 'Screenshot failed', code: 'UNKNOWN' }
    }
    return {
      success: true,
      data: {
        type: 'screenshot',
        base64,
        format: 'png',
        width: this.screenSize.width,
        height: this.screenSize.height,
      },
    }
  }

  private async handleGetUITree(): Promise<ActionResult> {
    const treeJson = await AgentAccessibility.getUITree()
    if (!treeJson) {
      return { success: false, error: 'UI tree failed', code: 'UNKNOWN' }
    }
    return {
      success: true,
      data: {
        type: 'ui_tree',
        root: JSON.parse(treeJson) as UIElement,
      },
    }
  }
}



