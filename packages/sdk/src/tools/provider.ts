/**
 * @agent/sdk - Tool Provider
 *
 * Central provider for creating and managing tool sets.
 * Adapted from packages/core/src/tools/provider.ts
 */

import type { Tool } from 'ai';
import { ToolFactory, type ToolDependencies, type ToolSet } from './factory';

// ============================================================================
// Core Tool Names
// ============================================================================

/**
 * Names of core tools that are always available.
 */
export const CORE_TOOL_NAMES = [
  'fs',
  'shell',
  'web',
  'memory',
  'delegate',
  'task',
  'plan',
  'validate',
  'reasoning',
] as const;

export type CoreToolName = (typeof CORE_TOOL_NAMES)[number];

// ============================================================================
// Tool Provider Configuration
// ============================================================================

export interface ToolProviderConfig {
  /** Workspace root directory */
  workspaceRoot?: string;
  /** Allowed directories for file operations */
  allowedDirectories?: string[];
  /** Enable tool execution instrumentation/logging */
  enableInstrumentation?: boolean;
  /** Enable dynamic tool activation/deactivation */
  enableActivation?: boolean;
  /** Custom tool dependencies */
  customDependencies?: Record<string, unknown>;
}

// ============================================================================
// Tool Activation Manager
// ============================================================================

export interface ToolActivationManager {
  /** Currently active tool names */
  activeTools: Set<string>;
  /** All available tool names */
  availableTools: Set<string>;

  /** Activate a tool */
  activate(name: string): boolean;
  /** Deactivate a tool */
  deactivate(name: string): boolean;
  /** Check if a tool is active */
  isActive(name: string): boolean;
  /** Get all active tools */
  getActiveTools(): string[];
  /** Set available tools */
  setAvailableTools(names: string[]): void;
}

/**
 * Create a tool activation manager.
 */
export function createToolActivationManager(): ToolActivationManager {
  const activeTools = new Set<string>();
  const availableTools = new Set<string>();

  return {
    activeTools,
    availableTools,

    activate(name: string): boolean {
      if (!availableTools.has(name)) {
        return false;
      }
      activeTools.add(name);
      return true;
    },

    deactivate(name: string): boolean {
      return activeTools.delete(name);
    },

    isActive(name: string): boolean {
      return activeTools.has(name);
    },

    getActiveTools(): string[] {
      return Array.from(activeTools);
    },

    setAvailableTools(names: string[]): void {
      availableTools.clear();
      for (const name of names) {
        availableTools.add(name);
        // Activate all by default
        activeTools.add(name);
      }
    },
  };
}

// ============================================================================
// Tool Registry
// ============================================================================

export interface ToolRegistryEntry {
  name: string;
  description: string;
  category: string;
  tags: string[];
}

export interface ToolRegistry {
  entries: Map<string, ToolRegistryEntry>;
  register(entry: ToolRegistryEntry): void;
  unregister(name: string): boolean;
  get(name: string): ToolRegistryEntry | undefined;
  search(query: string): ToolRegistryEntry[];
  listByCategory(category: string): ToolRegistryEntry[];
  listAll(): ToolRegistryEntry[];
}

/**
 * Create a tool registry for metadata and search.
 */
export function createToolRegistry(): ToolRegistry {
  const entries = new Map<string, ToolRegistryEntry>();

  return {
    entries,

    register(entry: ToolRegistryEntry): void {
      entries.set(entry.name, entry);
    },

    unregister(name: string): boolean {
      return entries.delete(name);
    },

    get(name: string): ToolRegistryEntry | undefined {
      return entries.get(name);
    },

    search(query: string): ToolRegistryEntry[] {
      const lowerQuery = query.toLowerCase();
      return Array.from(entries.values()).filter(
        (entry) =>
          entry.name.toLowerCase().includes(lowerQuery) ||
          entry.description.toLowerCase().includes(lowerQuery) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    },

    listByCategory(category: string): ToolRegistryEntry[] {
      return Array.from(entries.values()).filter(
        (entry) => entry.category === category
      );
    },

    listAll(): ToolRegistryEntry[] {
      return Array.from(entries.values());
    },
  };
}

// ============================================================================
// Tool Provider Result
// ============================================================================

export interface ToolProviderResult {
  /** All created tools */
  tools: ToolSet;
  /** Core tool names */
  coreToolNames: readonly string[];
  /** Activation manager instance */
  activationManager: ToolActivationManager;
  /** Registry instance */
  registry: ToolRegistry;
  /** Cleanup function */
  cleanup: () => Promise<void>;
}

// ============================================================================
// Tool Instrumentation
// ============================================================================

/**
 * Wrap tools with instrumentation for logging and metrics.
 */
export function instrumentTools(tools: ToolSet): ToolSet {
  const instrumented: ToolSet = {};

  for (const [name, tool] of Object.entries(tools)) {
    if (!tool.execute) {
      instrumented[name] = tool;
      continue;
    }

    const originalExecute = tool.execute;
    instrumented[name] = {
      ...tool,
      execute: async (input: unknown, options: unknown) => {
        const startTime = Date.now();
        try {
          const result = await originalExecute!(input, options as never);
          const duration = Date.now() - startTime;
          console.debug(`[tool:${name}] completed in ${duration}ms`);
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(`[tool:${name}] failed after ${duration}ms`, error);
          throw error;
        }
      },
    } as Tool;
  }

  return instrumented;
}

// ============================================================================
// Create All Tools
// ============================================================================

/**
 * Create all tools with the given configuration.
 *
 * @example
 * ```typescript
 * const { tools, cleanup } = await createAllTools({
 *   workspaceRoot: process.cwd(),
 *   enableInstrumentation: true,
 * });
 *
 * // Use tools...
 *
 * await cleanup();
 * ```
 */
export async function createAllTools(
  config: ToolProviderConfig = {}
): Promise<ToolProviderResult> {
  const {
    workspaceRoot = process.cwd(),
    allowedDirectories = [workspaceRoot],
    enableInstrumentation = true,
    enableActivation = false,
    customDependencies = {},
  } = config;

  const deps: ToolDependencies = {
    workspaceRoot,
    allowedDirectories,
    context: customDependencies,
  };

  const activationManager = createToolActivationManager();
  const registry = createToolRegistry();
  const factory = new ToolFactory();

  // Note: Individual tool creators will be registered by the tools themselves
  // when they are imported. For now, return an empty tool set that will be
  // populated when tools are migrated.
  let tools = factory.createAll(deps);

  // Set available tools in activation manager
  activationManager.setAvailableTools(Object.keys(tools));

  // Apply instrumentation if enabled
  if (enableInstrumentation) {
    tools = instrumentTools(tools);
  }

  const cleanup = async () => {
    // Cleanup logic (close connections, release resources, etc.)
    factory.clear();
  };

  return {
    tools,
    coreToolNames: CORE_TOOL_NAMES,
    activationManager,
    registry,
    cleanup,
  };
}

// ============================================================================
// Exports
// ============================================================================

export { ToolFactory, type ToolDependencies, type ToolSet } from './factory';
