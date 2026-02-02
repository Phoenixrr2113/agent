/**
 * @agent/sdk-server - Server Factory
 * Creates and manages the agent HTTP server
 */

import { serve } from '@hono/node-server';
import { createAgentRoutes } from './routes';
import type { AgentServerOptions } from './types';

export interface AgentServer {
  /** Hono routes instance */
  routes: ReturnType<typeof createAgentRoutes>;
  
  /** Start the HTTP server */
  start: () => void;
  
  /** Get the server port */
  port: number;
}

/**
 * Create an agent server with HTTP endpoints
 * 
 * @example
 * ```typescript
 * import { createAgentServer } from '@agent/sdk-server';
 * import { createAgent } from '@agent/sdk';
 * 
 * const agent = createAgent({ role: 'coder' });
 * const server = createAgentServer({ agent, port: 3001 });
 * server.start();
 * ```
 * 
 * @param options - Server configuration
 * @returns Server instance with routes and start method
 */
export function createAgentServer(options: AgentServerOptions = {}): AgentServer {
  const port = options.port ?? 3000;
  
  // Create agent if options provided but no agent instance
  let agent = options.agent;
  if (!agent && options.agentOptions) {
    // Dynamic import to avoid circular dependency
    // Agent creation deferred to runtime
    console.warn('agentOptions provided but no agent instance. Agent will need to be created separately.');
  }

  const routes = createAgentRoutes({
    ...options,
    agent,
  });

  const start = () => {
    serve({ 
      fetch: routes.fetch, 
      port,
    });
    console.log(`🤖 Agent server running on http://localhost:${port}`);
    console.log(`   POST /generate - Synchronous completion`);
    console.log(`   POST /stream   - SSE streaming`);
    console.log(`   POST /chat     - Stateful chat`);
    console.log(`   GET  /health   - Health check`);
  };

  return { 
    routes, 
    start,
    port,
  };
}

/**
 * Quick start helper - creates agent and server in one call
 * 
 * @example
 * ```typescript
 * import { quickStart } from '@agent/sdk-server';
 * 
 * quickStart({ port: 3001, role: 'researcher' });
 * ```
 */
export async function quickStart(options: {
  port?: number;
  role?: 'generic' | 'coder' | 'researcher' | 'analyst';
  workspaceRoot?: string;
} = {}) {
  // This would dynamically import @agent/sdk to avoid bundling issues
  // For now, provide a placeholder that logs instructions
  console.log('quickStart requires @agent/sdk to be configured.');
  console.log('Use createAgentServer with a pre-configured agent instead.');
  
  const server = createAgentServer({ port: options.port });
  server.start();
  return server;
}
