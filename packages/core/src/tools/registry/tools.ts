import { tool } from 'ai';
import { z } from 'zod';
import type { ToolRegistry } from './registry.js';
import type { ToolMetadata } from './types.js';

export function createToolSearchTool(registry: ToolRegistry, activationManager?: any) {
  return tool({
    description: `Search for available tools by name, description, or functionality. Use this when you need to find a tool to accomplish a specific task. Returns matching tool names and descriptions, and indicates which tools require activation. Supports both keyword and semantic search.`,
    inputSchema: z.object({
      query: z.string().describe('Search query describing the capability you need (e.g., "github", "file operations", "database")'),
      limit: z.number().optional().describe('Maximum number of results to return (default: 5)'),
      semantic: z.boolean().optional().describe('Use semantic/embedding-based search for better natural language understanding (default: true if embeddings available)'),
    }),
    execute: async ({ query, limit = 5, semantic }: { query: string; limit?: number; semantic?: boolean }) => {
      const useSemanticSearch = semantic ?? registry.hasEmbeddings();

      let results: ToolMetadata[];
      if (useSemanticSearch && registry.hasEmbeddings()) {
        results = await registry.searchSemantic(query, { limit, includeDeferred: true });
      } else {
        results = registry.search(query, { limit, includeDeferred: true });
      }

      if (results.length === 0) {
        return JSON.stringify({
          found: false,
          message: `No tools found matching "${query}". Try different keywords.`,
          availableCount: registry.size(),
          searchType: useSemanticSearch ? 'semantic' : 'keyword',
        });
      }

      const activeTools = results.filter(m => !m.deferLoading);
      const deferredTools = results.filter(m => m.deferLoading);

      return JSON.stringify({
        found: true,
        count: results.length,
        searchType: useSemanticSearch ? 'semantic' : 'keyword',
        tools: results.map(m => ({
          name: m.name,
          description: m.description,
          tags: m.tags,
          requiresActivation: m.deferLoading,
          isActivated: activationManager ? activationManager.isActive(m.name) : false,
        })),
        summary: {
          activeTools: activeTools.length,
          deferredTools: deferredTools.length,
          message: deferredTools.length > 0
            ? `Found ${deferredTools.length} specialized tool(s) that require activation using 'activate_tool'.`
            : 'All found tools are immediately available.',
        },
      });
    },
  });
}

export function createActivateToolTool(
  registry: ToolRegistry,
  activationManager: any
) {
  return tool({
    description: `Activate a deferred tool so you can use it. Call this after using tool_search to find a tool you need. Only deferred tools require activation - active tools are always available.`,
    inputSchema: z.object({
      toolName: z.string().describe('Name of the tool to activate'),
    }),
    execute: async ({ toolName }: { toolName: string }) => {
      const toolDef = registry.get(toolName);
      if (!toolDef) {
        return JSON.stringify({
          success: false,
          error: `Tool "${toolName}" not found in registry`,
          availableTools: registry.list().map(t => t.name),
        });
      }

      const metadata = registry.getMetadata(toolName);

      if (!metadata?.deferLoading) {
        return JSON.stringify({
          success: false,
          error: `Tool "${toolName}" is already active and does not require activation`,
          message: 'This tool is always available. You can use it directly without activation.',
        });
      }

      const wasActivated = activationManager.activate(toolName);

      return JSON.stringify({
        success: true,
        message: wasActivated
          ? `Tool "${toolName}" is now activated and ready to use`
          : `Tool "${toolName}" was already activated`,
        tool: {
          name: toolName,
          description: metadata?.description,
          tags: metadata?.tags,
        },
        activeToolsCount: activationManager.size(),
      });
    },
  });
}

export function createDeactivateToolTool(
  registry: ToolRegistry,
  activationManager: any
) {
  return tool({
    description: `Deactivate a specialized tool to free up context space. Use this when you're done with a tool and want to make room for others. Only deferred tools can be deactivated.`,
    inputSchema: z.object({
      toolName: z.string().describe('Name of the tool to deactivate'),
    }),
    execute: async ({ toolName }: { toolName: string }) => {
      const toolDef = registry.get(toolName);
      if (!toolDef) {
        return JSON.stringify({
          success: false,
          error: `Tool "${toolName}" not found in registry`,
        });
      }

      const metadata = registry.getMetadata(toolName);

      if (!metadata?.deferLoading) {
        return JSON.stringify({
          success: false,
          error: `Tool "${toolName}" is always active and cannot be deactivated`,
          message: 'Core tools like shell, plan, etc. are always available.',
        });
      }

      if (!activationManager.isActive(toolName)) {
        return JSON.stringify({
          success: false,
          error: `Tool "${toolName}" is not currently activated`,
          message: 'Tool was never activated or already deactivated.',
        });
      }

      const wasDeactivated = activationManager.deactivate(toolName);

      return JSON.stringify({
        success: true,
        message: wasDeactivated
          ? `Tool "${toolName}" has been deactivated`
          : `Tool "${toolName}" was already deactivated`,
        activeToolsCount: activationManager.size(),
        activeTools: activationManager.getActiveToolNames(),
      });
    },
  });
}
