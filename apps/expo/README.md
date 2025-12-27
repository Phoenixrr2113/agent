# @agent/expo

Cross-platform mobile and web application for the AI Agent Platform built with [Expo](https://expo.dev) and React Native.

## Features

- **Chat Interface**: Interactive chat with the AI agent using streaming responses
- **Device Control**: Test Android device automation via accessibility services
- **Debug Dashboard**: Real-time monitoring of agent sessions, tool calls, and logs
- **Cross-Platform**: Runs on iOS, Android, and Web from a single codebase

## Screens

### Home / Chat
Main chat interface for interacting with the agent. Features:
- Real-time streaming responses
- Markdown rendering
- Reasoning step visualization
- Tool execution tracking

### Device Control
Test device automation capabilities:
- Check accessibility service status
- Execute device actions (click, swipe, type)
- View screenshots and UI tree
- Debug overlay controls

### Debug Dashboard
Monitor agent operations in real-time:
- Session list with statistics
- Message round details
- Tool execution logs
- Server logs viewer
- Responsive layout (tabs on mobile, split-view on desktop)

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- For iOS: Xcode with iOS Simulator
- For Android: Android Studio with Emulator

### Installation

From the monorepo root:

```bash
pnpm install
pnpm build
```

### Running the App

```bash
# Start Expo development server
pnpm expo

# Run on web
pnpm expo:web

# Run on iOS simulator
pnpm expo:ios

# Run on Android emulator
pnpm expo:android
```

### Configuration

The app connects to the agent server. Configure the server URL in the app settings or set the default in your environment.

Default server URL: `http://localhost:3000`

## Development

### Project Structure

```
apps/expo/
├── app/                    # Expo Router pages
│   ├── (tabs)/             # Tab navigation
│   │   ├── index.tsx       # Home/Chat screen
│   │   ├── chat.tsx        # Chat implementation
│   │   ├── settings.tsx    # Settings screen
│   │   └── debug.tsx       # Debug dashboard
│   └── _layout.tsx         # Root layout
├── components/             # App-specific components
├── contexts/               # React contexts (settings, etc.)
├── hooks/                  # Custom hooks
├── constants/              # App constants
└── tailwind.config.js      # Tailwind configuration
```

### Dependencies

This app uses:
- **@agent/api-client** - HTTP/WebSocket client for server communication
- **@agent/ui** - Shared UI components
- **@agent/mobile-accessibility** - Android native module for device control
- **@agent/tailwind-config** - Shared Tailwind configuration

### Styling

The app uses [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native) for styling, with the shared `@agent/tailwind-config` for consistent theming across platforms.

## Android Device Control

To use device control features on Android:

1. Build and install the app on an Android device/emulator
2. Go to Settings > Accessibility
3. Enable the "Agent Accessibility Service"
4. Return to the app and use the Device Control screen

## License

MIT
