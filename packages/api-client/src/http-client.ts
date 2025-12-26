import type {
  AgentClientConfig,
  ChatRequest,
  ChatResponse,
  SessionResponse,
  HistoryResponse,
  HealthResponse,
  StreamingChatCallbacks,
} from './types';
import { ApiClientError } from './errors';

export class AgentHttpClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;
  private onError?: (error: Error) => void;

  constructor(config: AgentClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 120000;
    if (config.apiKey !== undefined) {
      this.apiKey = config.apiKey;
    }
    if (config.onError !== undefined) {
      this.onError = config.onError;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const init: RequestInit = {
        method,
        headers: this.getHeaders(),
        signal: controller.signal,
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }
      const response = await fetch(`${this.baseUrl}${path}`, init);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw ApiClientError.fromResponse(response.status, errorText);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.onError?.(err);
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }

  async createSession(): Promise<SessionResponse> {
    return this.request<SessionResponse>('POST', '/sessions');
  }

  async createApiKey(name: string): Promise<{ key: string; name: string; message: string }> {
    return this.request<{ key: string; name: string; message: string }>('POST', '/api-keys', { name });
  }

  async deleteSession(sessionId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('DELETE', `/sessions/${sessionId}`);
  }

  async chat(sessionId: string, message: string): Promise<ChatResponse> {
    return this.request<ChatResponse>('POST', `/sessions/${sessionId}/chat`, {
      message,
    });
  }

  async chatConvenience(request: ChatRequest): Promise<ChatResponse & { sessionId: string }> {
    const response = await this.request<ChatResponse>('POST', '/chat', request);
    return {
      ...response,
      sessionId: request.sessionId ?? '',
    };
  }

  async getHistory(sessionId: string): Promise<HistoryResponse> {
    return this.request<HistoryResponse>('GET', `/sessions/${sessionId}/history`);
  }

  async clearHistory(sessionId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('POST', `/sessions/${sessionId}/clear`);
  }

  async *chatStream(
    sessionId: string,
    message: string
  ): AsyncGenerator<{ event: string; data: unknown }, void, unknown> {
    const url = `${this.baseUrl}/sessions/${sessionId}/chat/stream?message=${encodeURIComponent(message)}`;

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw ApiClientError.fromResponse(response.status, errorText);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      const lines = text.split('\n');
      let currentEvent: string | null = null;
      
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:') && currentEvent !== null) {
          const dataStr = line.slice(5).trim();
          let data: unknown;
          try {
            data = JSON.parse(dataStr);
          } catch {
            data = dataStr;
          }
          yield { event: currentEvent, data };
          currentEvent = null;
        } else if (line === '') {
          currentEvent = null;
        }
      }
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent: string | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:') && currentEvent !== null) {
            const dataStr = line.slice(5).trim();
            let data: unknown;
            try {
              data = JSON.parse(dataStr);
            } catch {
              data = dataStr;
            }
            yield { event: currentEvent, data };
            currentEvent = null;
          } else if (line === '') {
            currentEvent = null;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async chatStreamWithCallbacks(
    sessionId: string,
    message: string,
    callbacks: StreamingChatCallbacks
  ): Promise<void> {
    for await (const { event, data } of this.chatStream(sessionId, message)) {
      switch (event) {
        case 'session:start':
          callbacks.onSessionStart?.(data as { sessionId: string });
          break;
        case 'step:start':
          callbacks.onStepStart?.(data as { stepIndex: number });
          break;
        case 'step:finish':
          callbacks.onStepFinish?.(data as { stepIndex: number; durationMs: number });
          break;
        case 'text:delta':
          callbacks.onTextDelta?.(data as { delta: string; stepIndex: number });
          break;
        case 'reasoning:delta':
          callbacks.onReasoningDelta?.(data as { delta: string; stepIndex: number });
          break;
        case 'tool:call':
          callbacks.onToolCall?.(data as {
            toolCallId: string;
            toolName: string;
            args: Record<string, unknown>;
            stepIndex: number;
          });
          break;
        case 'tool:result':
          callbacks.onToolResult?.(data as {
            toolCallId: string;
            toolName: string;
            result: unknown;
            durationMs: number;
            stepIndex: number;
          });
          break;
        case 'complete':
          callbacks.onComplete?.(data as {
            text: string;
            completed: boolean;
            needsInput: boolean;
            pendingQuestion?: string;
            stepsUsed: number;
            toolsUsed: string[];
          });
          break;
        case 'error':
          callbacks.onError?.(data as { message: string; code?: string });
          break;
      }
    }
  }
}
