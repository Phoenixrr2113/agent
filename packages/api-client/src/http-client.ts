import type {
  AgentClientConfig,
  ChatRequest,
  ChatResponse,
  SessionResponse,
  HistoryResponse,
  HealthResponse,
} from './types';

export class AgentHttpClient {
  private baseUrl: string;
  private timeout: number;
  private onError?: (error: Error) => void;

  constructor(config: AgentClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 120000;
    this.onError = config.onError;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
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

    const response = await fetch(url, {
      headers: {
        Accept: 'text/event-stream',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            const event = line.slice(6).trim();
            const nextLine = lines[lines.indexOf(line) + 1];
            if (nextLine?.startsWith('data:')) {
              const data = nextLine.slice(5).trim();
              try {
                yield { event, data: JSON.parse(data) };
              } catch {
                yield { event, data };
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
