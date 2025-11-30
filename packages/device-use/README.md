# @agent/device-use

Cross-platform device control package for the AI Agent Platform. Provides Anthropic's Computer Use tools with native implementations for desktop platforms.

## Features

- **Computer Tool**: Screenshot, mouse, keyboard control
- **Bash Tool**: Shell command execution
- **Text Editor Tool**: File viewing and editing
- **Cross-Platform**: macOS, Linux, Windows (desktop platforms fully implemented)
- **Safety Layer**: Rate limiting, coordinate validation, action blocking
- **Mobile Ready**: iOS and Android placeholders (requires native implementation in Phase 3)

## Platform Support

| Platform | Status | Implementation |
|----------|--------|----------------|
| macOS    | ✅ Complete | AppleScript via osascript |
| Linux    | ✅ Complete | xdotool (X11) |
| Windows  | ✅ Complete | PowerShell + Win32 APIs |
| iOS      | 📱 Placeholder | Requires native Swift/Objective-C (Phase 3) |
| Android  | 📱 Placeholder | Requires native Java/Kotlin (Phase 3) |

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
const result = await computer.execute({
  action: 'screenshot'
});

await computer.execute({
  action: 'mouse_move',
  coordinate: [100, 200]
});

await computer.execute({
  action: 'left_click',
  coordinate: [100, 200]
});

await computer.execute({
  action: 'type',
  text: 'Hello, World!'
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
await text_editor.execute({
  command: 'view',
  path: '/path/to/file.txt'
});

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

## Platform Requirements

### macOS
- No additional dependencies (uses built-in AppleScript)
- Requires Accessibility permissions for mouse/keyboard control

### Linux
- `xdotool` for mouse/keyboard control
- `scrot` or `gnome-screenshot` for screenshots
```bash
sudo apt-get install xdotool scrot  # Debian/Ubuntu
```

### Windows
- No additional dependencies (uses PowerShell)
- Runs on Windows 7+

## Development

```bash
pnpm build
pnpm test
```

## Security Warning

⚠️ This package provides direct system control. Only use in trusted environments:

- Desktop automation requires system-level permissions
- Rate limiting helps prevent abuse but doesn't guarantee safety
- Always validate user intent before enabling device control
- Consider running in sandboxed environments for untrusted code

## License

MIT
