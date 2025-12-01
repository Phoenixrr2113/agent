import { tool, type Tool, embed } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export interface ToolMetadata {
  name: string;
  description: string;
  tags?: string[];
  deferLoading?: boolean;
  examples?: Array<Record<string, unknown>>;
}

export interface RegisteredTool {
  tool: Tool;
  metadata: ToolMetadata;
  embedding?: number[];
}

export interface ToolRegistrationOptions {
  description?: string;
  tags?: string[];
  deferLoading?: boolean;
  examples?: Array<Record<string, unknown>>;
}

function extractSchemaDescription(toolDef: Tool): string {
  try {
    const inputSchema = (toolDef as any).inputSchema;
    if (!inputSchema) return '';

    const shape = inputSchema._def?.shape?.();
    if (!shape) return '';

    const params: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      const zodField = value as any;
      const desc = zodField._def?.description || '';
      const typeName = zodField._def?.typeName || 'unknown';

      if (desc) {
        params.push(`${key} (${typeName}): ${desc}`);
      } else {
        params.push(`${key} (${typeName})`);
      }
    }

    return params.length > 0 ? `Parameters: ${params.join(', ')}` : '';
  } catch {
    return '';
  }
}

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  register(name: string, toolDef: Tool, options: ToolRegistrationOptions = {}): void {
    const description = (toolDef as any).description || options.description || '';
    this.tools.set(name, {
      tool: toolDef,
      metadata: {
        name,
        description,
        tags: options.tags,
        deferLoading: options.deferLoading ?? false,
        examples: options.examples,
      },
    });
  }

  registerMany(tools: Record<string, Tool>, defaultOptions: ToolRegistrationOptions = {}): void {
    for (const [name, toolDef] of Object.entries(tools)) {
      this.register(name, toolDef, defaultOptions);
    }
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)?.tool;
  }

  getMetadata(name: string): ToolMetadata | undefined {
    return this.tools.get(name)?.metadata;
  }

  getAll(): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const [name, { tool }] of this.tools) {
      result[name] = tool;
    }
    return result;
  }

  getActive(): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const [name, { tool, metadata }] of this.tools) {
      if (!metadata.deferLoading) {
        result[name] = tool;
      }
    }
    return result;
  }

  getDeferred(): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const [name, { tool, metadata }] of this.tools) {
      if (metadata.deferLoading) {
        result[name] = tool;
      }
    }
    return result;
  }

  search(query: string, options: { limit?: number; includeDeferred?: boolean } = {}): ToolMetadata[] {
    const { limit = 10, includeDeferred = true } = options;
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(Boolean);

    const scored: Array<{ metadata: ToolMetadata; score: number }> = [];

    for (const [, { metadata }] of this.tools) {
      if (!includeDeferred && metadata.deferLoading) continue;

      let score = 0;
      const nameLower = metadata.name.toLowerCase();
      const descLower = metadata.description.toLowerCase();
      const tagsLower = (metadata.tags || []).map(t => t.toLowerCase());

      for (const term of queryTerms) {
        if (nameLower.includes(term)) score += 10;
        if (nameLower === term) score += 20;
        if (descLower.includes(term)) score += 5;
        for (const tag of tagsLower) {
          if (tag.includes(term)) score += 8;
          if (tag === term) score += 15;
        }
      }

      if (score > 0) {
        scored.push({ metadata, score });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.metadata);
  }

  async searchSemantic(
    query: string,
    options: { limit?: number; includeDeferred?: boolean; threshold?: number } = {}
  ): Promise<ToolMetadata[]> {
    const { limit = 10, includeDeferred = true, threshold = 0.3 } = options;

    const embeddingModel = google.embedding('text-embedding-004');
    const { embedding: queryEmbedding } = await embed({
      model: embeddingModel as any,
      value: query,
    });

    const scored: Array<{ metadata: ToolMetadata; score: number }> = [];

    for (const [, registered] of this.tools) {
      if (!includeDeferred && registered.metadata.deferLoading) continue;
      if (!registered.embedding) continue;

      const similarity = cosineSimilarity(queryEmbedding, registered.embedding);
      if (similarity >= threshold) {
        scored.push({ metadata: registered.metadata, score: similarity });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.metadata);
  }

  async generateEmbeddings(): Promise<void> {
    const embeddingModel = google.embedding('text-embedding-004');

    for (const [name, registered] of this.tools) {
      if (registered.embedding) continue;

      const parts: string[] = [
        `${name}: ${registered.metadata.description}`,
      ];

      if (registered.metadata.tags && registered.metadata.tags.length > 0) {
        parts.push(`Tags: ${registered.metadata.tags.join(', ')}`);
      }

      const paramDesc = extractSchemaDescription(registered.tool);
      if (paramDesc) {
        parts.push(paramDesc);
      }

      if (registered.metadata.examples && registered.metadata.examples.length > 0) {
        const exampleTexts = registered.metadata.examples
          .map(ex => JSON.stringify(ex))
          .join('; ');
        parts.push(`Examples: ${exampleTexts}`);
      }

      const text = parts.join('. ');

      const { embedding } = await embed({
        model: embeddingModel as any,
        value: text,
      });
      registered.embedding = embedding;
    }
  }

  hasEmbeddings(): boolean {
    for (const [, registered] of this.tools) {
      if (!registered.embedding) return false;
    }
    return this.tools.size > 0;
  }

  list(): ToolMetadata[] {
    return Array.from(this.tools.values()).map(({ metadata }) => metadata);
  }

  size(): number {
    return this.tools.size;
  }

  clear(): void {
    this.tools.clear();
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}

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
    description: `Activate a deferred tool so you can use it. Call this after using search_tools to find a tool you need. Only deferred tools require activation - active tools are always available.`,
    inputSchema: z.object({
      toolName: z.string().describe('Name of the tool to activate'),
    }),
    // eslint-disable-next-line @typescript-eslint/require-await
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

