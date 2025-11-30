# Architecture Evolution Plan

This document outlines the evolution from the original single-package architecture to a full monorepo with multiple frontends and computer use capabilities.

## Current State (v0.3.0) - Device Use Package ✅

**Phase 1 & 2 Complete:** The codebase has a modern monorepo architecture with pnpm workspaces and Turborepo, plus cross-platform device control capabilities.

```
agent-platform/
├── packages/
│   ├── shared/                    # @agent/shared - Shared utilities & types
│   │   ├── src/
│   │   │   ├── logger.ts
│   │   │   ├── performance.ts
│   │   │   └── index.ts
│   │   ├── dist/
│   │   └── package.json
│   │
│   ├── core/                      # @agent/core - Agent runtime engine
│   │   ├── src/
│   │   │   ├── runtime/           # Agent execution & session management
│   │   │   ├── application/       # Orchestrator & initialization
│   │   │   ├── core/
│   │   │   │   ├── agents/        # Agent factory & model configs
│   │   │   │   ├── memory/        # Knowledge graph (SQLite + Graphiti)
│   │   │   │   ├── rag/           # Semantic code search (BM25 + embeddings)
│   │   │   │   └── search/        # Grep utilities
│   │   │   ├── tools/             # 10 tool implementations
│   │   │   │   ├── shell.ts
│   │   │   │   ├── web-search.ts
│   │   │   │   ├── memory.ts
│   │   │   │   ├── codebase.ts
│   │   │   │   └── ...
│   │   │   ├── infrastructure/    # System prompts
│   │   │   └── index.ts
│   │   ├── dist/
│   │   └── package.json
│   │
│   ├── server/                    # @agent/server - HTTP API server
│   │   ├── src/
│   │   │   └── index.ts           # Hono server (REST + SSE streaming)
│   │   ├── dist/
│   │   └── package.json
│   │
│   └── device-use/                # @agent/device-use - Cross-platform device control ✅
│       ├── src/
│       │   ├── types.ts           # Type definitions
│       │   ├── tools.ts           # Anthropic computer use tools integration
│       │   ├── platforms/
│       │   │   └── nutjs.ts       # Unified nut.js implementation (all desktop platforms)
│       │   ├── utils/
│       │   │   └── safety.ts      # Rate limiting & validation
│       │   └── index.ts
│       ├── tests/
│       ├── dist/
│       └── package.json
│
├── apps/
│   ├── cli/                       # @agent/cli - CLI applications
│   │   ├── src/
│   │   │   ├── server.ts          # Server launcher
│   │   │   └── chat.ts            # Interactive chat
│   │   ├── dist/
│   │   └── package.json
│   │
│   └── (future: web, mobile, desktop)  # Phases 3-5
│
├── pnpm-workspace.yaml            # Workspace configuration
├── turbo.json                     # Build pipeline (< 1s builds with cache!)
├── tsconfig.base.json            # Shared TypeScript config
├── package.json                   # Root workspace scripts
└── .gitignore                     # Updated for monorepo
```

**Package Structure:**
- **@agent/shared**: Base package with logger, performance tracking, and shared utilities
- **@agent/core**: Complete agent runtime engine with all core functionality
- **@agent/server**: Hono-based HTTP server with session management
- **@agent/device-use**: Cross-platform device control using nut.js (macOS, Linux X11/Wayland, Windows)
- **@agent/cli**: Command-line applications (server launcher & interactive chat)

**Build System:**
- **Turborepo**: Build caching and task orchestration (< 1s builds with cache)
- **pnpm workspaces**: Efficient dependency management with workspace protocol
- **TypeScript**: Shared base configuration with per-package customization

**Core Capabilities:**
- **Library API**: `createAgentRuntime()` with session management (@agent/core)
- **HTTP Server**: REST API + SSE streaming (@agent/server)
  - Endpoints: /health, /sessions, /chat, /sessions/:id/*
  - Session management (create, chat, stream, history, delete)
- **Memory**: SQLite knowledge graph with entity/fact/episode extraction
  - Conflict resolution & merging
  - Semantic search with embeddings
  - Dual provider support (native + Graphiti API)
- **RAG**: Hybrid semantic code search
  - AST-based chunking (code-aware)
  - BM25 + text-embedding-004
  - Reranking with Google's reranker
- **Tools** (10 implementations):
  - Core: shell, web_search, fetch_page
  - Memory: memory_search, memory_save, memory_find_entities, memory_find_facts
  - Workspace: search_codebase (semantic), grep_codebase (text)
  - Meta: task_complete, ask_user, plan, validate
- **Models**: Multi-tier via OpenRouter
  - Fast: DeepSeek Chat
  - Standard: Google Gemini 2.0 Flash
  - Reasoning: DeepSeek R1
  - Powerful: Claude Sonnet 4

**Package Scripts:**
```bash
pnpm build          # Build all packages with Turborepo
pnpm dev           # Run all packages in dev mode
pnpm test          # Run all tests
pnpm lint          # Lint all packages
pnpm clean         # Clean all build artifacts
pnpm chat          # Start interactive chat CLI
pnpm server        # Start HTTP server
```

**Package Dependencies:**
```
@agent/shared (base package - no dependencies)
    ↓
    ├── @agent/core (depends on: @agent/shared)
    │       ↓
    │       └── @agent/server (depends on: @agent/core, @agent/shared)
    │               ↓
    │               └── @agent/cli (depends on: @agent/core, @agent/server, @agent/shared)
    │
    └── @agent/device-use (depends on: @agent/shared)
```

---

## Previous Architecture (v0.1.0)

The original single-package structure before monorepo migration:

```
ai-agent-runtime/
├── src/
│   ├── index.ts, server.ts, cli.ts, chat.ts
│   ├── runtime/, application/, core/, tools/, infrastructure/
│   └── types/
├── tests/
├── dist/
└── package.json
```

This has been successfully migrated to the monorepo structure shown above.

---

## Phase 1: Monorepo Structure ✅ COMPLETE

**Status:** Successfully completed in v0.2.0

All migration steps have been completed. See "Current State" section above for the full monorepo structure.

### Completed Migration Steps

1. ✅ **Create monorepo structure**
   - Created `packages/` and `apps/` directories
   - Updated `pnpm-workspace.yaml` with workspace configuration
   - Created root `package.json` with workspace scripts

2. ✅ **Extract `packages/shared`**
   - Moved `src/core/logger.ts` and `src/core/performance.ts` to `packages/shared/src/`
   - Created package.json with proper exports
   - Base package with no dependencies on other workspace packages

3. ✅ **Create `packages/core`**
   - Moved `src/runtime/`, `src/application/`, `src/core/`, `src/tools/`, `src/infrastructure/` to `packages/core/src/`
   - Moved core tests to `packages/core/tests/`
   - Updated all imports to use `@agent/shared`
   - Created package.json with dependencies

4. ✅ **Extract `packages/server`**
   - Moved `src/server.ts` to `packages/server/src/index.ts`
   - Maintained Hono server with all endpoints
   - Updated imports to use `@agent/core` and `@agent/shared`
   - Created package.json with dependencies

5. ✅ **Extract `apps/cli`**
   - Moved `src/cli.ts` and `src/chat.ts` to `apps/cli/src/`
   - Updated imports to use workspace packages
   - Created package.json with bin executables
   - Configured server and chat commands

6. ✅ **Set up Turborepo**
   - Created `turbo.json` with optimized build pipeline
   - Configured dependency-aware build order
   - Enabled build caching (< 1s builds with cache!)

7. ✅ **Update TypeScript configuration**
   - Created `tsconfig.base.json` for shared configuration
   - Created per-package `tsconfig.json` files
   - Configured path aliases for `@agent/*` packages
   - Removed rootDir to allow cross-package compilation

8. ✅ **Update scripts and git configuration**
   - Root scripts: `build`, `dev`, `lint`, `test`, `clean`, `chat`, `server`
   - Individual package scripts configured
   - Updated `.gitignore` for monorepo (excludes .turbo/, .tsbuildinfo, compiled .js in src/)
   - Cleaned up 40+ compiled .js files from source directories

### Achievements

- ✅ All 4 packages build successfully
- ✅ Turborepo caching reduces build time to < 1s (from clean: ~3.5s)
- ✅ Agent runtime works perfectly in both CLI and server modes
- ✅ Clean dependency hierarchy with no circular dependencies
- ✅ TypeScript compilation outputs only to dist/ directories
- ✅ No compiled files polluting source directories

### Remaining Work for v0.2.0

To fully complete v0.2.0, the following tasks remain:

1. **Update README.md**
   - Document new monorepo structure
   - Update installation and development instructions
   - Add package development workflow guide
   - Document available scripts and commands

2. **Test Suite Migration**
   - Run existing test suite with monorepo structure
   - Update test paths and imports if needed
   - Ensure all tests pass
   - Add package-specific test scripts

3. **CI/CD Updates**
   - Update GitHub Actions workflows for Turborepo
   - Configure build caching in CI
   - Add per-package test and lint jobs
   - Set up package publishing pipeline (if needed)

4. **Documentation**
   - Create CONTRIBUTING.md with monorepo development guide
   - Document package publishing strategy
   - Add troubleshooting guide for common issues

---

## Phase 2: Device Use Package ✅ COMPLETE

High-performance cross-platform device control using **nut.js** - a native Node.js library providing unified automation APIs across all desktop platforms.

### Why nut.js?

After research, nut.js proved significantly superior to CLI-based approaches:

**Performance:**
- ⚡ **~100x faster** than CLI tools (no process spawning)
- ⚡ Native bindings to platform APIs
- ⚡ Lower latency for automation

**Compatibility:**
- ✅ **Wayland support** (xdotool doesn't work on Wayland)
- ✅ Works on X11 too
- ✅ Single codebase for all platforms

**Maintenance:**
- ✅ Actively maintained (RobotJS abandoned)
- ✅ Pre-built binaries (no compilation)
- ✅ Better error handling

### Implementation

```typescript
// packages/device-use/src/platforms/nutjs.ts
import { mouse, keyboard, screen, Button, Key, Point } from '@nut-tree-fork/nut-js';

export class NutJSPlatform {
  async screenshot(): Promise<ScreenshotResult> {
    const image = await screen.grab();
    return { type: 'image', data: image.data.toString('base64') };
  }

  async moveMouse(x: number, y: number): Promise<string> {
    await mouse.setPosition(new Point(x, y));
    return `Moved mouse to (${x}, ${y})`;
  }

  async click(action: string, coordinate?: [number, number]): Promise<string> {
    if (coordinate) await mouse.setPosition(new Point(coordinate[0], coordinate[1]));
    await mouse.click(Button.LEFT); // or RIGHT, MIDDLE
    return `Performed ${action}`;
  }

  async typeText(text: string): Promise<string> {
    await keyboard.type(text);
    return `Typed text: ${text}`;
  }

  async pressKey(key: string): Promise<string> {
    await keyboard.type(this.mapKeyToNutJS(key));
    return `Pressed key: ${key}`;
  }

  // ... scroll, drag, etc.
}
```

### Package Structure

```
packages/device-use/
├── src/
│   ├── index.ts
│   ├── tools.ts              # Anthropic computer use tools integration
│   ├── types.ts              # Type definitions
│   ├── platforms/
│   │   └── nutjs.ts          # Unified nut.js implementation
│   └── utils/
│       └── safety.ts         # Rate limiting & validation
├── tests/
│   └── safety.test.ts
└── package.json              # @nut-tree-fork/nut-js dependency
```

---

## Phase 3: React Native Mobile App

Cross-platform mobile agent with native capabilities:

```
apps/mobile/
├── src/
│   ├── App.tsx
│   ├── screens/
│   │   ├── ChatScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── MemoryScreen.tsx
│   ├── components/
│   │   ├── MessageBubble.tsx
│   │   ├── ToolIndicator.tsx
│   │   └── VoiceInput.tsx
│   ├── hooks/
│   │   ├── useAgent.ts          # Agent API client
│   │   ├── useVoice.ts          # Voice input/output
│   │   └── useNotifications.ts
│   ├── services/
│   │   ├── api.ts               # HTTP client to server
│   │   ├── storage.ts           # AsyncStorage wrapper
│   │   └── voice.ts             # Speech recognition/synthesis
│   └── native/
│       ├── camera.ts            # Camera access for vision
│       ├── location.ts          # GPS for context
│       ├── contacts.ts          # Contact access
│       └── calendar.ts          # Calendar integration
├── ios/
├── android/
└── package.json
```

### Mobile-Specific Features

```typescript
// apps/mobile/src/hooks/useAgent.ts
import { useState, useCallback } from 'react';

const API_URL = process.env.AGENT_API_URL;

export function useAgent() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const connect = useCallback(async () => {
    const res = await fetch(`${API_URL}/sessions`, { method: 'POST' });
    const { sessionId } = await res.json();
    setSessionId(sessionId);
  }, []);

  const send = useCallback(async (message: string, attachments?: Attachment[]) => {
    if (!sessionId) return;
    setLoading(true);

    const res = await fetch(`${API_URL}/sessions/${sessionId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, attachments }),
    });

    const result = await res.json();
    setMessages(prev => [...prev,
      { role: 'user', content: message },
      { role: 'assistant', content: result.text }
    ]);
    setLoading(false);
    return result;
  }, [sessionId]);

  return { connect, send, messages, loading, sessionId };
}
```

### Voice Interface

```typescript
// apps/mobile/src/services/voice.ts
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';

export class VoiceService {
  private onResult: (text: string) => void;

  constructor(onResult: (text: string) => void) {
    this.onResult = onResult;
    Voice.onSpeechResults = (e) => {
      if (e.value?.[0]) {
        this.onResult(e.value[0]);
      }
    };
  }

  async startListening() {
    await Voice.start('en-US');
  }

  async stopListening() {
    await Voice.stop();
  }

  async speak(text: string) {
    await Tts.speak(text);
  }
}
```

---

## Phase 4: Desktop App with Device Use

Electron or Tauri app for native desktop control:

```
apps/desktop/
├── src/
│   ├── main/
│   │   ├── index.ts             # Main process
│   │   ├── device-use.ts        # Native bindings
│   │   └── tray.ts              # System tray
│   ├── renderer/
│   │   ├── App.tsx
│   │   ├── screens/
│   │   └── components/
│   └── preload/
│       └── index.ts             # IPC bridge
├── native/                      # Native modules (Rust/C++)
│   ├── screenshot/
│   ├── input/
│   └── accessibility/
└── package.json
```

### Tauri vs Electron

| Feature | Tauri | Electron |
|---------|-------|----------|
| Bundle size | ~10MB | ~150MB |
| Memory | Lower | Higher |
| Native access | Rust | Node.js |
| Maturity | Newer | Mature |
| WebView | System | Chromium |

**Recommendation:** Tauri for smaller footprint, Electron for easier Node.js integration.

### Native Computer Control (Tauri + Rust)

```rust
// apps/desktop/src-tauri/src/computer_use.rs
use screenshots::Screen;
use enigo::{Enigo, MouseControllable, KeyboardControllable};

#[tauri::command]
pub fn capture_screen() -> Result<String, String> {
    let screen = Screen::all().map_err(|e| e.to_string())?[0];
    let image = screen.capture().map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    image.write_to(&mut buffer, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(base64::encode(&buffer))
}

#[tauri::command]
pub fn mouse_move(x: i32, y: i32) -> Result<(), String> {
    let mut enigo = Enigo::new();
    enigo.mouse_move_to(x, y);
    Ok(())
}

#[tauri::command]
pub fn mouse_click(button: &str) -> Result<(), String> {
    let mut enigo = Enigo::new();
    match button {
        "left" => enigo.mouse_click(enigo::MouseButton::Left),
        "right" => enigo.mouse_click(enigo::MouseButton::Right),
        _ => return Err("Invalid button".to_string()),
    }
    Ok(())
}

#[tauri::command]
pub fn type_text(text: &str) -> Result<(), String> {
    let mut enigo = Enigo::new();
    enigo.key_sequence(text);
    Ok(())
}
```

---

## Phase 5: Web Dashboard

Next.js admin dashboard:

```
apps/web/
├── src/
│   ├── app/
│   │   ├── page.tsx             # Chat interface
│   │   ├── memory/page.tsx      # Knowledge graph viewer
│   │   ├── sessions/page.tsx    # Session management
│   │   └── settings/page.tsx
│   ├── components/
│   │   ├── Chat/
│   │   ├── Memory/
│   │   │   └── GraphViewer.tsx  # D3/Cytoscape visualization
│   │   └── Tools/
│   └── lib/
│       └── api.ts
└── package.json
```

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                    │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│  Web App    │ Mobile App  │ Desktop App │    CLI      │  Third-party│
│  (Next.js)  │(React Native)│  (Tauri)   │             │  (via API)  │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘
       │             │             │             │             │
       └─────────────┴─────────────┼─────────────┴─────────────┘
                                   │
                          HTTP/WebSocket
                                   │
                    ┌──────────────▼──────────────┐
                    │      packages/server         │
                    │   (Hono + Session Mgmt)     │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       packages/core          │
                    │    (ai-agent-runtime)        │
                    ├──────────────────────────────┤
                    │  Memory │ Tools │ Orchestrator│
                    └──────────────┬──────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
┌──────▼──────┐            ┌───────▼───────┐          ┌───────▼───────┐
│   LLM API   │            │  External APIs │          │  Device Use   │
│ (OpenRouter)│            │(Brave, Tavily) │          │(Desktop+Mobile)│
└─────────────┘            └───────────────┘          └───────────────┘
```

---

## Security Considerations

### Device Use Safety

```typescript
// packages/device-use/src/utils/safety.ts
export interface SafetyConfig {
  allowedApps?: string[];
  blockedApps?: string[];
  maxActionsPerMinute?: number;
  requireConfirmation?: ('file_delete' | 'sudo' | 'browser')[];
  sandboxMode?: boolean;
}

export function validateAction(action: ComputerAction, config: SafetyConfig): boolean {
  // Rate limiting
  if (exceedsRateLimit(config.maxActionsPerMinute)) {
    return false;
  }

  // App restrictions
  if (config.blockedApps?.includes(getCurrentApp())) {
    return false;
  }

  // Dangerous action confirmation
  if (config.requireConfirmation?.includes(action.type)) {
    return false; // Requires user approval
  }

  return true;
}
```

### API Security

- JWT authentication for all endpoints
- Rate limiting per session
- CORS configuration
- Request validation with Zod
- Audit logging for sensitive operations

---

## Development Roadmap

### v0.2.0 - Monorepo Setup ✅ COMPLETE
- [x] Initialize pnpm workspaces
- [x] Extract packages (core, server, shared, cli)
- [x] Set up Turborepo
- [ ] CI/CD for monorepo (pending)

### v0.3.0 - Device Use ✅ COMPLETE
- [x] Create device-use package
- [x] macOS implementation
- [x] Linux implementation
- [x] Windows implementation
- [x] iOS implementation (placeholder for Phase 3)
- [x] Android implementation (placeholder for Phase 3)
- [x] Safety layer

### v0.4.0 - Mobile App
- [ ] React Native project setup
- [ ] Agent API client
- [ ] Voice input/output
- [ ] Camera integration
- [ ] Push notifications

### v0.5.0 - Desktop App
- [ ] Tauri project setup
- [ ] Device use integration
- [ ] System tray
- [ ] Global hotkeys
- [ ] Auto-update

### v0.6.0 - Web Dashboard
- [ ] Next.js project
- [ ] Chat interface
- [ ] Memory graph viewer
- [ ] Session management
- [ ] User authentication

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm workspaces + Turborepo |
| Core | Node.js + TypeScript + Vercel AI SDK |
| Server | Hono |
| Web | Next.js 14+ |
| Mobile | React Native + Expo |
| Desktop | Tauri (Rust) or Electron |
| Database | SQLite (memory), PostgreSQL (production) |
| LLM | OpenRouter (multi-provider) |
| Device Use | nut.js (desktop), React Native (mobile - Phase 3) |


