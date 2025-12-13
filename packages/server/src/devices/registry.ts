import type { WebSocket } from 'ws'

import type { DeviceCapabilities, DeviceAction, ActionResult } from '@agent/shared'

export interface ConnectedDevice {
  id: string
  capabilities: DeviceCapabilities
  socket: WebSocket
  lastSeen: number
  pendingActions: Map<
    string,
    {
      resolve: (result: ActionResult) => void
      reject: (error: Error) => void
      timeout: NodeJS.Timeout
    }
  >
}

const ACTION_TIMEOUT_MS = 30_000

export class DeviceRegistry {
  private devices = new Map<string, ConnectedDevice>()

  register(socket: WebSocket, capabilities: DeviceCapabilities): string {
    const device: ConnectedDevice = {
      id: capabilities.deviceId,
      capabilities,
      socket,
      lastSeen: Date.now(),
      pendingActions: new Map(),
    }
    this.devices.set(device.id, device)
    return device.id
  }

  unregister(deviceId: string): void {
    const device = this.devices.get(deviceId)
    if (device) {
      for (const [, pending] of device.pendingActions) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('Device disconnected'))
      }
      this.devices.delete(deviceId)
    }
  }

  getDevice(deviceId: string): ConnectedDevice | undefined {
    return this.devices.get(deviceId)
  }

  listDevices(): DeviceCapabilities[] {
    return [...this.devices.values()].map((d) => d.capabilities)
  }

  async executeAction(deviceId: string, action: DeviceAction): Promise<ActionResult> {
    const device = this.devices.get(deviceId)
    if (!device) {
      return { success: false, error: 'Device not found', code: 'NOT_FOUND' }
    }

    const actionId = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        device.pendingActions.delete(actionId)
        reject(new Error('Action timeout'))
      }, ACTION_TIMEOUT_MS)

      device.pendingActions.set(actionId, { resolve, reject, timeout })
      device.socket.send(JSON.stringify({ actionId, action }))
    })
  }

  handleActionResult(deviceId: string, actionId: string, result: ActionResult): void {
    const device = this.devices.get(deviceId)
    const pending = device?.pendingActions.get(actionId)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve(result)
      device?.pendingActions.delete(actionId)
    }
  }

  updateLastSeen(deviceId: string): void {
    const device = this.devices.get(deviceId)
    if (device) {
      device.lastSeen = Date.now()
    }
  }
}
