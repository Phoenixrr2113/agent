// HTTP client for agent server

import { ApiClientError } from './errors';
import type { ChatRequest, ChatResponse, SessionResponse, HistoryResponse } from './types';

export class AgentHttpClient {
  constructor(private baseUrl: string) {}

  async generate(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new ApiClientError('Generate failed', response.status);
    }
    return response.json();
  }

  async getSession(sessionId: string): Promise<SessionResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`);
    if (!response.ok) {
      throw new ApiClientError('Session not found', response.status);
    }
    return response.json();
  }

  async getHistory(sessionId: string): Promise<HistoryResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/history`);
    if (!response.ok) {
      throw new ApiClientError('History not found', response.status);
    }
    return response.json();
  }
}
