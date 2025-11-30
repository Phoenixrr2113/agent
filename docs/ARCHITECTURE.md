# Architecture Evolution Plan

This document outlines the evolution from the current single-package architecture to a full monorepo with multiple frontends and computer use capabilities.

## Current State (v0.1.0)

```
ai-agent-runtime/
├── src/
│   ├── index.ts           # Library exports
│   ├── server.ts          # Hono HTTP server (REST + SSE streaming)
│   ├── cli.ts             # CLI entry point
│   ├── chat.ts            # Interactive testing
│   ├── runtime/
│   │   └── agent-runtime.ts    # Session management & execution
│   ├── application/
│   │   ├── initialization.ts   # System initialization
│   │   └── orchestrator.ts     # Agent orchestration
│   ├── core/
│   │   ├── agents/            # Agent factory & model configs
│   │   ├── memory/            # Knowledge graph (SQLite + Graphiti)
│   │   │   ├── extraction.ts  # LLM entity/fact extraction
│   │   │   ├── storage-sqlite.ts
│   │   │   └── provider-graphiti.ts
│   │   ├── rag/               # Semantic code search
│   │   │   ├── index.ts       # BM25 + embeddings + reranking
│   │   │   └── strategies/    # AST-based chunking
│   │   ├── logger.ts
│   │   ├── performance.ts
│   │   └── search/grep.ts
│   ├── tools/                 # 10 tool implementations
│   │   ├── shell.ts
│   │   ├── web-search.ts      # Tavily integration
│   │   ├── fetch-page.ts      # Web scraping
│   │   ├── memory.ts          # Memory CRUD tools
│   │   ├── codebase.ts        # Code search tools
│   │   ├── agent.ts           # Meta-agent tools
│   │   ├── workflow.ts        # Planning & validation
│   │   └── registry.ts        # Semantic tool discovery
│   ├── types/                 # Type definitions
│   └── infrastructure/        # System prompts
├── tests/                     # Unit + integration tests
├── dist/                      # Compiled output
└── package.json
```

**Capabilities:**
- **Library API**: `createAgentRuntime()` with session management
- **HTTP Server**: Hono-based REST API + SSE streaming
  - Session management (create, chat, stream, history, delete)
  - Stateless chat endpoint
  - Health check
- **Memory**: SQLite knowledge graph with entity/fact/episode extraction
  - Conflict resolution & merging
  - Semantic search with embeddings
  - Dual provider support (native + Graphiti API)
- **RAG**: Hybrid semantic code search
  - AST-based chunking (code-aware)
  - BM25 + text-embedding-004
  - Reranking with Google's reranker
  - File caching
- **Tools** (10 implementations):
  - Core: shell, web_search, fetch_page
  - Memory: memory_search, memory_save, memory_find_entities, memory_find_facts
  - Workspace: search_codebase (semantic), grep_codebase (text)
  - Meta: task_complete, ask_user, plan, validate
  - Tool registry with semantic tool discovery
- **Models**: Multi-tier via OpenRouter
  - Fast: DeepSeek Chat
  - Standard: Google Gemini 2.0 Flash
  - Reasoning: DeepSeek R1
  - Powerful: Claude Sonnet 4

---

## Phase 1: Monorepo Structure

Convert to pnpm workspaces monorepo:

```
agent-platform/
├── packages/
│   ├── core/                    # @agent/core - Core agent runtime
│   │   ├── src/
│   │   │   ├── runtime/         # Agent execution engine
│   │   │   ├── application/     # Orchestrator & initialization
│   │   │   ├── core/            # Memory, RAG, Agents
│   │   │   ├── tools/           # Tool implementations
│   │   │   ├── infrastructure/  # System prompts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── server/                  # @agent/server - HTTP API
│   │   ├── src/
│   │   │   ├── index.ts         # Server factory & startup
│   │   │   ├── routes/          # Route handlers
│   │   │   │   ├── chat.ts
│   │   │   │   ├── sessions.ts
│   │   │   │   └── health.ts
│   │   │   └── middleware/      # CORS, logging, etc.
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── shared/                  # @agent/shared - Shared types & utils
│   │   ├── src/
│   │   │   ├── types/           # API types, tool schemas
│   │   │   │   ├── agent.ts
│   │   │   │   ├── api.ts
│   │   │   │   ├── memory.ts
│   │   │   │   └── tools.ts
│   │   │   └── utils/           # Common utilities
│   │   │       ├── logger.ts
│   │   │       └── performance.ts
│   │   └── package.json
│   │
│   └── computer-use/            # @agent/computer-use - Native computer control (Phase 2)
│       ├── src/
│       │   ├── index.ts
│       │   ├── screenshot.ts
│       │   ├── mouse.ts
│       │   ├── keyboard.ts
│       │   └── tools.ts
│       └── package.json
│
├── apps/
│   ├── cli/                     # CLI tool (extracted from current cli.ts/chat.ts)
│   │   ├── src/
│   │   │   ├── cli.ts
│   │   │   └── chat.ts
│   │   └── package.json
│   │
│   ├── web/                     # Next.js dashboard (Phase 5)
│   ├── mobile/                  # React Native app (Phase 3)
│   └── desktop/                 # Electron/Tauri app (Phase 4)
│
├── pnpm-workspace.yaml
├── turbo.json
├── package.json                 # Root package with dev dependencies
├── tsconfig.base.json          # Base TypeScript config
└── .env.example
```

### Migration Steps (Phase 1)

1. **Create monorepo structure**
   - Create `packages/` and `apps/` directories
   - Update `pnpm-workspace.yaml` to include workspaces
   - Create root `package.json` with workspace scripts

2. **Extract `packages/shared`**
   - Move `src/types/` to `packages/shared/src/types/`
   - Move `src/core/logger.ts` and `src/core/performance.ts` to `packages/shared/src/utils/`
   - Create package.json with exports

3. **Create `packages/core`**
   - Move `src/runtime/`, `src/application/`, `src/core/`, `src/tools/`, `src/infrastructure/` to `packages/core/src/`
   - Move core tests to `packages/core/tests/`
   - Update imports to use `@agent/shared`
   - Create package.json with dependencies

4. **Extract `packages/server`**
   - Move `src/server.ts` to `packages/server/src/`
   - Split into routes and middleware
   - Move server tests to `packages/server/tests/`
   - Update imports to use `@agent/core` and `@agent/shared`
   - Create package.json with dependencies

5. **Extract `apps/cli`**
   - Move `src/cli.ts` and `src/chat.ts` to `apps/cli/src/`
   - Update imports to use workspace packages
   - Create package.json with dependencies
   - Configure as executable

6. **Set up Turborepo**
   - Create `turbo.json` with build pipeline
   - Configure build order: shared → core → server → cli
   - Set up caching for builds and tests

7. **Update TypeScript configuration**
   - Create `tsconfig.base.json` for shared config
   - Create per-package `tsconfig.json` with references
   - Configure path aliases for workspace packages

8. **Update scripts and CI**
   - Root scripts: `build`, `test`, `lint`, `dev`
   - Individual package scripts
   - Update CI to use Turborepo

### Package Dependencies

```
@agent/shared (base package)
    ↓
@agent/core (depends on: @agent/shared)
    ↓
@agent/server (depends on: @agent/core, @agent/shared)
    ↓
apps/cli (depends on: @agent/core, @agent/server, @agent/shared)
```

---

## Phase 2: Computer Use Package

Native computer control for desktop automation:

```typescript
// packages/computer-use/src/index.ts
import { anthropic } from '@ai-sdk/anthropic';

export interface ComputerUseConfig {
  displayWidth: number;
  displayHeight: number;
  safeMode?: boolean;
}

export function createComputerTools(config: ComputerUseConfig) {
  return {
    computer: anthropic.tools.computer_20250124({
      displayWidthPx: config.displayWidth,
      displayHeightPx: config.displayHeight,
      execute: async ({ action, coordinate, text }) => {
        switch (action) {
          case 'screenshot':
            return { type: 'image', data: await captureScreen() };
          case 'mouse_move':
            return await moveMouse(coordinate);
          case 'left_click':
          case 'right_click':
          case 'double_click':
            return await click(action, coordinate);
          case 'type':
            return await typeText(text);
          case 'key':
            return await pressKey(text);
          case 'scroll':
            return await scroll(coordinate);
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      },
      toModelOutput(result) {
        return typeof result === 'string'
          ? [{ type: 'text', text: result }]
          : [{ type: 'image', data: result.data, mediaType: 'image/png' }];
      },
    }),

    text_editor: anthropic.tools.textEditor_20250124({
      execute: async ({ command, path, content }) => {
        // File editing operations
      },
    }),

    bash: anthropic.tools.bash_20250124({
      execute: async ({ command }) => {
        // Bash execution (reuse shell tool)
      },
    }),
  };
}
```

### Platform-Specific Implementations

```
packages/computer-use/
├── src/
│   ├── index.ts
│   ├── tools.ts
│   ├── platforms/
│   │   ├── macos/
│   │   │   ├── screenshot.ts    # screencapture CLI
│   │   │   ├── mouse.ts         # cliclick or Accessibility API
│   │   │   └── keyboard.ts
│   │   ├── linux/
│   │   │   ├── screenshot.ts    # scrot/gnome-screenshot
│   │   │   ├── mouse.ts         # xdotool
│   │   │   └── keyboard.ts
│   │   └── windows/
│   │       ├── screenshot.ts    # PowerShell
│   │       ├── mouse.ts         # PowerShell/AutoHotkey
│   │       └── keyboard.ts
│   └── utils/
│       ├── image.ts             # Base64 encoding
│       └── safety.ts            # Action validation
└── package.json
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

## Phase 4: Desktop App with Computer Use

Electron or Tauri app for native desktop control:

```
apps/desktop/
├── src/
│   ├── main/
│   │   ├── index.ts             # Main process
│   │   ├── computer-use.ts      # Native bindings
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
│   LLM API   │            │  External APIs │          │ Computer Use  │
│ (OpenRouter)│            │(Brave, Tavily) │          │ (Desktop only)│
└─────────────┘            └───────────────┘          └───────────────┘
```

---

## Security Considerations

### Computer Use Safety

```typescript
// packages/computer-use/src/utils/safety.ts
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

### v0.2.0 - Monorepo Setup
- [ ] Initialize pnpm workspaces
- [ ] Extract packages (core, server, shared)
- [ ] Set up Turborepo
- [ ] CI/CD for monorepo

### v0.3.0 - Computer Use
- [ ] Create computer-use package
- [ ] macOS implementation
- [ ] Linux implementation
- [ ] Windows implementation
- [ ] Safety layer

### v0.4.0 - Mobile App
- [ ] React Native project setup
- [ ] Agent API client
- [ ] Voice input/output
- [ ] Camera integration
- [ ] Push notifications

### v0.5.0 - Desktop App
- [ ] Tauri project setup
- [ ] Computer use integration
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
| Computer Use | Platform-specific (Anthropic tools) |


