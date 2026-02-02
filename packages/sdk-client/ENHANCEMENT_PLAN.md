# SDK Client & Server Enhancement Plan

## Goal

Make `@agent/sdk-client` and `@agent/sdk-server` more robust, taking inspiration from AI SDK patterns (`useChat`, `streamText`, `toUIMessageStreamResponse`).

---

## Current State

### SDK-Server (✅ Decent)
- Has Hono routes with CORS
- Has SSE streaming via `streamSSE`
- Has `/generate`, `/stream`, `/chat`, `/health`
- **Missing:** AI SDK stream helpers, WebSocket, session management

### SDK-Client (❌ Stub)
- Only 37 lines in http-client.ts
- No streaming (AsyncGenerator)
- No session management
- No timeout/abort handling

---

## AI SDK Patterns to Adopt

### Server-Side

```typescript
// AI SDK pattern: streamText + toUIMessageStreamResponse
import { streamText } from 'ai';

export async function POST(req) {
  const { messages } = await req.json();
  const result = streamText({ model, messages });
  return result.toUIMessageStreamResponse();
}
```

**For our SDK:**
```typescript
// Use AI SDK helpers directly
import { streamText, toUIMessageStreamResponse } from 'ai';

app.post('/stream', async (c) => {
  const { prompt } = await c.req.json();
  
  const result = await agent.stream({ prompt });
  
  // Use AI SDK response helper
  return new Response(result.toDataStream(), {
    headers: { 'Content-Type': 'text/event-stream' }
  });
});
```

### Client-Side

```typescript
// AI SDK pattern: useChat hook
import { useChat } from 'ai/react';

function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });
}
```

**For our SDK (non-React):**
```typescript
// Provide similar functionality without React dependency
import { ChatClient } from '@agent/sdk-client';

const chat = new ChatClient({ baseUrl: '/api' });

// Stream with callbacks
await chat.stream('Hello', {
  onTextDelta: (delta) => console.log(delta),
  onToolCall: (call) => console.log(call),
  onComplete: (result) => console.log(result),
});
```

---

## Files to Enhance

### SDK-Client

| File | Current | Enhancement |
|------|---------|-------------|
| `http-client.ts` | 37 lines | Add timeout, SSE streaming, callbacks |
| `websocket-client.ts` | 57 lines | Add reconnection, state listeners |
| `client.ts` | 40 lines | Add session management, convenience methods |
| `types.ts` | 30 lines | Add all event types for streaming |
| `errors.ts` | 20 lines | OK as is |
| `streaming.ts` | NEW | SSE parser, stream reader utilities |

### SDK-Server

| File | Current | Enhancement |
|------|---------|-------------|
| `routes.ts` | 199 lines | Use AI SDK response helpers |
| `server.ts` | 96 lines | Add WebSocket upgrade |
| `types.ts` | 40 lines | Add more streaming event types |
| `middleware.ts` | NEW | Auth, rate limiting, logging |

---

## Enhancement Details

### 1. HTTP Client Streaming

```typescript
// http-client.ts - Add SSE streaming
async *streamChat(prompt: string): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${this.baseUrl}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(this.timeout),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = parseSSE(buffer);
    buffer = events.remaining;

    for (const event of events.parsed) {
      yield event;
    }
  }
}
```

### 2. Streaming Event Types

```typescript
// types.ts
type StreamEvent =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'tool-call'; toolName: string; args: unknown }
  | { type: 'tool-result'; toolName: string; result: unknown }
  | { type: 'step-start'; stepIndex: number }
  | { type: 'step-finish'; stepIndex: number }
  | { type: 'finish'; text: string; usage: TokenUsage }
  | { type: 'error'; error: string };
```

### 3. Convenience Wrapper

```typescript
// client.ts
class ChatClient {
  async stream(prompt: string, callbacks: StreamCallbacks): Promise<void> {
    for await (const event of this.http.streamChat(prompt)) {
      switch (event.type) {
        case 'text-delta':
          callbacks.onTextDelta?.(event.textDelta);
          break;
        case 'tool-call':
          callbacks.onToolCall?.(event);
          break;
        // ... etc
      }
    }
  }
}
```

### 4. Server Response Helpers

```typescript
// routes.ts - Integrate with AI SDK
import { toUIMessageStreamResponse } from 'ai';

app.post('/stream', async (c) => {
  const { prompt } = await c.req.json();
  const result = agent.stream({ prompt });
  
  // If AI SDK compatible
  if (result.toDataStream) {
    return new Response(result.toDataStream(), {
      headers: { 'Content-Type': 'text/event-stream' }
    });
  }
  
  // Fallback to manual SSE
  return streamSSE(c, async (stream) => {
    for await (const chunk of result.fullStream) {
      await stream.writeSSE({ event: chunk.type, data: JSON.stringify(chunk) });
    }
  });
});
```

---

## Priority

### Phase 1: Essential (Week 1)
- [ ] HTTP client: SSE streaming with AsyncGenerator
- [ ] HTTP client: Timeout/abort handling
- [ ] Types: Full stream event types
- [ ] Server: AI SDK response integration

### Phase 2: Convenience (Week 2)
- [ ] Client: Callbacks wrapper
- [ ] Client: Session management
- [ ] Server: Middleware (auth, logging)
- [ ] Server: WebSocket support

### Phase 3: Polish (Week 3)
- [ ] Tests for client
- [ ] Tests for server
- [ ] Documentation
- [ ] Examples

---

## Files Impacted

### SDK-Client
- `src/http-client.ts` - Major enhancement
- `src/websocket-client.ts` - Add reconnection
- `src/client.ts` - Add convenience API
- `src/types.ts` - Full types
- `src/streaming.ts` - NEW: SSE parser
- `src/index.ts` - Update exports

### SDK-Server
- `src/routes.ts` - AI SDK integration
- `src/server.ts` - Minor updates
- `src/middleware.ts` - NEW: Auth, logging
- `src/types.ts` - Full types
- `src/index.ts` - Update exports

---

## References

- [AI SDK streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [AI SDK useChat](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [AI SDK Data Streams](https://ai-sdk.dev/docs/concepts/data-streams)
- [toUIMessageStreamResponse](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#touimessagestreamresponse)
