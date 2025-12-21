# @agent/device-use

Cross-platform device control package for the AI Agent Platform. Provides unified tools for device automation across desktop, web, and mobile platforms.

## Features

- **Computer Tool**: Screenshot, mouse, keyboard control
- **Bash Tool**: Shell command execution
- **Text Editor Tool**: File viewing and editing
- **Multi-Platform**: Desktop (macOS, Linux, Windows), Web (via Playwright), Mobile (Android)
- **High Performance**: Native bindings for desktop, accessibility services for mobile
- **Safety Layer**: Rate limiting, coordinate validation, action blocking
- **Driver Architecture**: Pluggable drivers for different platforms

## Drivers

### Desktop Driver (nut.js)
Uses [nut.js](https://nutjs.dev/) for desktop automation with these advantages:
- ✅ **Wayland Support**: Works on modern Linux with Wayland
- ✅ **100x Faster**: No process spawning overhead
- ✅ **Unified API**: Single codebase for all desktop platforms
- ✅ **Pre-built Binaries**: No build tools required

### Web Driver (Playwright)
Uses [Playwright](https://playwright.dev/) for browser automation:
- ✅ **Multi-Browser**: Chrome, Firefox, Safari support
- ✅ **Headless Mode**: Run without display
- ✅ **Full Control**: Navigate, click, type, screenshot

### Android Driver
Uses `@agent/mobile-accessibility` for Android device control:
- ✅ **Accessibility Service**: Native Android integration
- ✅ **UI Tree Access**: Get element hierarchy
- ✅ **Gesture Support**: Click, swipe, long press

## Platform Support

| Platform | Status | Driver |
|----------|--------|--------|
| macOS    | ✅ Supported | Desktop (nut.js) |
| Linux X11| ✅ Supported | Desktop (nut.js) |
| Linux Wayland | ✅ Supported | Desktop (nut.js) |
| Windows  | ✅ Supported | Desktop (nut.js) |
| Web/Browser | ✅ Supported | Web (Playwright) |
| Android  | ✅ Supported | Android (Accessibility) |
| iOS      | 🔮 Planned | Requires native module |

## Installation

This package is part of the monorepo and should be installed via pnpm workspaces:

```bash
pnpm install
```

## Usage

```typescript
import { createDeviceTools } from '@agent/device-use';

// Default: Desktop driver
const tools = createDeviceTools({
  displayWidth: 1920,
  displayHeight: 1080,
  safeMode: true,
  maxActionsPerMinute: 60,
});

const { computer, bash, text_editor } = tools;
```

### Selecting a Driver

```typescript
import { DesktopDriver, WebDriver, AndroidDriver } from '@agent/device-use';

// Desktop automation (nut.js)
const desktopDriver = new DesktopDriver();

// Web automation (Playwright)
const webDriver = new WebDriver({ headless: true });

// Android automation (requires mobile-accessibility)
const androidDriver = new AndroidDriver();
```

### Computer Tool

```typescript
// Screenshot
const result = await computer.execute({
  action: 'screenshot'
});

// Mouse movement
await computer.execute({
  action: 'mouse_move',
  coordinate: [100, 200]
});

// Clicking
await computer.execute({
  action: 'left_click',
  coordinate: [100, 200]
});

// Typing
await computer.execute({
  action: 'type',
  text: 'Hello, World!'
});

// Keyboard shortcuts
await computer.execute({
  action: 'key',
  text: 'LeftControl'
});
```

### Bash Tool

```typescript
const output = await bash.execute({
  command: 'ls -la'
});
```

### Text Editor Tool

```typescript
// View file
await text_editor.execute({
  command: 'view',
  path: '/path/to/file.txt'
});

// Replace text
await text_editor.execute({
  command: 'str_replace',
  path: '/path/to/file.txt',
  old_str: 'old text',
  new_str: 'new text'
});
```

## Configuration

```typescript
interface DeviceUseConfig {
  displayWidth: number;
  displayHeight: number;
  platform?: Platform;
  safeMode?: boolean;
  maxActionsPerMinute?: number;
  allowedApps?: string[];
  blockedApps?: string[];
  requireConfirmation?: ComputerAction[];
}
```

## Safety Features

- **Rate Limiting**: Configurable actions per minute (default: 60)
- **Coordinate Validation**: Ensures actions stay within screen bounds
- **Action Blocking**: Require confirmation for sensitive actions
- **App Restrictions**: Allow/block specific applications

## System Requirements

### All Platforms
- **Node.js**: 20+ required
- **Pre-built binaries**: Automatically installed via npm

### macOS
- Requires Accessibility permissions for automation
- Grant permission in System Preferences → Security & Privacy → Privacy → Accessibility

### Linux
- Works on both X11 and Wayland
- No additional dependencies required (pre-built binaries included)

### Windows
- Works on Windows 7+
- No additional dependencies required

## Development

```bash
# Build
pnpm build

# Test
pnpm test

# Watch mode
pnpm test:watch
```

## Performance

Compared to CLI-based approaches (AppleScript, xdotool, PowerShell):

- **~100x faster** for mouse/keyboard operations
- **No process spawning overhead**
- **Lower latency** for automation tasks
- **More reliable** with fewer failure points

## Security Warning

⚠️ This package provides direct system control. Only use in trusted environments:

- Desktop automation requires system-level permissions
- Rate limiting helps prevent abuse but doesn't guarantee safety
- Always validate user intent before enabling device control
- Consider running in sandboxed environments for untrusted code

## Technical Details

### nut.js Integration

nut.js provides native bindings for:
- **Mouse control**: Uses platform-specific APIs (CGEvent on macOS, Win32 on Windows, libinput/X11 on Linux)
- **Keyboard control**: Native keyboard events on all platforms
- **Screen capture**: Fast screenshot APIs without file I/O
- **Wayland support**: Works on modern Linux without X11

### Mobile Support

**Android** is supported via the `@agent/mobile-accessibility` package which provides native Kotlin bindings to Android's AccessibilityService APIs.

**iOS** support is planned and will require a native Swift module with UIKit APIs.

## Troubleshooting

### macOS: Permission Denied
Grant Accessibility permissions in System Preferences → Security & Privacy → Privacy → Accessibility

### Linux: libxcb errors
Ensure X11 or Wayland is running. nut.js works with both.

### All Platforms: Installation Issues
nut.js includes pre-built binaries. If installation fails, try:
```bash
pnpm install --force
```

## License

MIT
