# @agent/device-use

Cross-platform device control package for the AI Agent Platform using [nut.js](https://nutjs.dev/). Provides Anthropic's Computer Use tools with a unified, high-performance implementation across all desktop platforms.

## Features

- **Computer Tool**: Screenshot, mouse, keyboard control
- **Bash Tool**: Shell command execution
- **Text Editor Tool**: File viewing and editing
- **Cross-Platform**: macOS, Linux (X11 & Wayland), Windows
- **High Performance**: Native bindings via nut.js (100x faster than CLI-based approaches)
- **Safety Layer**: Rate limiting, coordinate validation, action blocking
- **Zero Configuration**: Pre-built binaries, no compilation needed

## Why nut.js?

This package uses [nut.js](https://nutjs.dev/) instead of platform-specific CLI tools for several key advantages:

✅ **Wayland Support**: Works on modern Linux with Wayland (xdotool doesn't)
✅ **100x Faster**: No process spawning overhead
✅ **Actively Maintained**: Regular updates and bug fixes
✅ **Unified API**: Single codebase for all platforms
✅ **Pre-built Binaries**: No build tools or dependencies required
✅ **Better Reliability**: Fewer failure points than CLI tools

## Platform Support

| Platform | Status | Technology |
|----------|--------|------------|
| macOS    | ✅ Fully Supported | nut.js (native bindings) |
| Linux X11| ✅ Fully Supported | nut.js (native bindings) |
| Linux Wayland | ✅ Fully Supported | nut.js (native bindings) |
| Windows  | ✅ Fully Supported | nut.js (native bindings) |
| iOS      | 📱 Future | Requires React Native (Phase 3) |
| Android  | 📱 Future | Requires React Native (Phase 3) |

## Installation

This package is part of the monorepo and should be installed via pnpm workspaces:

```bash
pnpm install
```

## Usage

```typescript
import { createDeviceTools } from '@agent/device-use';

const tools = createDeviceTools({
  displayWidth: 1920,
  displayHeight: 1080,
  safeMode: true,
  maxActionsPerMinute: 60,
});

const { computer, bash, text_editor } = tools;
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

### Future: Mobile Support

iOS and Android support will be added in Phase 3 when the React Native mobile app is implemented. Mobile platforms require native code integration:
- **iOS**: Swift/Objective-C with UIKit APIs
- **Android**: Kotlin/Java with AccessibilityService APIs

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
