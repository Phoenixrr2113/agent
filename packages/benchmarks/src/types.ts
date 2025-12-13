import { z } from 'zod';

export const BenchmarkTaskSchema = z.object({
  id: z.string(),
  prompt: z.string().optional(),
  instruction: z.string().optional(),
  tools: z.array(z.any()).optional(),
  context: z.record(z.any()).optional(),
});

export type BenchmarkTask = z.infer<typeof BenchmarkTaskSchema>;

export interface BenchmarkResult {
  taskId: string;
  success: boolean;
  response: string;
  messages: Array<{ role: string; content: string }>;
  cost: number;
  durationMs: number;
  toolsUsed: string[];
  error?: string;
}

export interface HALTaskResult {
  history: Array<{ role: string; content: string }>;
  cost: number;
}

export type HALRunResult = Record<string, HALTaskResult>;

export interface TauBenchAction {
  type: 'message' | 'tool_call';
  content?: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export interface TauBenchMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
}

export interface BenchmarkConfig {
  benchmark: 'hal' | 'tau-bench' | 'swe-bench' | 'gaia';
  domain?: string;
  taskIds?: string[];
  maxConcurrency?: number;
  timeout?: number;
  outputPath?: string;
}

export interface BenchmarkRunner {
  run(config: BenchmarkConfig): Promise<BenchmarkResult[]>;
}

