import { tool, type Tool } from 'ai';
import { z } from 'zod';

export interface ToolActivationCallbacks {
  onActivate?: (toolName: string, allActiveTools: string[]) => void | Promise<void>;
  onDeactivate?: (toolName: string, allActiveTools: string[]) => void | Promise<void>;
}

export interface ToolActivationManagerOptions {
  initialActiveTools?: string[];
  callbacks?: ToolActivationCallbacks;
}

export class ToolActivationManager {
  private activeTools: Set<string> = new Set();
  private wrappedTools: Map<string, { original: Tool; wrapped: Tool }> = new Map();
  private callbacks: ToolActivationCallbacks;

  constructor(options: ToolActivationManagerOptions = {}) {
    this.callbacks = options.callbacks || {};
    if (options.initialActiveTools) {
      for (const toolName of options.initialActiveTools) {
        this.activeTools.add(toolName);
      }
    }
  }

  isActive(toolName: string): boolean {
    return this.activeTools.has(toolName);
  }

  activate(toolName: string): boolean {
    if (this.activeTools.has(toolName)) {
      return false;
    }
    this.activeTools.add(toolName);
    if (this.callbacks.onActivate) {
      void Promise.resolve(this.callbacks.onActivate(toolName, this.getActiveToolNames()));
    }
    return true;
  }

  deactivate(toolName: string): boolean {
    const wasDeleted = this.activeTools.delete(toolName);
    if (wasDeleted && this.callbacks.onDeactivate) {
      void Promise.resolve(this.callbacks.onDeactivate(toolName, this.getActiveToolNames()));
    }
    return wasDeleted;
  }

  getActiveToolNames(): string[] {
    return Array.from(this.activeTools);
  }

  createDeferredWrapper(toolName: string, originalTool: Tool, description: string): Tool {
    const inputSchema = (originalTool as any).inputSchema || z.object({});

    const wrappedTool = tool({
      description: `${description} (Note: This tool requires activation. Use 'activate_tool' first if you haven't already.)`,
      inputSchema,
      execute: async (args: any) => {
        if (!this.isActive(toolName)) {
          return JSON.stringify({
            error: 'TOOL_NOT_ACTIVATED',
            message: `Tool "${toolName}" requires activation before use.`,
            instruction: `Please use the 'activate_tool' tool with toolName="${toolName}" to activate this tool, then try again.`,
            toolName,
          });
        }

        return await (originalTool as any).execute(args);
      },
    });

    this.wrappedTools.set(toolName, { original: originalTool, wrapped: wrappedTool });
    return wrappedTool;
  }

  clear(): void {
    this.activeTools.clear();
    this.wrappedTools.clear();
  }

  size(): number {
    return this.activeTools.size;
  }
}

export function createToolActivationManager(options: ToolActivationManagerOptions = {}): ToolActivationManager {
  return new ToolActivationManager(options);
}
