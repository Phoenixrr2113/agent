export type DevicePlatform = 'desktop' | 'android' | 'ios' | 'web'

export type DeviceActionType =
  | 'tap'
  | 'double_tap'
  | 'long_press'
  | 'type'
  | 'key'
  | 'swipe'
  | 'scroll'
  | 'drag'
  | 'screenshot'
  | 'get_ui_tree'

export interface DeviceAction {
  type: DeviceActionType
  payload: DeviceActionPayload
}

export type DeviceActionPayload =
  | TapPayload
  | TypePayload
  | KeyPayload
  | SwipePayload
  | ScrollPayload
  | DragPayload
  | ScreenshotPayload
  | UITreePayload

export interface TapPayload {
  x: number
  y: number
  elementId?: string
}

export interface TypePayload {
  text: string
  elementId?: string
}

export interface KeyPayload {
  key: string
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[]
}

export interface SwipePayload {
  fromX: number
  fromY: number
  toX: number
  toY: number
  durationMs?: number
}

export interface ScrollPayload {
  deltaX: number
  deltaY: number
  x?: number
  y?: number
}

export interface DragPayload {
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export interface ScreenshotPayload {
  format?: 'png' | 'jpeg'
  quality?: number
}

export interface UITreePayload {
  depth?: number
  includeInvisible?: boolean
}
