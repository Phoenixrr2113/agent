// Error classes

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export class WebSocketError extends Error {
  constructor(
    message: string,
    public readonly code?: number
  ) {
    super(message);
    this.name = 'WebSocketError';
  }
}
