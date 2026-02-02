/**
 * @agent/sdk-server - HTTP Routes
 * Hono routes for agent HTTP API with SSE streaming
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import type { AgentServerOptions } from './types';

/**
 * Request body for generate endpoint
 */
interface GenerateRequest {
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

/**
 * Request body for stream endpoint
 */
interface StreamRequest {
  prompt: string;
  options?: GenerateRequest['options'];
}

/**
 * Create agent HTTP routes with Hono
 * 
 * @param serverOptions - Server configuration options
 * @returns Hono app with agent routes
 */
export function createAgentRoutes(serverOptions: AgentServerOptions = {}) {
  const app = new Hono();

  // Configure CORS
  const corsOrigin = serverOptions.corsOrigin ?? '*';
  app.use('/*', cors({
    origin: Array.isArray(corsOrigin) ? corsOrigin : corsOrigin,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }));

  // Health check endpoint
  app.get('/health', (c) => c.json({ 
    status: 'ok', 
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  // Generate endpoint - synchronous completion
  app.post('/generate', async (c) => {
    try {
      const body = await c.req.json<GenerateRequest>();
      
      if (!body.prompt) {
        return c.json({ error: 'prompt is required' }, 400);
      }

      const agent = serverOptions.agent;
      if (!agent) {
        return c.json({ 
          error: 'Agent not configured. Provide agent or agentOptions to createAgentServer.',
        }, 500);
      }

      // Type assertion - agent should have generate method
      const agentInstance = agent as { 
        generate: (opts: { prompt: string; options?: unknown }) => Promise<{ text: string; steps: unknown[] }>;
      };

      const result = await agentInstance.generate({ 
        prompt: body.prompt, 
        options: body.options,
      });

      return c.json({ 
        text: result.text, 
        steps: result.steps?.length ?? 0,
        success: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message, success: false }, 500);
    }
  });

  // Stream endpoint - SSE streaming
  app.post('/stream', async (c) => {
    try {
      const body = await c.req.json<StreamRequest>();
      
      if (!body.prompt) {
        return c.json({ error: 'prompt is required' }, 400);
      }

      const agent = serverOptions.agent;
      if (!agent) {
        return c.json({ 
          error: 'Agent not configured. Provide agent or agentOptions to createAgentServer.',
        }, 500);
      }

      // Type assertion - agent should have stream method
      const agentInstance = agent as {
        stream: (opts: { prompt: string; options?: unknown }) => {
          fullStream: AsyncIterable<{ type: string; [key: string]: unknown }>;
          text: Promise<string>;
        };
      };

      return streamSSE(c, async (stream) => {
        try {
          const response = agentInstance.stream({ 
            prompt: body.prompt, 
            options: body.options,
          });

          for await (const chunk of response.fullStream) {
            await stream.writeSSE({ 
              event: chunk.type, 
              data: JSON.stringify(chunk),
            });
          }

          // Send final text
          const finalText = await response.text;
          await stream.writeSSE({ 
            event: 'done', 
            data: JSON.stringify({ text: finalText }),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Stream error';
          await stream.writeSSE({ 
            event: 'error', 
            data: JSON.stringify({ error: message }),
          });
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });

  // Chat endpoint (stateful with session)
  app.post('/chat', async (c) => {
    try {
      const body = await c.req.json<StreamRequest & { sessionId?: string }>();
      
      if (!body.prompt) {
        return c.json({ error: 'prompt is required' }, 400);
      }

      const agent = serverOptions.agent;
      if (!agent) {
        return c.json({ error: 'Agent not configured' }, 500);
      }

      // For stateful chat, we'd integrate with session management
      // For now, forward to stream endpoint behavior
      const agentInstance = agent as {
        stream: (opts: { prompt: string; options?: unknown }) => {
          fullStream: AsyncIterable<{ type: string; [key: string]: unknown }>;
          text: Promise<string>;
        };
      };

      return streamSSE(c, async (stream) => {
        const response = agentInstance.stream({ 
          prompt: body.prompt, 
          options: { ...body.options, sessionId: body.sessionId },
        });

        for await (const chunk of response.fullStream) {
          await stream.writeSSE({ 
            event: chunk.type, 
            data: JSON.stringify(chunk),
          });
        }

        await stream.writeSSE({ event: 'done', data: '' });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });

  return app;
}
