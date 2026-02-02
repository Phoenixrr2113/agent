/**
 * @agent/sdk-server - Type Definitions
 */

import type { AgentOptions } from '@agent/sdk';

/**
 * Options for creating an agent server
 */
export interface AgentServerOptions {
  /** Pre-configured agent instance */
  agent?: AgentInstance;
  
  /** Options to create a new agent (alternative to passing agent) */
  agentOptions?: AgentOptions;
  
  /** HTTP server port (default: 3000) */
  port?: number;
  
  /** CORS allowed origins (default: '*') */
  corsOrigin?: string | string[];
  
  /** Enable request logging */
  enableLogging?: boolean;
}

/**
 * Agent instance interface (minimal contract)
 * Full typing comes from @agent/sdk
 */
export interface AgentInstance {
  generate: (opts: GenerateOptions) => Promise<GenerateResult>;
  stream: (opts: GenerateOptions) => StreamResult;
}

export interface GenerateOptions {
  prompt: string;
  options?: {
    userId?: string;
    sessionId?: string;
    complexity?: 'simple' | 'complex';
    role?: 'coder' | 'researcher' | 'analyst';
    enabledTools?: string[];
    workspaceRoot?: string;
  };
}

export interface GenerateResult {
  text: string;
  steps: unknown[];
}

export interface StreamResult {
  fullStream: AsyncIterable<StreamChunk>;
  text: Promise<string>;
}

export interface StreamChunk {
  type: string;
  [key: string]: unknown;
}
