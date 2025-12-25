import { logger } from '@agent/shared';
import { tool, zodSchema } from 'ai';
import { z } from 'zod';

export enum ToolErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PATH_NOT_IN_WORKSPACE = 'PATH_NOT_IN_WORKSPACE',
  PATH_IS_NOT_A_DIRECTORY = 'PATH_IS_NOT_A_DIRECTORY',
  PATH_IS_NOT_A_FILE = 'PATH_IS_NOT_A_FILE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TIMEOUT = 'TIMEOUT',
  INVALID_INPUT = 'INVALID_INPUT',
  COMMAND_BLOCKED = 'COMMAND_BLOCKED',
  CONTENT_TOO_LARGE = 'CONTENT_TOO_LARGE',
  OPERATION_FAILED = 'OPERATION_FAILED',
}

export class ToolError extends Error {
  constructor(
    message: string,
    public readonly type: ToolErrorType,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ToolError';
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      errorType: this.type,
      ...this.details,
    };
  }
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorType?: ToolErrorType;
}

export interface ToolLifecycle<TInput, TOutput> {
  beforeExecute?: (input: TInput) => Promise<TInput> | TInput;
  validate?: (input: TInput) => Promise<ValidationResult> | ValidationResult;
  afterExecute?: (input: TInput, output: TOutput) => Promise<TOutput> | TOutput;
  onError?: (error: Error, input: TInput) => Promise<TOutput | 'throw'> | TOutput | 'throw';
  cleanup?: (input: TInput, didSucceed: boolean) => Promise<void> | void;
}

export function withLifecycle<TInput, TOutput>(
  baseTool: any,
  hooks: Partial<ToolLifecycle<TInput, TOutput>>
): any {
  const originalExecute = baseTool.execute as (input: TInput) => Promise<TOutput>;

  return {
    ...baseTool,
    execute: async (input: TInput): Promise<TOutput> => {
      let processed = input;
      let didSucceed = false;

      try {
        if (hooks.beforeExecute) {
          processed = await hooks.beforeExecute(input);
        }

        if (hooks.validate) {
          const result = await hooks.validate(processed);
          if (!result.valid) {
            throw new ToolError(
              result.error ?? 'Validation failed',
              result.errorType ?? ToolErrorType.INVALID_INPUT
            );
          }
        }

        let output = await originalExecute(processed);

        if (hooks.afterExecute) {
          output = await hooks.afterExecute(processed, output);
        }

        didSucceed = true;
        return output;
      } catch (error) {
        if (hooks.onError) {
          const result = await hooks.onError(error as Error, processed);
          if (result !== 'throw') {
            didSucceed = true;
            return result;
          }
        }
        throw error;
      } finally {
        if (hooks.cleanup) {
          try {
            await hooks.cleanup(processed, didSucceed);
          } catch {
          }
        }
      }
    },
  };
}

export interface LifecycleToolConfig<TSchema extends z.ZodType, TOutput> {
  name: string;
  description: string;
  inputSchema: TSchema;
  lifecycle: ToolLifecycle<z.infer<TSchema>, TOutput> & {
    execute: (input: z.infer<TSchema>) => Promise<TOutput>;
  };
}

export function createLifecycleTool<TSchema extends z.ZodType, TOutput>(
  config: LifecycleToolConfig<TSchema, TOutput>
) {
  const { name, description, inputSchema, lifecycle } = config;

  return (tool as any)({
    description,
    inputSchema: zodSchema(inputSchema),
    execute: async (input: z.infer<TSchema>): Promise<TOutput> => {
      const startTime = performance.now();
      let processed = input;
      let didSucceed = false;

      logger.info(`⏱️  [${name}] Starting`, { args: input });

      try {
        if (lifecycle.beforeExecute) {
          processed = await lifecycle.beforeExecute(input);
        }

        if (lifecycle.validate) {
          const result = await lifecycle.validate(processed);
          if (!result.valid) {
            throw new ToolError(
              result.error ?? 'Validation failed',
              result.errorType ?? ToolErrorType.INVALID_INPUT
            );
          }
        }

        let output = await lifecycle.execute(processed);

        if (lifecycle.afterExecute) {
          output = await lifecycle.afterExecute(processed, output);
        }

        didSucceed = true;

        const durationMs = performance.now() - startTime;
        logger.info(`⏱️  [${name}] Completed`, {
          durationMs: durationMs.toFixed(2),
        });

        return output;
      } catch (error) {
        const durationMs = performance.now() - startTime;
        logger.error(`⏱️  [${name}] Failed`, {
          durationMs: durationMs.toFixed(2),
          error: String(error),
        });

        if (lifecycle.onError) {
          const result = await lifecycle.onError(error as Error, processed);
          if (result !== 'throw') {
            didSucceed = true;
            return result;
          }
        }
        throw error;
      } finally {
        if (lifecycle.cleanup) {
          try {
            await lifecycle.cleanup(processed, didSucceed);
          } catch {
          }
        }
      }
    },
  });
}

export function wrapWithTiming<TInput, TOutput>(
  name: string,
  fn: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    const startTime = performance.now();
    logger.info(`⏱️  [${name}] Starting`, { args: input });

    try {
      const result = await fn(input);
      const durationMs = performance.now() - startTime;
      logger.info(`⏱️  [${name}] Completed`, {
        durationMs: durationMs.toFixed(2),
        durationSec: (durationMs / 1000).toFixed(3),
      });
      return result;
    } catch (error) {
      const durationMs = performance.now() - startTime;
      logger.error(`⏱️  [${name}] Failed`, {
        durationMs: durationMs.toFixed(2),
        error: String(error),
      });
      throw error;
    }
  };
}
