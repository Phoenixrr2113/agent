import { tool } from 'ai';
import { z } from 'zod';
import type { MCPClient } from './mcp-client.js';

function jsonSchemaToZod(schema: any): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') {
    return z.any();
  }

  if (schema.type === 'object') {
    const shape: Record<string, z.ZodTypeAny> = {};
    const properties = schema.properties || {};
    const required = new Set(schema.required || []);

    for (const [key, value] of Object.entries(properties)) {
      const propertySchema = value as any;
      let zodType: z.ZodTypeAny;

      switch (propertySchema.type) {
        case 'string':
          zodType = z.string();
          if (propertySchema.description) {
            zodType = zodType.describe(propertySchema.description);
          }
          break;
        case 'number':
        case 'integer':
          zodType = z.number();
          if (propertySchema.description) {
            zodType = zodType.describe(propertySchema.description);
          }
          break;
        case 'boolean':
          zodType = z.boolean();
          if (propertySchema.description) {
            zodType = zodType.describe(propertySchema.description);
          }
          break;
        case 'array':
          zodType = z.array(jsonSchemaToZod(propertySchema.items || {}));
          if (propertySchema.description) {
            zodType = zodType.describe(propertySchema.description);
          }
          break;
        case 'object':
          zodType = jsonSchemaToZod(propertySchema);
          break;
        default:
          zodType = z.any();
      }

      shape[key] = required.has(key) ? zodType : zodType.optional();
    }

    return z.object(shape);
  }

  return z.any();
}

export const mapMcpToolsToAiTools = (mcpTools: any[], client: MCPClient) => {
  const tools: any = {};
  for (const mcpTool of mcpTools) {
    const zodSchema = jsonSchemaToZod(mcpTool.inputSchema);

    tools[mcpTool.name] = tool({
      description: mcpTool.description || '',
      inputSchema: zodSchema,
      execute: async (args: any) => {
        try {
          const result = await client.callTool(mcpTool.name, args);
          return JSON.stringify(result.content);
        } catch (error: any) {
          return JSON.stringify({ error: error.message || 'Tool execution failed' });
        }
      },
    });
  }
  return tools;
};
