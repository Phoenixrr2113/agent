import { logger } from './logger.js';

export interface InstrumentedToolResult {
  result: any;
  timing: {
    startTime: number;
    endTime: number;
    durationMs: number;
  };
}

export function instrumentTool<TArgs = any, TResult = any>(
  toolName: string,
  execute: (args: TArgs) => Promise<TResult> | TResult
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs): Promise<TResult> => {
    const startTime = performance.now();

    logger.info(`⏱️  [${toolName}] Starting`, { args });

    try {
      const result = await execute(args);
      const endTime = performance.now();
      const durationMs = endTime - startTime;

      logger.info(`⏱️  [${toolName}] Completed`, {
        durationMs: durationMs.toFixed(2),
        durationSec: (durationMs / 1000).toFixed(3),
      });

      if (typeof result === 'string') {
        try {
          const parsed = JSON.parse(result);
          parsed._timing = { durationMs: durationMs.toFixed(2) };
          return JSON.stringify(parsed) as TResult;
        } catch {
          return result;
        }
      }

      return result;
    } catch (error) {
      const endTime = performance.now();
      const durationMs = endTime - startTime;

      logger.error(`⏱️  [${toolName}] Failed`, {
        durationMs: durationMs.toFixed(2),
        error: String(error),
      });

      throw error;
    }
  };
}

export function instrumentTools(tools: Record<string, any>): Record<string, any> {
  const instrumented: Record<string, any> = {};

  for (const [name, tool] of Object.entries(tools)) {
    if (tool && typeof tool === 'object' && 'execute' in tool) {
      instrumented[name] = {
        ...tool,
        execute: instrumentTool(name, tool.execute),
      };
    } else {
      instrumented[name] = tool;
    }
  }

  return instrumented;
}
