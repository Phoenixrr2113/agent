export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly responseBody?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
    responseBody?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    if (code !== undefined) {
      this.code = code;
    }
    if (responseBody !== undefined) {
      this.responseBody = responseBody;
    }
  }

  static fromResponse(status: number, body: string): ApiClientError {
    return new ApiClientError(`HTTP ${status}: ${body}`, status, undefined, body);
  }
}

export class WebSocketError extends Error {
  readonly code?: string;
  readonly reason?: string;

  constructor(message: string, code?: string, reason?: string) {
    super(message);
    this.name = 'WebSocketError';
    if (code !== undefined) {
      this.code = code;
    }
    if (reason !== undefined) {
      this.reason = reason;
    }
  }

  static connectionFailed(): WebSocketError {
    return new WebSocketError('WebSocket connection failed', 'CONNECTION_FAILED');
  }

  static messageParseFailed(originalError?: unknown): WebSocketError {
    const msg = originalError instanceof Error ? originalError.message : 'Unknown parse error';
    return new WebSocketError(`Failed to parse WebSocket message: ${msg}`, 'PARSE_ERROR');
  }

  static maxReconnectAttemptsReached(attempts: number): WebSocketError {
    return new WebSocketError(
      `Max reconnect attempts (${attempts}) reached`,
      'MAX_RECONNECT_ATTEMPTS'
    );
  }
}

