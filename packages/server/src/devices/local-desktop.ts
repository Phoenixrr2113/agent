import type { DeviceAction, ActionResult, DeviceCapabilities } from '@agent/shared'

import type { LocalDevice } from './registry.js'

export interface LocalDeviceDriver {
  execute(action: DeviceAction): Promise<ActionResult>
  getCapabilities(): Promise<DeviceCapabilities>
}

export async function createLocalDesktopDevice(driver: LocalDeviceDriver): Promise<LocalDevice> {
  const capabilities = await driver.getCapabilities()

  const device: LocalDevice = {
    id: 'local-desktop',
    capabilities,
    socket: null,
    lastSeen: Date.now(),
    pendingActions: new Map(),

    async executeLocal(action: DeviceAction): Promise<ActionResult> {
      return driver.execute(action)
    },
  }

  return device
}
