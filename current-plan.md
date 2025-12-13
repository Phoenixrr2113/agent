# Device Control Plan

## Overview

Unified device control system enabling an AI agent to control desktop, mobile (Android/iOS), and web platforms through a consistent protocol.

## Architecture

```
┌─────────────────┐     ┌────────────────────┐     ┌─────────────────────┐
│   Agent Core    │     │   Server Bridge    │     │   Device Drivers    │
│   (@agent/core) │────▶│   (@agent/server)  │◀───▶│   (Per Platform)    │
│                 │     │                    │     │                     │
│  - device_use   │     │  - DeviceRegistry  │     │  - DesktopDriver    │
│  - device_list  │     │  - WebSocket Hub   │     │  - AndroidDriver    │
│  - device_sel   │     │  - Action Router   │     │  - IOSDriver        │
└─────────────────┘     └────────────────────┘     │  - WebDriver        │
                                                   └─────────────────────┘
```

---

## Phase 1: Unified Device Action Protocol

### 1.1 Define Shared Types

**File:** `packages/shared/src/device/types.ts`

```typescript
export type DevicePlatform = 'desktop' | 'android' | 'ios' | 'web';

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
  | 'get_ui_tree';

export interface DeviceAction {
  type: DeviceActionType;
  payload: DeviceActionPayload;
}

export type DeviceActionPayload =
  | TapPayload
  | TypePayload
  | KeyPayload
  | SwipePayload
  | ScrollPayload
  | DragPayload
  | ScreenshotPayload
  | UITreePayload;

export interface TapPayload {
  x: number;
  y: number;
  elementId?: string;  // Alternative: tap by element
}

export interface TypePayload {
  text: string;
  elementId?: string;  // Optional: focus element first
}

export interface KeyPayload {
  key: string;
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
}

export interface SwipePayload {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  durationMs?: number;
}

export interface ScrollPayload {
  deltaX: number;
  deltaY: number;
  x?: number;  // Optional: scroll at position
  y?: number;
}

export interface DragPayload {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface ScreenshotPayload {
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface UITreePayload {
  depth?: number;
  includeInvisible?: boolean;
}
```

**File:** `packages/shared/src/device/capabilities.ts`

```typescript
export interface DeviceCapabilities {
  platform: DevicePlatform;
  deviceId: string;
  deviceName: string;
  screenSize: { width: number; height: number };
  supportedActions: DeviceActionType[];
  hasKeyboard: boolean;
  hasUITree: boolean;
}
```

**File:** `packages/shared/src/device/result.ts`

```typescript
export type ActionResult =
  | ActionSuccess
  | ActionError;

export interface ActionSuccess {
  success: true;
  data?: ScreenshotData | UITreeData | string;
}

export interface ActionError {
  success: false;
  error: string;
  code: 'NOT_SUPPORTED' | 'PERMISSION_DENIED' | 'ELEMENT_NOT_FOUND' | 'TIMEOUT' | 'UNKNOWN';
}

export interface ScreenshotData {
  type: 'screenshot';
  base64: string;
  format: 'png' | 'jpeg';
  width: number;
  height: number;
}

export interface UITreeData {
  type: 'ui_tree';
  root: UIElement;
}

export interface UIElement {
  id: string;
  type: 'button' | 'text' | 'input' | 'image' | 'container' | 'unknown';
  bounds: { x: number; y: number; width: number; height: number };
  text?: string;
  contentDescription?: string;
  clickable: boolean;
  focusable: boolean;
  enabled: boolean;
  visible: boolean;
  children: UIElement[];
}
```

### Tasks

- [ ] Create `packages/shared/src/device/types.ts` with DeviceAction types
- [ ] Create `packages/shared/src/device/capabilities.ts` with DeviceCapabilities
- [ ] Create `packages/shared/src/device/result.ts` with ActionResult types
- [ ] Create `packages/shared/src/device/index.ts` to export all device types
- [ ] Update `packages/shared/src/index.ts` to export device module
- [ ] Add Zod schemas for runtime validation in `packages/shared/src/device/schemas.ts`

---

### 1.2 Update DeviceDriver Interface

**File:** `packages/device-use/src/driver.ts`

```typescript
import type {
  DeviceAction,
  ActionResult,
  DeviceCapabilities,
  UIElement
} from '@agent/shared';

export interface DeviceDriver {
  // Core method - handles all actions
  execute(action: DeviceAction): Promise<ActionResult>;

  // Metadata
  getCapabilities(): Promise<DeviceCapabilities>;

  // Lifecycle
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;

  // Optional: UI tree for semantic targeting
  getUITree?(): Promise<UIElement>;
}
```

### Tasks

- [ ] Update `packages/device-use/src/driver.ts` with new interface
- [ ] Create `packages/device-use/src/driver-legacy.ts` with old interface (temporary)
- [ ] Create adapter pattern to wrap old interface for migration

---

### 1.3 Refactor DesktopDriver

**File:** `packages/device-use/src/drivers/desktop.ts`

Refactor to implement new `DeviceDriver` interface while maintaining existing NutJS implementation.

```typescript
import type { DeviceDriver, DeviceAction, ActionResult, DeviceCapabilities } from '@agent/shared';

export class DesktopDriver implements DeviceDriver {
  private platform: 'macos' | 'linux' | 'windows';

  async execute(action: DeviceAction): Promise<ActionResult> {
    switch (action.type) {
      case 'tap':
        return this.handleTap(action.payload as TapPayload);
      case 'type':
        return this.handleType(action.payload as TypePayload);
      // ... map all action types
    }
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    const screenSize = await this.getScreenSize();
    return {
      platform: 'desktop',
      deviceId: `desktop-${this.platform}`,
      deviceName: `${this.platform} Desktop`,
      screenSize,
      supportedActions: ['tap', 'double_tap', 'type', 'key', 'scroll', 'drag', 'screenshot'],
      hasKeyboard: true,
      hasUITree: false,
    };
  }
}
```

### Tasks

- [ ] Refactor `DesktopDriver` to implement new interface
- [ ] Map existing methods to `execute()` action handler
- [ ] Implement `getCapabilities()` method
- [ ] Update exports in `packages/device-use/src/index.ts`
- [ ] Write unit tests for new interface

---

## Phase 2: Android Accessibility Implementation

### 2.1 Complete AccessibilityService

**File:** `packages/mobile-accessibility/android/src/main/java/agent/accessibility/AgentAccessibilityService.kt`

Missing implementations:
- `type(text: String)` - Use `AccessibilityNodeInfo.ACTION_SET_TEXT` or InputConnection
- `pressKey(keyCode: Int)` - Use `performGlobalAction()` for system keys
- `screenshot()` - Use `takeScreenshot()` (API 30+) or MediaProjection
- `getUITree()` - Traverse `getRootInActiveWindow()`

```kotlin
class AgentAccessibilityService : AccessibilityService() {

  fun typeText(text: String): Boolean {
    val focused = findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
    focused?.let {
      val args = Bundle().apply {
        putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
      }
      return it.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }
    return false
  }

  @RequiresApi(Build.VERSION_CODES.R)
  fun takeScreenshotAsync(callback: (Bitmap?) -> Unit) {
    takeScreenshot(Display.DEFAULT_DISPLAY, executor, object : TakeScreenshotCallback {
      override fun onSuccess(result: ScreenshotResult) {
        callback(Bitmap.wrapHardwareBuffer(result.hardwareBuffer, result.colorSpace))
      }
      override fun onFailure(errorCode: Int) {
        callback(null)
      }
    })
  }

  fun getUITree(): UIElement {
    val root = rootInActiveWindow ?: throw IllegalStateException("No root window")
    return traverseNode(root)
  }

  private fun traverseNode(node: AccessibilityNodeInfo): UIElement {
    val rect = Rect()
    node.getBoundsInScreen(rect)
    return UIElement(
      id = node.viewIdResourceName ?: "",
      type = mapClassName(node.className),
      bounds = Bounds(rect.left, rect.top, rect.width(), rect.height()),
      text = node.text?.toString(),
      contentDescription = node.contentDescription?.toString(),
      clickable = node.isClickable,
      focusable = node.isFocusable,
      enabled = node.isEnabled,
      visible = node.isVisibleToUser,
      children = (0 until node.childCount).map { traverseNode(node.getChild(it)) }
    )
  }
}
```

### Tasks

- [ ] Implement `typeText()` in AgentAccessibilityService.kt
- [ ] Implement `pressKey()` for system keys (back, home, recents)
- [ ] Implement `screenshot()` using takeScreenshot API (Android 11+)
- [ ] Implement `getUITree()` with AccessibilityNodeInfo traversal
- [ ] Add fallback screenshot using MediaProjection for older APIs
- [ ] Expose new methods in AgentAccessibilityModule.kt
- [ ] Update TypeScript wrapper in `packages/mobile-accessibility/index.ts`

---

### 2.2 Create AndroidDriver

**File:** `packages/device-use/src/drivers/android.ts`

```typescript
import type { DeviceDriver, DeviceAction, ActionResult, DeviceCapabilities } from '@agent/shared';
import * as MobileAccessibility from '@agent/mobile-accessibility';

export class AndroidDriver implements DeviceDriver {
  async execute(action: DeviceAction): Promise<ActionResult> {
    if (!MobileAccessibility.isAccessibilityEnabled()) {
      return { success: false, error: 'Accessibility service not enabled', code: 'PERMISSION_DENIED' };
    }

    switch (action.type) {
      case 'tap':
        const { x, y } = action.payload as TapPayload;
        const success = await MobileAccessibility.click(x, y);
        return success ? { success: true } : { success: false, error: 'Tap failed', code: 'UNKNOWN' };

      case 'type':
        const { text } = action.payload as TypePayload;
        const typed = await MobileAccessibility.type(text);
        return typed ? { success: true } : { success: false, error: 'Type failed', code: 'UNKNOWN' };

      case 'screenshot':
        const base64 = await MobileAccessibility.screenshot();
        return { success: true, data: { type: 'screenshot', base64, format: 'png' } };

      // ... handle other actions
    }
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    return {
      platform: 'android',
      deviceId: await MobileAccessibility.getDeviceId(),
      deviceName: await MobileAccessibility.getDeviceName(),
      screenSize: await MobileAccessibility.getScreenSize(),
      supportedActions: ['tap', 'double_tap', 'long_press', 'type', 'swipe', 'scroll', 'screenshot', 'get_ui_tree'],
      hasKeyboard: true,
      hasUITree: true,
    };
  }
}
```

### Tasks

- [ ] Create `packages/device-use/src/drivers/android.ts`
- [ ] Implement all DeviceAction handlers
- [ ] Add device metadata methods to mobile-accessibility module
- [ ] Add conditional import pattern for React Native environment
- [ ] Write integration tests

---

### 2.3 Mobile App Command Bridge

**File:** `apps/mobile/src/components/AgentBridge.tsx`

```typescript
import { useEffect } from 'react';
import * as MobileAccessibility from '@agent/mobile-accessibility';
import type { DeviceAction, ActionResult } from '@agent/shared';

const WS_URL = process.env.EXPO_PUBLIC_AGENT_WS_URL || 'ws://localhost:3000';

export function AgentBridge() {
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      // Register device with capabilities
      const capabilities = {
        type: 'device:register',
        platform: 'android',
        deviceId: getDeviceId(),
        capabilities: getCapabilities(),
      };
      ws.send(JSON.stringify(capabilities));
    };

    ws.onmessage = async (event) => {
      const action: DeviceAction = JSON.parse(event.data);
      const result = await executeAction(action);
      ws.send(JSON.stringify({ type: 'action:result', result }));
    };

    return () => ws.close();
  }, []);

  return null; // Headless component
}

async function executeAction(action: DeviceAction): Promise<ActionResult> {
  switch (action.type) {
    case 'tap':
      return MobileAccessibility.click(action.payload.x, action.payload.y);
    case 'type':
      return MobileAccessibility.type(action.payload.text);
    case 'screenshot':
      return MobileAccessibility.screenshot();
    case 'get_ui_tree':
      return MobileAccessibility.getUITree();
    // ... all action types
  }
}
```

### Tasks

- [ ] Create `apps/mobile/src/components/AgentBridge.tsx`
- [ ] Implement WebSocket connection with reconnection logic
- [ ] Implement device registration on connect
- [ ] Implement action executor with all action types
- [ ] Add error handling and result reporting
- [ ] Add AgentBridge to app root layout

---

## Phase 3: Server Device Registry

### 3.1 Device Registry

**File:** `packages/server/src/devices/registry.ts`

```typescript
import type { DeviceCapabilities, DeviceAction, ActionResult } from '@agent/shared';
import type { WebSocket } from 'ws';

export interface ConnectedDevice {
  id: string;
  capabilities: DeviceCapabilities;
  socket: WebSocket;
  lastSeen: number;
  pendingActions: Map<string, {
    resolve: (result: ActionResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
}

export class DeviceRegistry {
  private devices = new Map<string, ConnectedDevice>();

  register(socket: WebSocket, capabilities: DeviceCapabilities): string {
    const device: ConnectedDevice = {
      id: capabilities.deviceId,
      capabilities,
      socket,
      lastSeen: Date.now(),
      pendingActions: new Map(),
    };
    this.devices.set(device.id, device);
    return device.id;
  }

  unregister(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      for (const [, pending] of device.pendingActions) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Device disconnected'));
      }
      this.devices.delete(deviceId);
    }
  }

  getDevice(deviceId: string): ConnectedDevice | undefined {
    return this.devices.get(deviceId);
  }

  listDevices(): DeviceCapabilities[] {
    return Array.from(this.devices.values()).map(d => d.capabilities);
  }

  async executeAction(deviceId: string, action: DeviceAction): Promise<ActionResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return { success: false, error: 'Device not found', code: 'NOT_FOUND' };
    }

    const actionId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        device.pendingActions.delete(actionId);
        reject(new Error('Action timeout'));
      }, 30000);

      device.pendingActions.set(actionId, { resolve, reject, timeout });
      device.socket.send(JSON.stringify({ actionId, action }));
    });
  }

  handleActionResult(deviceId: string, actionId: string, result: ActionResult): void {
    const device = this.devices.get(deviceId);
    const pending = device?.pendingActions.get(actionId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(result);
      device.pendingActions.delete(actionId);
    }
  }
}
```

### Tasks

- [ ] Create `packages/server/src/devices/registry.ts`
- [ ] Implement register/unregister with WebSocket lifecycle
- [ ] Implement pending action tracking with timeout
- [ ] Implement action execution with promise resolution
- [ ] Add heartbeat mechanism for device health
- [ ] Export from `packages/server/src/devices/index.ts`

---

### 3.2 Update Server WebSocket Handler

**File:** `packages/server/src/index.ts`

```typescript
import { DeviceRegistry } from './devices/registry.js';

const deviceRegistry = new DeviceRegistry();

// In createServer():
app.get('/devices', (c) => {
  return c.json({ devices: deviceRegistry.listDevices() });
});

app.post('/devices/:deviceId/action', async (c) => {
  const deviceId = c.req.param('deviceId');
  const action = await c.req.json<DeviceAction>();
  const result = await deviceRegistry.executeAction(deviceId, action);
  return c.json(result);
});

// In startServer():
wss.on('connection', (ws) => {
  let deviceId: string | null = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    if (data.type === 'device:register') {
      deviceId = deviceRegistry.register(ws, data.capabilities);
      logger.info('Device registered', { deviceId, platform: data.capabilities.platform });
    }

    if (data.type === 'action:result' && deviceId) {
      deviceRegistry.handleActionResult(deviceId, data.actionId, data.result);
    }
  });

  ws.on('close', () => {
    if (deviceId) {
      deviceRegistry.unregister(deviceId);
      logger.info('Device unregistered', { deviceId });
    }
  });
});
```

### Tasks

- [ ] Add DeviceRegistry to server
- [ ] Add `/devices` endpoint for listing connected devices
- [ ] Add `/devices/:deviceId/action` endpoint for executing actions
- [ ] Update WebSocket handler for device registration/action flow
- [ ] Add device disconnect cleanup
- [ ] Write integration tests for device registration flow

---

### 3.3 Desktop Direct Mode

For desktop, the driver runs locally (same process), no WebSocket needed.

**File:** `packages/server/src/devices/local-desktop.ts`

```typescript
import { DesktopDriver } from '@agent/device-use';
import type { ConnectedDevice } from './registry.js';

export function createLocalDesktopDevice(): ConnectedDevice {
  const driver = new DesktopDriver();

  return {
    id: 'local-desktop',
    capabilities: await driver.getCapabilities(),
    socket: null as any, // Not used for local
    lastSeen: Date.now(),
    pendingActions: new Map(),

    // Override execute for direct local calls
    async execute(action) {
      return driver.execute(action);
    }
  };
}
```

### Tasks

- [ ] Create `packages/server/src/devices/local-desktop.ts`
- [ ] Auto-register local desktop device on server start (optional)
- [ ] Make DeviceRegistry support local devices without WebSocket

---

## Phase 4: Agent Core Integration

### 4.1 Device Tools

**File:** `packages/core/src/tools/device/index.ts`

```typescript
import { z } from 'zod';
import type { ToolDependencies } from '../types.js';

const DeviceActionSchema = z.object({
  type: z.enum(['tap', 'double_tap', 'long_press', 'type', 'key', 'swipe', 'scroll', 'drag', 'screenshot', 'get_ui_tree']),
  payload: z.record(z.unknown()),
});

export function createDeviceTools(deps: ToolDependencies & { serverUrl: string }) {
  let currentDeviceId: string | null = null;

  return {
    list_devices: {
      description: 'List all connected devices (desktop, mobile, web)',
      parameters: z.object({}),
      async execute() {
        const response = await fetch(`${deps.serverUrl}/devices`);
        const { devices } = await response.json();
        return devices.map(d => `${d.deviceId} (${d.platform}): ${d.deviceName}`).join('\n');
      }
    },

    select_device: {
      description: 'Select a device to control',
      parameters: z.object({
        deviceId: z.string().describe('Device ID from list_devices'),
      }),
      async execute({ deviceId }) {
        currentDeviceId = deviceId;
        return `Selected device: ${deviceId}`;
      }
    },

    device_action: {
      description: 'Execute an action on the selected device',
      parameters: DeviceActionSchema,
      async execute(action) {
        if (!currentDeviceId) {
          return 'Error: No device selected. Use select_device first.';
        }
        const response = await fetch(`${deps.serverUrl}/devices/${currentDeviceId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action),
        });
        const result = await response.json();
        if (result.success) {
          if (result.data?.type === 'screenshot') {
            return { type: 'image', data: result.data.base64 };
          }
          return result.data || 'Action completed successfully';
        }
        return `Error: ${result.error}`;
      }
    },

    tap: {
      description: 'Tap at coordinates or on an element',
      parameters: z.object({
        x: z.number().optional(),
        y: z.number().optional(),
        elementId: z.string().optional(),
      }),
      async execute(params) {
        return this.device_action.execute({ type: 'tap', payload: params });
      }
    },

    type_text: {
      description: 'Type text on the device',
      parameters: z.object({
        text: z.string(),
      }),
      async execute({ text }) {
        return this.device_action.execute({ type: 'type', payload: { text } });
      }
    },

    screenshot: {
      description: 'Take a screenshot of the device',
      parameters: z.object({}),
      async execute() {
        return this.device_action.execute({ type: 'screenshot', payload: {} });
      }
    },
  };
}
```

### Tasks

- [ ] Create `packages/core/src/tools/device/index.ts`
- [ ] Implement `list_devices` tool
- [ ] Implement `select_device` tool
- [ ] Implement `device_action` generic tool
- [ ] Implement convenience tools: `tap`, `type_text`, `screenshot`, `swipe`
- [ ] Add device tools to ToolFactory registration
- [ ] Update ToolDependencies interface with serverUrl
- [ ] Write unit tests

---

### 4.2 Register Device Tools

**File:** `packages/core/src/application/initialization.ts`

Add device tools to deferred tools:

```typescript
import { createDeviceTools } from '../tools/device/index.js';

// In createInitialTools():
const deferredTools: DeferredToolsConfig = {
  // ... existing deferred tools
  device: {
    description: 'Control desktop, mobile, and web devices',
    category: 'device_control',
    create: () => createDeviceTools({
      serverUrl: process.env.AGENT_SERVER_URL || 'http://localhost:3000'
    }),
  },
};
```

### Tasks

- [ ] Add device tools to initialization.ts
- [ ] Add AGENT_SERVER_URL env variable handling
- [ ] Update tool activation to handle device tools

---

## Phase 5: iOS Support (Future)

### 5.1 iOS Accessibility

Unlike Android, iOS does not have a user-installable accessibility service. Options:

**Option A: XCUITest Bridge (Recommended for Development)**
- Run XCUITest server on Mac connected to device
- App communicates with XCUITest via HTTP
- Full accessibility tree access

**Option B: Private APIs (Jailbreak Only)**
- Use private accessibility APIs
- Not App Store compatible

**Option C: Limited expo-accessibility**
- VoiceOver integration only
- Very limited action support

### Tasks (Deferred)

- [ ] Research XCUITest server implementation
- [ ] Create iOS native module scaffolding
- [ ] Implement IOSDriver with XCUITest backend
- [ ] Add iOS-specific capability detection

---

## Phase 6: Web Driver (Future)

### 6.1 Playwright/Puppeteer Integration

**File:** `packages/device-use/src/drivers/web.ts`

```typescript
import { chromium, type Browser, type Page } from 'playwright';

export class WebDriver implements DeviceDriver {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async connect(options?: { headless?: boolean }) {
    this.browser = await chromium.launch({ headless: options?.headless ?? true });
    this.page = await this.browser.newPage();
  }

  async execute(action: DeviceAction): Promise<ActionResult> {
    if (!this.page) throw new Error('Not connected');

    switch (action.type) {
      case 'tap':
        await this.page.click(`[data-testid="${action.payload.elementId}"]`);
        return { success: true };
      case 'type':
        await this.page.fill('input:focus', action.payload.text);
        return { success: true };
      case 'screenshot':
        const buffer = await this.page.screenshot();
        return { success: true, data: { type: 'screenshot', base64: buffer.toString('base64') } };
    }
  }
}
```

### Tasks (Deferred)

- [ ] Add playwright as optional dependency
- [ ] Create WebDriver implementation
- [ ] Add URL navigation actions
- [ ] Add element selector support (CSS, XPath, text)
- [ ] Integrate with DeviceRegistry

---

## Testing Strategy

### Unit Tests

- [ ] `packages/shared/src/device/*.test.ts` - Type validation tests
- [ ] `packages/device-use/src/drivers/*.test.ts` - Driver unit tests
- [ ] `packages/server/src/devices/*.test.ts` - Registry tests
- [ ] `packages/core/src/tools/device/*.test.ts` - Tool tests

### Integration Tests

- [ ] Device registration flow (mock WebSocket)
- [ ] Action execution flow (end-to-end)
- [ ] Multi-device selection

### E2E Tests

- [ ] Desktop screenshot and tap
- [ ] Mobile app with accessibility service
- [ ] Web automation with Playwright

---

## Implementation Checklist

### Phase 1: Unified Protocol
- [ ] 1.1 Create shared device types
- [ ] 1.2 Update DeviceDriver interface
- [ ] 1.3 Refactor DesktopDriver

### Phase 2: Android
- [ ] 2.1 Complete AccessibilityService (type, key, screenshot, UI tree)
- [ ] 2.2 Create AndroidDriver
- [ ] 2.3 Create AgentBridge component

### Phase 3: Server
- [ ] 3.1 Create DeviceRegistry
- [ ] 3.2 Update server WebSocket handler
- [ ] 3.3 Add local desktop device support

### Phase 4: Agent Core
- [ ] 4.1 Create device tools
- [ ] 4.2 Register in initialization

### Phase 5: iOS (Deferred)
- [ ] 5.1 Research and prototype

### Phase 6: Web (Deferred)
- [ ] 6.1 Playwright integration

---

## File Structure Summary

```
packages/
├── shared/src/
│   └── device/
│       ├── types.ts          # DeviceAction, payloads
│       ├── capabilities.ts   # DeviceCapabilities
│       ├── result.ts         # ActionResult, UIElement
│       ├── schemas.ts        # Zod validation schemas
│       └── index.ts          # Exports
├── device-use/src/
│   ├── driver.ts             # Updated DeviceDriver interface
│   └── drivers/
│       ├── desktop.ts        # Refactored DesktopDriver
│       ├── android.ts        # New AndroidDriver
│       └── web.ts            # Future WebDriver
├── mobile-accessibility/
│   ├── index.ts              # Updated TypeScript wrapper
│   └── android/src/main/java/
│       ├── AgentAccessibilityModule.kt
│       └── AgentAccessibilityService.kt  # Complete implementation
├── server/src/
│   ├── devices/
│   │   ├── registry.ts       # DeviceRegistry
│   │   ├── local-desktop.ts  # Local desktop device
│   │   └── index.ts
│   └── index.ts              # Updated with device endpoints
├── core/src/
│   ├── tools/device/
│   │   └── index.ts          # Device tools
│   └── application/
│       └── initialization.ts # Updated with device tools
└── apps/mobile/src/
    └── components/
        └── AgentBridge.tsx   # WebSocket command bridge
```
