const API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:3000';

export interface Session {
  sessionId: string;
  createdAt: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string | ToolResultContent[];
}

export interface ToolResultContent {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
}

export interface ChatResponse {
  sessionId: string;
  traceId: string;
  status: string;
  message: string;
  streamUrl: string;
}

export type AgentStreamStatus =
  | 'thinking'
  | 'tool_calling'
  | 'tool_result'
  | 'responding'
  | 'complete'
  | 'error'
  | 'mobile_command';

export interface AgentStreamEvent {
  status: AgentStreamStatus;
  thought?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  step?: number;
  error?: string;
  response?: string;
}

export async function createSession(): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to create session: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    sessionId: data.sessionId,
    createdAt: new Date().toISOString(),
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete session: ${res.statusText}`);
  }
}

export async function getHistory(sessionId: string): Promise<Message[]> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/history`);
  if (!res.ok) {
    throw new Error(`Failed to get history: ${res.statusText}`);
  }
  const data = await res.json();
  return data.messages || [];
}

export async function clearHistory(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/clear`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to clear history: ${res.statusText}`);
  }
}

export async function sendMessage(sessionId: string, message: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    throw new Error(`Failed to send message: ${res.statusText}`);
  }
  return res.json();
}

export function subscribeToAgentStream(
  sessionId: string,
  onEvent: (event: AgentStreamEvent) => void,
  onError?: (error: Error) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/streams/agent/${sessionId}`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch (e) {
      console.error('Failed to parse SSE event:', e);
    }
  };

  eventSource.onerror = (event) => {
    console.error('SSE error:', event);
    onError?.(new Error('Stream connection error'));
  };

  return () => {
    eventSource.close();
  };
}
