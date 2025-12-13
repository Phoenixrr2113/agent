# Device Control Plan

## Current State Analysis

### Desktop (`@agent/device-use`)

**Existing Capabilities:**
- `DeviceDriver` interface: click, type, scroll, drag, screenshot, pressKey
- `DesktopDriver` using NutJS for macOS/Windows/Linux
- Anthropic computer_20250124, bash_20250124, textEditor_20250124 tools
- SafetyValidator for rate limiting and blocked apps

**Limitations:**
1. Desktop-only (Node.js, NutJS)
2. No mobile driver implementation
3. No unified "use current device" abstraction

### Mobile (`@agent/mobile-accessibility`)

**Existing Capabilities:**
- Native module scaffolding (Android/iOS)
- `AgentBridge` component receives commands via WebSocket
- Basic click/swipe implementation started

**Limitations:**
1. Requires accessibility service (Android) / permissions (iOS)
2. Incomplete native implementations
3. No screenshot capability
4. No type/keyboard support

### Server Command Flow

**Current:** Mobile ↔ WebSocket ↔ Server (basic click/swipe only)

---

## Proposed Architecture

```
┌─────────────┐    ┌──────────────┐    ┌──────────────────┐
│   Agent     │    │   Server     │    │    Device        │
│   (LLM)     │───▶│   SSE/WS     │◀──▶│    Driver        │
│   Core      │    │   Bridge     │    │   (Platform)     │
└─────────────┘    └──────────────┘    └──────────────────┘
                                              │
                   ┌──────────────────────────┼──────────────┐
                   │                          │              │
              ┌────┴────┐            ┌────────┴───┐   ┌──────┴──────┐
              │ Desktop │            │   Mobile   │   │    Web      │
              │ NutJS   │            │ Access.    │   │ Puppeteer/  │
              │         │            │ Service    │   │ Playwright  │
              └─────────┘            └────────────┘   └─────────────┘
```

---

## Phase 1: Unified Device Driver Protocol

### 1.1 Shared Types (`@agent/shared`)

```typescript
export interface DeviceAction {
  type: 'tap' | 'type' | 'swipe' | 'scroll' | 'screenshot' | 'key' | 'gesture';
  payload: TapPayload | TypePayload | SwipePayload | ...;
}

export interface DeviceCapabilities {
  platform: 'desktop' | 'mobile' | 'web';
  canScreenshot: boolean;
  canType: boolean;
  canTap: boolean;
  screenSize: { width: number; height: number };
}
```

### 1.2 Update DeviceDriver Interface (`@agent/device-use`)

```typescript
export interface DeviceDriver {
  getCapabilities(): Promise<DeviceCapabilities>;
  execute(action: DeviceAction): Promise<ActionResult>;
  getUITree?(): Promise<UIElement[]>;  // For mobile accessibility
}
```

---

## Phase 2: Mobile Accessibility Implementation

### 2.1 Android Accessibility Service

- Create Android native module with AccessibilityService
- Implement: tap, swipe, type (input dispatch), screenshot (MediaProjection)
- Expose as `MobileDriver` implementing `DeviceDriver`

### 2.2 iOS Accessibility Implementation

- Use XCUITest/XCode accessibility API
- Alternative: Use `expo-accessibility` for limited actions
- Implement same DeviceDriver interface

### 2.3 Mobile-Side Command Executor

Update `AgentBridge` to handle full `DeviceAction` protocol:

```typescript
ws.onmessage = async (e) => {
  const action: DeviceAction = JSON.parse(e.data);
  const result = await mobileDriver.execute(action);
  ws.send(JSON.stringify(result));
};
```

---

## Phase 3: Server-Side Device Routing

### 3.1 Device Registry (`@agent/server`)

```typescript
interface ConnectedDevice {
  id: string;
  type: 'desktop' | 'mobile';
  capabilities: DeviceCapabilities;
  execute: (action: DeviceAction) => Promise<ActionResult>;
}

const devices = new Map<string, ConnectedDevice>();
```

### 3.2 Device Selection Tool (`@agent/core`)

```typescript
const selectDevice = tool({
  name: 'select_device',
  description: 'Select which device to control',
  parameters: { deviceId: z.string() },
  execute: ({ deviceId }) => {
    currentDevice = devices.get(deviceId);
  }
});
```

### 3.3 Unified Device Tool

```typescript
const deviceControl = tool({
  name: 'device_control',
  description: 'Control the selected device',
  parameters: DeviceActionSchema,
  execute: (action) => currentDevice.execute(action)
});
```

---

## Phase 4: UI Tree Integration (Optional)

### Goal: Let agent see UI structure, not just pixels

### 4.1 Mobile UI Tree

- Android: Use AccessibilityNodeInfo.getChildren()
- iOS: Use accessibility hierarchy

```typescript
interface UIElement {
  id: string;
  type: 'button' | 'text' | 'input' | 'container';
  rect: { x, y, width, height };
  text?: string;
  clickable: boolean;
  children: UIElement[];
}
```

### 4.2 Agent Uses UI Tree

Instead of pixel coordinates, agent can reference elements:

```
Agent: "Tap the button with text 'Submit'"
→ Tool finds element, gets coordinates, taps
```

---

## Implementation Order

```
Week 1: Unified Protocol
├── 1.1 Define DeviceAction types in @agent/shared
├── 1.2 Update DeviceDriver interface
└── 1.3 Refactor DesktopDriver to use new protocol

Week 2-3: Mobile Android
├── 2.1 Create AccessibilityService native module
├── 2.2 Implement tap/swipe/type/screenshot
└── 2.3 Wire up to AgentBridge WebSocket

Week 3-4: Mobile iOS
├── 2.4 Create iOS accessibility module
├── 2.5 Implement same actions
└── 2.6 Test on real device

Week 4-5: Server Integration
├── 3.1 Device registry in server
├── 3.2 Multi-device WebSocket handling
└── 3.3 Device selection tool

Week 5-6: Polish
├── 4.1 UI tree extraction (optional)
├── 4.2 Safety controls for mobile
└── 4.3 Documentation and testing
```

---

## Key Decisions Needed

1. **Android AccessibilityService**: Requires enabling in system settings. Is this acceptable UX?

2. **iOS Strategy**: Full accessibility needs jailbreak or XCUITest. Should we use limited expo-accessibility instead?

3. **Screenshot on Mobile**: Requires screen capture permission. Handle async permission flow?

4. **UI Tree vs Pixels**: Implement semantic UI tree for smarter element targeting?

5. **Multi-device**: Support controlling multiple devices simultaneously?

---

## Quick Wins (Start Here)

1. **Complete Android AccessibilityService** - Most impactful
2. **Add tap-by-text** - Agent says "tap Submit", we find and tap
3. **Mobile screenshot** - Essential for vision-based agents
