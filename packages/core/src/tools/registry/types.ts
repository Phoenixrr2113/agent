import { Tool } from 'ai';

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
