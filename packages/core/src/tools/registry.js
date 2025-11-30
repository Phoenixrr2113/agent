import { tool, embed } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
export class ToolRegistry {
    tools = new Map();
    register(name, toolDef, options = {}) {
        const description = toolDef.description || options.description || '';
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
    registerMany(tools, defaultOptions = {}) {
        for (const [name, toolDef] of Object.entries(tools)) {
            this.register(name, toolDef, defaultOptions);
        }
    }
    unregister(name) {
        return this.tools.delete(name);
    }
    get(name) {
        return this.tools.get(name)?.tool;
    }
    getMetadata(name) {
        return this.tools.get(name)?.metadata;
    }
    getAll() {
        const result = {};
        for (const [name, { tool }] of this.tools) {
            result[name] = tool;
        }
        return result;
    }
    getActive() {
        const result = {};
        for (const [name, { tool, metadata }] of this.tools) {
            if (!metadata.deferLoading) {
                result[name] = tool;
            }
        }
        return result;
    }
    getDeferred() {
        const result = {};
        for (const [name, { tool, metadata }] of this.tools) {
            if (metadata.deferLoading) {
                result[name] = tool;
            }
        }
        return result;
    }
    search(query, options = {}) {
        const { limit = 10, includeDeferred = true } = options;
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/).filter(Boolean);
        const scored = [];
        for (const [, { metadata }] of this.tools) {
            if (!includeDeferred && metadata.deferLoading)
                continue;
            let score = 0;
            const nameLower = metadata.name.toLowerCase();
            const descLower = metadata.description.toLowerCase();
            const tagsLower = (metadata.tags || []).map(t => t.toLowerCase());
            for (const term of queryTerms) {
                if (nameLower.includes(term))
                    score += 10;
                if (nameLower === term)
                    score += 20;
                if (descLower.includes(term))
                    score += 5;
                for (const tag of tagsLower) {
                    if (tag.includes(term))
                        score += 8;
                    if (tag === term)
                        score += 15;
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
    async searchSemantic(query, options = {}) {
        const { limit = 10, includeDeferred = true, threshold = 0.3 } = options;
        const embeddingModel = google.embedding('text-embedding-004');
        const { embedding: queryEmbedding } = await embed({
            model: embeddingModel,
            value: query,
        });
        const scored = [];
        for (const [, registered] of this.tools) {
            if (!includeDeferred && registered.metadata.deferLoading)
                continue;
            if (!registered.embedding)
                continue;
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
    async generateEmbeddings() {
        const embeddingModel = google.embedding('text-embedding-004');
        for (const [name, registered] of this.tools) {
            if (registered.embedding)
                continue;
            const text = `${name}: ${registered.metadata.description} ${(registered.metadata.tags || []).join(' ')}`;
            const { embedding } = await embed({
                model: embeddingModel,
                value: text,
            });
            registered.embedding = embedding;
        }
    }
    hasEmbeddings() {
        for (const [, registered] of this.tools) {
            if (!registered.embedding)
                return false;
        }
        return this.tools.size > 0;
    }
    list() {
        return Array.from(this.tools.values()).map(({ metadata }) => metadata);
    }
    size() {
        return this.tools.size;
    }
    clear() {
        this.tools.clear();
    }
}
function cosineSimilarity(a, b) {
    if (a.length !== b.length)
        return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
export function createToolRegistry() {
    return new ToolRegistry();
}
export function createToolSearchTool(registry) {
    return tool({
        description: `Search for available tools by name, description, or functionality. Use this when you need to find a tool to accomplish a specific task. Returns matching tool names and descriptions. Supports both keyword and semantic search.`,
        inputSchema: z.object({
            query: z.string().describe('Search query describing the capability you need (e.g., "github", "file operations", "database")'),
            limit: z.number().optional().describe('Maximum number of results to return (default: 5)'),
            semantic: z.boolean().optional().describe('Use semantic/embedding-based search for better natural language understanding (default: true if embeddings available)'),
        }),
        execute: async ({ query, limit = 5, semantic }) => {
            const useSemanticSearch = semantic ?? registry.hasEmbeddings();
            let results;
            if (useSemanticSearch && registry.hasEmbeddings()) {
                results = await registry.searchSemantic(query, { limit, includeDeferred: true });
            }
            else {
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
            return JSON.stringify({
                found: true,
                count: results.length,
                searchType: useSemanticSearch ? 'semantic' : 'keyword',
                tools: results.map(m => ({
                    name: m.name,
                    description: m.description,
                    tags: m.tags,
                })),
            });
        },
    });
}
export function createActivateToolTool(registry, activeTools) {
    return tool({
        description: `Activate a deferred tool so you can use it. Call this after using search_tools to find a tool you need.`,
        inputSchema: z.object({
            toolName: z.string().describe('Name of the tool to activate'),
        }),
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async ({ toolName }) => {
            const toolDef = registry.get(toolName);
            if (!toolDef) {
                return JSON.stringify({
                    success: false,
                    error: `Tool "${toolName}" not found in registry`,
                });
            }
            activeTools.add(toolName);
            const metadata = registry.getMetadata(toolName);
            return JSON.stringify({
                success: true,
                message: `Tool "${toolName}" is now available for use`,
                tool: {
                    name: toolName,
                    description: metadata?.description,
                },
            });
        },
    });
}
