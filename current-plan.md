## Current State Analysis

### Backend (@agent/core + @agent/server)

**Current Capabilities:**

- Uses AI SDK's `ToolLoopAgent` with `agent.generate()` (non-streaming)
- `onStepFinish` callback exists but only logs to console - doesn't emit events
- Server has basic SSE endpoint (`/sessions/:id/chat/stream`) but it **only sends start/complete events**, not intermediate streaming data
- WebSocket server exists for mobile commands but isn't used for chat streaming

**Key Limitations:**

1. No real-time streaming of text tokens during generation
2. No real-time streaming of tool calls/results as they happen
3. No structured event protocol for different message parts (reasoning, sources, tools, text)

### Frontends (Mobile, Desktop)

**Current State:**

- **Mobile (React Native/Expo)**: Basic chat UI, uses `AgentClient.sendMessage()` (non-streaming), shows "Agent is thinking..." during loading
- **Desktop (Tauri/React)**: Nearly identical to mobile - basic chat, non-streaming
- **Shared UI (`@agent/ui`)**: Basic components (ChatContainer, ChatInput, ChatList, ChatBubble) but no streaming or tool visualization support

**Key Limitations:**

1. No streaming text display
2. No tool execution visualization
3. No reasoning/thinking display
4. No sources/citations display
5. Web frontend doesn't exist yet

### API Client (`@agent/api-client`)

**Current State:**

- Has `chatStream()` method that parses SSE events
- But the server only sends `start` and `complete` events, so streaming is essentially useless

---

## Holistic Plan: Backend-First Approach

The key insight from the AI SDK chatbot example is that it uses **structured message parts** that get streamed:

- `message.content` - the main text
- `message.reasoning` - thinking/reasoning with duration
- `message.sources` - citations/sources
- `message.toolCalls` - tool invocations

### Phase 1: Backend Streaming Infrastructure

**1.1 Create Streaming Event Protocol** (`packages/shared`)

```typescript
// Shared types for all clients
export type StreamEventType =
  | 'session:start'
  | 'step:start'
  | 'step:finish'
  | 'text:delta'
  | 'text:finish'
  | 'reasoning:delta'
  | 'reasoning:finish'
  | 'tool:call'
  | 'tool:result'
  | 'sources:add'
  | 'error'
  | 'complete';

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: number;
  stepIndex?: number;
}
```

**1.2 Create Streaming Runtime** (`packages/core`)

- Switch from `agent.generate()` to `agent.stream()` (if available in AI SDK 5.x)
- Or create a streaming wrapper that emits events via callback during `onStepFinish`
- Add `onEvent` callback to `AgentSession` that fires during execution

**1.3 Enhance Server Streaming** (`packages/server`)

```typescript
// Stream real events during execution
app.get('/sessions/:id/chat/stream', async (c) => {
  return streamSSE(c, async (stream) => {
    const session = sessions.get(sessionId);

    // Set up event listener for streaming
    session.runTaskWithEvents(message, async (event: StreamEvent) => {
      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event.data),
      });
    });
  });
});
```

### Phase 2: API Client & Shared Types

**2.1 Enhanced API Client** (`packages/api-client`)

```typescript
interface StreamingChatOptions {
  onTextDelta?: (text: string) => void;
  onReasoningDelta?: (text: string) => void;
  onToolCall?: (tool: ToolCallInfo) => void;
  onToolResult?: (result: ToolResultInfo) => void;
  onStepStart?: (stepIndex: number) => void;
  onStepFinish?: (stepInfo: StepInfo) => void;
  onComplete?: (result: ChatResponse) => void;
  onError?: (error: Error) => void;
}

// In AgentClient
async chat(message: string, options: StreamingChatOptions): Promise<void>
```

**2.2 Shared Message Types** (`packages/shared`)

```typescript
export interface MessagePart {
  type: 'text' | 'reasoning' | 'tool-call' | 'tool-result' | 'source';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface StreamingMessage {
  id: string;
  role: 'assistant';
  parts: MessagePart[];
  status: 'streaming' | 'complete';
  stepIndex: number;
}
```

### Phase 3: Shared UI Components

**3.1 Enhanced Message Types** (`packages/ui`)

```typescript
export interface RichMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  status: 'sending' | 'streaming' | 'complete' | 'error';
  parts?: MessagePart[];
  reasoning?: { content: string; duration?: number };
  toolCalls?: ToolCallInfo[];
  sources?: SourceInfo[];
}
```

**3.2 New Components** (React Native compatible):

- `<StreamingText>` - Displays text with typing effect
- `<ReasoningCollapsible>` - Expandable reasoning section with duration
- `<ToolCallCard>` - Shows tool name, inputs, and animated result
- `<SourcesList>` - Citations with icons and links
- `<StepIndicator>` - Shows current step in multi-step execution
- `<ThinkingLoader>` - More informative loading state

### Phase 4: Platform-Specific Implementations

**4.1 Mobile (React Native)**

- Use new streaming `useAgentChat` hook
- Implement all new components with React Native primitives
- Add haptic feedback for tool completions

**4.2 Desktop (Tauri/React)**

- Same components but with web DOM (can share more with web)
- Potentially use web-specific features like syntax highlighting

**4.3 Web (New - Next.js)**

- Create `apps/web` using Next.js
- SSR-compatible streaming
- Can leverage more browser features

---

## Implementation Order (Recommended)

```
Week 1-2: Backend Streaming
├── 1.1 Define streaming event protocol (shared types)
├── 1.2 Enhance agent runtime with event emission
└── 1.3 Update server SSE endpoint to stream real events

Week 3: API Client & Hook
├── 2.1 Update api-client with streaming support
└── 2.2 Create useAgentChat hook with streaming state

Week 4-5: Shared UI Components
├── 3.1 StreamingText component
├── 3.2 ReasoningCollapsible component
├── 3.3 ToolCallCard component
├── 3.4 SourcesList component
└── 3.5 Update ChatContainer for rich messages

Week 6: Platform Integration
├── 4.1 Integrate into mobile app
├── 4.2 Integrate into desktop app
└── 4.3 (Optional) Create web app
```

---

## Key Architectural Decisions

1. **Backend-first**: No point building fancy UI if backend can't stream
2. **Shared types in `@agent/shared`**: Single source of truth for all platforms
3. **React Native as baseline**: UI components work on all platforms (iOS, Android, Web)
4. **SSE over WebSocket for chat**: Simpler, HTTP-based, better for one-way streaming
5. **Keep WebSocket for bidirectional**: Device control, real-time status updates

---

## Questions for You Before Proceeding

1. **AI SDK streaming**: Should I investigate if AI SDK 5.x's `ToolLoopAgent` supports `stream()` method, or should we use `streamText` with manual multi-step handling?

2. **Web frontend priority**: Do you want to create `apps/web` with Next.js as part of this plan, or focus only on mobile/desktop?

3. **Reasoning models**: Do you want to support streaming reasoning tokens from models like DeepSeek-R1? This affects the event protocol.

4. **Tool result rendering**: For different tools (shell, web_search, fetch_page, etc.), do you want custom renderers, or a generic JSON view?

5. **Scope**: Should we tackle this as one large initiative, or break it into smaller PRs (e.g., Phase 1 first, then Phase 2)?

Let me know how you'd like to proceed!
