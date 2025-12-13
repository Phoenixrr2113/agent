import type {
  DeviceAction,
  ActionResult,
  DeviceCapabilities,
  UIElement,
} from '@agent/shared'

export interface DeviceDriver {
  execute(action: DeviceAction): Promise<ActionResult>
  getCapabilities(): Promise<DeviceCapabilities>
  connect?(): Promise<void>
  disconnect?(): Promise<void>
  getUITree?(): Promise<UIElement>
}

