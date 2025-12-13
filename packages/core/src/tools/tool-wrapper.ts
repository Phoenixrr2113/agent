import { tool, type Tool } from 'ai';
import { z } from 'zod';

export class ToolActivationManager {
  private activeTools = new Set<string>();
  private wrappedTools = new Map<string, { original: Tool; wrapped: Tool }>();
  private availableTools = new Set<string>();

  isActive(toolName: string): boolean {
    return this.activeTools.has(toolName);
  }

  setAvailableTools(toolNames: string[]): void {
    this.availableTools = new Set(toolNames);
  }

  activate(toolName: string): boolean {
    if (this.activeTools.has(toolName)) {
      return false;
    }
    if (this.availableTools.size > 0 && !this.availableTools.has(toolName)) {
      throw new Error(`Cannot activate unknown tool: "${toolName}". Tool not found in registry.`);
    }
    this.activeTools.add(toolName);
    return true;
  }

  deactivate(toolName: string): boolean {
    return this.activeTools.delete(toolName);
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

export function createToolActivationManager(): ToolActivationManager {
  return new ToolActivationManager();
}
