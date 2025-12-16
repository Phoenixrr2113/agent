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
│  - device_sel   │     │  - Action Router   │     │  - IOSDriver        │
└─────────────────┘     └────────────────────┘     │  - WebDriver        │
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

**API Endpoints:**
- `GET /devices` - List connected devices
- `POST /devices/:deviceId/action` - Execute action on device

**Features:**
- Remote device support via WebSocket
- Local device support for same-process execution
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

### Phase 6: Web Driver 🔮 FUTURE

Playwright/Puppeteer integration for browser automation.

**Tasks:**
- [ ] Add playwright as optional dependency
- [ ] Create WebDriver implementation
- [ ] Add URL navigation actions
- [ ] Add element selector support (CSS, XPath, text)
- [ ] Integrate with DeviceRegistry

---

## Test Coverage

### Unit Tests ✅

| Suite | Tests | Location |
|-------|-------|----------|
| Device tools | 17 | `packages/core/src/tools/device/device-tools.test.ts` |
| Device registry | 15 | `packages/server/src/devices/registry.test.ts` |
| Desktop driver | 17 | `packages/device-use/tests/desktop-driver.test.ts` |
| Android driver | 24 | `packages/device-use/tests/android-driver.test.ts` |
| Safety validator | 11 | `packages/device-use/tests/safety.test.ts` |

**Total: 84 tests**

### Integration Tests

- [ ] Device registration flow (server ↔ mobile)
- [ ] Action execution flow (end-to-end)
- [ ] Multi-device selection
- [ ] Local desktop mode

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
│       └── android.ts    # AndroidDriver
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
└── apps/mobile/components/
    └── agent-bridge.tsx  # WebSocket command bridge
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_SERVER_URL` | `http://localhost:3000` | Server URL for device tools |
| `EXPO_PUBLIC_AGENT_WS_URL` | `ws://localhost:3000` | WebSocket URL for mobile bridge |

### Server Options

```typescript
interface ServerConfig {
  port?: number;                    // Default: 3000
  workspaceRoot?: string;           // Workspace for RAG indexing
  corsOrigin?: string | string[];   // CORS configuration
  enableLocalDesktop?: boolean;     // Auto-register local desktop (future)
}
```
