/**
 * @agent/sdk - Tool Factory
 *
 * Factory pattern for creating tool sets with dependency injection.
 * Adapted from packages/core/src/tools/factory.ts
 */

import type { Tool } from 'ai';

// ============================================================================
// Types
// ============================================================================

/**
 * Dependencies that can be injected into tool creators.
 */
export interface ToolDependencies {
  /** Workspace root directory for file operations */
  workspaceRoot?: string;
  /** Directories the agent is allowed to access */
  allowedDirectories?: string[];
  /** Optional UI stream writer for transient data */
  streamWriter?: unknown;
  /** Optional memory store instance */
  memoryStore?: unknown;
  /** Custom context data */
  context?: Record<string, unknown>;
}

/**
 * A set of tools keyed by name.
 */
export type ToolSet = Record<string, Tool>;

/**
 * Function that creates a set of tools given dependencies.
 */
export type ToolCreator = (deps: ToolDependencies) => ToolSet;

// ============================================================================
// Tool Factory Class
// ============================================================================

/**
 * Factory for registering and creating tools with dependency injection.
 *
 * @example
 * ```typescript
 * const factory = new ToolFactory();
 *
 * factory.register('filesystem', (deps) => ({
 *   readFile: createReadFileTool(deps.workspaceRoot),
 *   writeFile: createWriteFileTool(deps.workspaceRoot),
 * }));
 *
 * const tools = factory.createAll({ workspaceRoot: '/my/project' });
 * ```
 */
export class ToolFactory {
  private factories = new Map<string, ToolCreator>();
  private creationErrors: Array<{ name: string; error: string }> = [];

  /**
   * Register a tool creator function.
   */
  register(name: string, creator: ToolCreator): void {
    this.factories.set(name, creator);
  }

  /**
   * Unregister a tool creator.
   */
  unregister(name: string): boolean {
    return this.factories.delete(name);
  }

  /**
   * Check if a tool creator is registered.
   */
  has(name: string): boolean {
    return this.factories.has(name);
  }

  /**
   * Get all registered tool creator names.
   */
  getRegisteredNames(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Create tools from a single registered creator.
   */
  create(name: string, deps: ToolDependencies): ToolSet | null {
    const creator = this.factories.get(name);
    if (!creator) {
      return null;
    }
    try {
      return creator(deps);
    } catch (error) {
      this.creationErrors.push({
        name,
        error: String(error),
      });
      return null;
    }
  }

  /**
   * Create all registered tools.
   */
  createAll(deps: ToolDependencies): ToolSet {
    const allTools: ToolSet = {};
    this.creationErrors = [];

    for (const [name, creator] of this.factories.entries()) {
      try {
        const tools = creator(deps);
        Object.assign(allTools, tools);
      } catch (error) {
        this.creationErrors.push({
          name,
          error: String(error),
        });
        // Continue creating other tools even if one fails
      }
    }

    return allTools;
  }

  /**
   * Create selected tools by name.
   */
  createSelected(names: string[], deps: ToolDependencies): ToolSet {
    const allTools: ToolSet = {};
    this.creationErrors = [];

    for (const name of names) {
      const creator = this.factories.get(name);
      if (!creator) {
        continue;
      }
      try {
        const tools = creator(deps);
        Object.assign(allTools, tools);
      } catch (error) {
        this.creationErrors.push({
          name,
          error: String(error),
        });
      }
    }

    return allTools;
  }

  /**
   * Get errors from the last creation operation.
   */
  getLastErrors(): Array<{ name: string; error: string }> {
    return [...this.creationErrors];
  }

  /**
   * Clear all registered factories.
   */
  clear(): void {
    this.factories.clear();
    this.creationErrors = [];
  }
}

// ============================================================================
// Default Factory Instance
// ============================================================================

/**
 * Default tool factory instance for convenience.
 */
export const defaultToolFactory = new ToolFactory();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Merge multiple tool sets into one.
 */
export function mergeToolSets(...toolSets: ToolSet[]): ToolSet {
  return Object.assign({}, ...toolSets);
}

/**
 * Filter a tool set to only include specified tools.
 */
export function filterTools(tools: ToolSet, include: string[]): ToolSet {
  const includeSet = new Set(include);
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => includeSet.has(name))
  );
}

/**
 * Exclude specified tools from a tool set.
 */
export function excludeTools(tools: ToolSet, exclude: string[]): ToolSet {
  const excludeSet = new Set(exclude);
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => !excludeSet.has(name))
  );
}

/**
 * Get tool names from a tool set.
 */
export function getToolNames(tools: ToolSet): string[] {
  return Object.keys(tools);
}
