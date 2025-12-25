import type { Tool } from 'ai';

export interface ToolMiddleware {
  name: string;
  wrap<TArgs, TResult>(
    toolName: string,
    tool: Tool<TArgs, TResult>,
    context: MiddlewareContext
  ): Tool<TArgs, TResult>;
}

export interface MiddlewareContext {
  activationManager?: ToolActivationManager;
  profileManager?: ProfileManager;
  userId?: string;
}

export interface ToolActivationManager {
  isActive(toolName: string): boolean;
  activate(toolName: string): boolean;
  deactivate(toolName: string): boolean;
  getActiveToolNames(): string[];
  setAvailableTools(toolNames: string[]): void;
}

export interface ProfileManager {
  getRemindersForTool(userId: string, toolName: string, action?: string): Promise<string[]>;
}
