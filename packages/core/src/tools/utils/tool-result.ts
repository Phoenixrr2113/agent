export interface ToolSuccess<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export interface ToolError {
  success: false;
  error: string;
  code?: string;
  context?: Record<string, unknown>;
}

export type ToolResult<T = unknown> = ToolSuccess<T> | ToolError;

export function success<T extends Record<string, unknown>>(
  data?: T,
  message?: string
): string {
  const result: ToolSuccess<T> = { success: true };
  if (data) {
    Object.assign(result, data);
  }
  if (message) {
    result.message = message;
  }
  return JSON.stringify(result);
}

export function error(
  err: Error | string,
  context?: Record<string, unknown>
): string {
  const message = err instanceof Error ? err.message : err;
  const result: ToolError = { success: false, error: message };
  if (context) {
    Object.assign(result, context);
  }
  return JSON.stringify(result);
}

export function withTiming<T extends Record<string, unknown>>(
  result: T,
  startTime: number
): T & { _timing: { durationMs: string } } {
  return {
    ...result,
    _timing: { durationMs: (performance.now() - startTime).toFixed(2) },
  };
}

export async function safeTool<T extends Record<string, unknown>>(
  function_: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<string> {
  try {
    const result = await function_();
    return success(result);
  } catch (error_) {
    return error(error_ as Error, context);
  }
}

export function safeToolSync<T extends Record<string, unknown>>(
  function_: () => T,
  context?: Record<string, unknown>
): string {
  try {
    const result = function_();
    return success(result);
  } catch (error_) {
    return error(error_ as Error, context);
  }
}
