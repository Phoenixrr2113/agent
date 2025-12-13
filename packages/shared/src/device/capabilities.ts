import type { DeviceActionType, DevicePlatform } from './types.js'

export interface DeviceCapabilities {
  platform: DevicePlatform
  deviceId: string
  deviceName: string
  screenSize: { width: number; height: number }
  supportedActions: DeviceActionType[]
  hasKeyboard: boolean
  hasUITree: boolean
}
