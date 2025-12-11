import { Tool, embed } from 'ai';
import { getEmbeddingModel, cosineSimilarity } from '../../core/embeddings/index.js';
import type { ToolMetadata, RegisteredTool, ToolRegistrationOptions } from './types.js';

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
    for (const [name, { tool }] of Array.from(this.tools)) {
      result[name] = tool;
    }
    return result;
  }

  getActive(): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const [name, { tool, metadata }] of Array.from(this.tools)) {
      if (!metadata.deferLoading) {
        result[name] = tool;
      }
    }
    return result;
  }

  getDeferred(): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const [name, { tool, metadata }] of Array.from(this.tools)) {
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

    for (const [, { metadata }] of Array.from(this.tools)) {
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

    const embeddingModel = getEmbeddingModel();
    const { embedding: queryEmbedding } = await embed({
      model: embeddingModel,
      value: query,
    });

    const scored: Array<{ metadata: ToolMetadata; score: number }> = [];

    for (const [, registered] of Array.from(this.tools)) {
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
    const embeddingModel = getEmbeddingModel();

    for (const [name, registered] of Array.from(this.tools)) {
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
    for (const [, registered] of Array.from(this.tools)) {
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

export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}
