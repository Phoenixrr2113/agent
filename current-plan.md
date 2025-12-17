# Device Control System

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
│  - device_sel   │     │  - Action Router   │     │  - WebDriver        │
└─────────────────┘     └────────────────────┘     │  - IOSDriver        │
                                                   └─────────────────────┘
```

---

## Implementation Status

### Phase 1: Unified Device Action Protocol ✅ COMPLETE

| Component | File | Status |
|-----------|------|--------|
| Device types | `packages/shared/src/device/types.ts` | ✅ |
| Capabilities | `packages/shared/src/device/capabilities.ts` | ✅ |
| Results | `packages/shared/src/device/result.ts` | ✅ |
| Zod schemas | `packages/shared/src/device/schemas.ts` | ✅ |
| DeviceDriver interface | `packages/device-use/src/driver.ts` | ✅ |
| DesktopDriver | `packages/device-use/src/drivers/desktop.ts` | ✅ |

**Supported Actions:** tap, double_tap, long_press, type, key, swipe, scroll, drag, screenshot, get_ui_tree

---

### Phase 2: Android Accessibility ✅ COMPLETE

| Component | File | Status |
|-----------|------|--------|
| AccessibilityService | `packages/mobile-accessibility/android/.../AgentAccessibilityService.kt` | ✅ |
| Native Module | `packages/mobile-accessibility/android/.../AgentAccessibilityModule.kt` | ✅ |
| TypeScript wrapper | `packages/mobile-accessibility/index.ts` | ✅ |
| AndroidDriver | `packages/device-use/src/drivers/android.ts` | ✅ |
| AgentBridge | `apps/mobile/components/agent-bridge.tsx` | ✅ |

**Features:**
- Full accessibility service with typeText, pressKey, screenshot (API 30+), getUITree
- WebSocket bridge with device:register protocol
- Auto-reconnect on disconnect
- All 10 action types supported

---

### Phase 3: Server Device Registry ✅ COMPLETE

| Component | File | Status |
|-----------|------|--------|
| DeviceRegistry | `packages/server/src/devices/registry.ts` | ✅ |
| LocalDevice support | `packages/server/src/devices/local-desktop.ts` | ✅ |
| REST endpoints | `packages/server/src/index.ts` | ✅ |
| WebSocket handler | `packages/server/src/index.ts` | ✅ |
| Auto-register local desktop | `packages/server/src/index.ts` | ✅ |

**API Endpoints:**
- `GET /devices` - List connected devices
- `POST /devices/:deviceId/action` - Execute action on device

**Features:**
- Remote device support via WebSocket
- Local device support for same-process execution
- Auto-register local desktop on server start (`ENABLE_LOCAL_DESKTOP=true`)
- Pending action tracking with 30s timeout
- Device disconnect cleanup

---

### Phase 4: Agent Core Integration ✅ COMPLETE

| Component | File | Status |
|-----------|------|--------|
| Device tools | `packages/core/src/tools/device/index.ts` | ✅ |
| Tool registration | `packages/core/src/application/initialization.ts` | ✅ |

**Available Tools:**
- `list_devices` - List all connected devices
- `select_device` - Select a device to control
- `device_action` - Execute any action
- `tap` - Tap at coordinates
- `type_text` - Type text
- `device_screenshot` - Take screenshot
- `swipe` - Swipe gesture

---

### Phase 5: iOS Support 🔮 FUTURE

**Options:**
1. **XCUITest Bridge** (Recommended) - Run XCUITest server on Mac, full accessibility tree
2. **Private APIs** - Jailbreak only, not App Store compatible
3. **Limited expo-accessibility** - VoiceOver integration only

**Tasks:**
- [ ] Research XCUITest server implementation
- [ ] Create iOS native module scaffolding
- [ ] Implement IOSDriver with XCUITest backend
- [ ] Add iOS-specific capability detection

---

### Phase 6: Web Driver ✅ COMPLETE

| Component | File | Status |
|-----------|------|--------|
| WebDriver | `packages/device-use/src/drivers/web.ts` | ✅ |
| Playwright (optional) | `packages/device-use/package.json` | ✅ |
| CDP connection | `WebDriver.connect()` | ✅ |
| Fallback launch | `launchIfNotConnected` option | ✅ |

**Features:**
- **Connect to existing browser session** via Chrome DevTools Protocol (CDP)
- Falls back to launching new browser if not connected
- Supports all standard actions: tap, type, scroll, screenshot, get_ui_tree
- Element selector support (CSS selectors)
- Navigation helpers: `navigate()`, `getCurrentUrl()`, `getTitle()`, `waitForSelector()`

**Usage:**
```typescript
import { WebDriver } from '@agent/device-use'

// Connect to user's Chrome (must be launched with --remote-debugging-port=9222)
const driver = new WebDriver({ cdpUrl: 'http://localhost:9222' })
await driver.connect()

// Or launch new browser if not connected
const driver = new WebDriver({ launchIfNotConnected: true, headless: false })
await driver.connect()

// Navigate and interact
await driver.navigate('https://example.com')
await driver.execute({ type: 'tap', payload: { elementId: '#login-button' } })
await driver.execute({ type: 'type', payload: { text: 'hello', elementId: '#input' } })
```

**To use existing browser session:**
```bash
# Launch Chrome with debugging port
google-chrome --remote-debugging-port=9222

# Or on macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

---

## Test Coverage

### Unit Tests ✅

| Suite | Tests | Location |
|-------|-------|----------|
| Device tools | 17 | `packages/core/src/tools/device/device-tools.test.ts` |
| Device registry | 15 | `packages/server/src/devices/registry.test.ts` |
| Integration | 10 | `packages/server/src/devices/integration.test.ts` |
| Desktop driver | 17 | `packages/device-use/tests/desktop-driver.test.ts` |
| Android driver | 24 | `packages/device-use/tests/android-driver.test.ts` |
| Web driver | 23 | `packages/device-use/tests/web-driver.test.ts` |
| Safety validator | 11 | `packages/device-use/tests/safety.test.ts` |

**Total: 117 tests**

### Integration Tests ✅

| Test | Status |
|------|--------|
| Multi-device selection | ✅ |
| Local desktop mode | ✅ |
| Device lifecycle | ✅ |
| Action flow | ✅ |

### E2E Tests

- [ ] Desktop screenshot and tap
- [ ] Mobile app with accessibility service
- [ ] Web automation with Playwright

---

## File Structure

```
packages/
├── shared/src/device/
│   ├── types.ts          # DeviceAction, payloads
│   ├── capabilities.ts   # DeviceCapabilities
│   ├── result.ts         # ActionResult, UIElement
│   ├── schemas.ts        # Zod validation schemas
│   └── index.ts          # Exports
├── device-use/src/
│   ├── driver.ts         # DeviceDriver interface
│   └── drivers/
│       ├── desktop.ts    # DesktopDriver (NutJS)
│       ├── android.ts    # AndroidDriver
│       └── web.ts        # WebDriver (Playwright)
├── mobile-accessibility/
│   ├── index.ts          # TypeScript wrapper
│   └── android/src/main/java/agent/accessibility/
│       ├── AgentAccessibilityModule.kt
│       └── AgentAccessibilityService.kt
├── server/src/devices/
│   ├── registry.ts       # DeviceRegistry
│   ├── local-desktop.ts  # Local desktop device
│   └── index.ts          # Exports
├── core/src/tools/device/
│   └── index.ts          # Device tools
└── apps/
    ├── mobile/components/
    │   └── agent-bridge.tsx  # WebSocket command bridge
    ├── desktop/              # Tauri desktop app
    └── cli/                  # CLI interface
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_SERVER_URL` | `http://localhost:3000` | Server URL for device tools |
| `EXPO_PUBLIC_AGENT_WS_URL` | `ws://localhost:3000` | WebSocket URL for mobile bridge |
| `ENABLE_LOCAL_DESKTOP` | `false` | Auto-register local desktop device |

### Server Options

```typescript
interface ServerConfig {
  port?: number;                    // Default: 3000
  workspaceRoot?: string;           // Workspace for RAG indexing
  corsOrigin?: string | string[];   // CORS configuration
  enableLocalDesktop?: boolean;     // Auto-register local desktop
}
```

### WebDriver Options

```typescript
interface WebDriverOptions {
  cdpUrl?: string;              // CDP endpoint (default: http://localhost:9222)
  headless?: boolean;           // Launch headless if spawning new browser
  launchIfNotConnected?: boolean; // Launch browser if CDP connection fails
}
```
