import type { Tool } from 'ai';
import type { MiddlewareContext, ToolMiddleware } from './types.js';

export { ToolActivationManager, createToolActivationManager } from './activation.js';
export { instrumentTool, instrumentTools, type InstrumentedToolResult } from './instrumentation.js';
export {
  ToolError,
  ToolErrorType,
  withLifecycle,
  wrapWithTiming,
  createLifecycleTool,
  type ToolLifecycle,
  type ValidationResult,
  type LifecycleToolConfig,
} from './lifecycle.js';
export type { ToolMiddleware, MiddlewareContext, ToolActivationManager as IToolActivationManager } from './types.js';

export function applyToolMiddleware(
  tools: Record<string, Tool>,
  middleware: ToolMiddleware[],
  context: MiddlewareContext = {}
): Record<string, Tool> {
  const result: Record<string, Tool> = {};

  for (const [name, tool] of Object.entries(tools)) {
    let wrappedTool = tool;

    for (const mw of middleware) {
      wrappedTool = mw.wrap(name, wrappedTool, context);
    }

    result[name] = wrappedTool;
  }

  return result;
}

export function createInstrumentationMiddleware(): ToolMiddleware {
  return {
    name: 'instrumentation',
    wrap(toolName, tool, _context) {
      if (!tool || typeof tool !== 'object' || !('execute' in tool)) {
        return tool;
      }

      const originalExecute = (tool as any).execute;

      return {
        ...tool,
        execute: async (args: any) => {
          const startTime = performance.now();

          try {
            const result = await originalExecute(args);
            const durationMs = performance.now() - startTime;

            if (typeof result === 'string') {
              try {
                const parsed = JSON.parse(result);
                parsed._timing = { durationMs: durationMs.toFixed(2), toolName };
                return JSON.stringify(parsed);
              } catch {
                return result;
              }
            }

            return result;
          } catch (error) {
            throw error;
          }
        },
      } as typeof tool;
    },
  };
}

export function createActivationMiddleware(
  activationManager: MiddlewareContext['activationManager'],
  deferredTools: Set<string>
): ToolMiddleware {
  return {
    name: 'activation',
    wrap(toolName, tool, _context) {
      if (!activationManager || !deferredTools.has(toolName)) {
        return tool;
      }

      const originalExecute = (tool as any).execute;

      return {
        ...tool,
        execute: async (args: any) => {
          if (!activationManager.isActive(toolName)) {
            return JSON.stringify({
              error: 'TOOL_NOT_ACTIVATED',
              message: `Tool "${toolName}" requires activation before use.`,
              instruction: `Please use the 'activate_tool' tool with toolName="${toolName}" to activate this tool, then try again.`,
              toolName,
            });
          }

          return await originalExecute(args);
        },
      } as typeof tool;
    },
  };
}
