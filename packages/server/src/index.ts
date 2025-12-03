import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from root .env
config({ path: join(process.cwd(), '../../.env') });

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import { createAgentRuntime, type AgentSession, type TaskResult } from '@agent/core';
import { logger } from '@agent/shared';
import { WebSocketServer, WebSocket } from 'ws';

export interface ServerConfig {
  port?: number;
  workspaceRoot?: string;
  corsOrigin?: string | string[];
}

const sessions = new Map<string, AgentSession>();

export async function createServer(config: ServerConfig = {}) {
  const port = config.port || Number(process.env.PORT) || 3000;
  
  const runtime = await createAgentRuntime({
    workspaceRoot: config.workspaceRoot,
  });

  const app = new Hono();

  app.use('*', cors({
    origin: config.corsOrigin || '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }));

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.post('/sessions', (c) => {
    const sessionId = crypto.randomUUID();
    const session = runtime.createSession();
    sessions.set(sessionId, session);
    logger.info('Session created', { sessionId });
    return c.json({ sessionId });
  });

  app.delete('/sessions/:sessionId', (c) => {
    const sessionId = c.req.param('sessionId');
    if (!sessions.has(sessionId)) {
      return c.json({ error: 'Session not found' }, 404);
    }
    sessions.delete(sessionId);
    logger.info('Session deleted', { sessionId });
    return c.json({ success: true });
  });

  app.post('/sessions/:sessionId/chat', async (c) => {
    const requestStartTime = performance.now();
    const sessionId = c.req.param('sessionId');
    const session = sessions.get(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const body = await c.req.json<{ message: string }>();
    if (!body.message) {
      return c.json({ error: 'message is required' }, 400);
    }

    const result = await session.send(body.message);
    const requestDuration = performance.now() - requestStartTime;

    logger.info('HTTP request completed', {
      endpoint: '/sessions/:sessionId/chat',
      sessionId,
      durationMs: requestDuration.toFixed(2),
      durationSec: (requestDuration / 1000).toFixed(3),
    });

    return c.json({
      ...formatResult(result),
      _httpTiming: { totalRequestDurationMs: requestDuration.toFixed(2) },
    });
  });

  app.get('/sessions/:sessionId/chat/stream', async (c) => {
    const sessionId = c.req.param('sessionId');
    const session = sessions.get(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const message = c.req.query('message');
    if (!message) {
      return c.json({ error: 'message query param is required' }, 400);
    }

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: 'start', data: JSON.stringify({ sessionId }) });
      
      const result = await session.send(message);
      
      await stream.writeSSE({ 
        event: 'complete', 
        data: JSON.stringify(formatResult(result)) 
      });
    });
  });

  app.get('/sessions/:sessionId/history', (c) => {
    const sessionId = c.req.param('sessionId');
    const session = sessions.get(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    return c.json({ messages: session.getHistory() });
  });

  app.post('/sessions/:sessionId/clear', (c) => {
    const sessionId = c.req.param('sessionId');
    const session = sessions.get(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    session.clearHistory();
    return c.json({ success: true });
  });

  app.post('/chat', async (c) => {
    const requestStartTime = performance.now();
    const body = await c.req.json<{ message: string; sessionId?: string }>();
    if (!body.message) {
      return c.json({ error: 'message is required' }, 400);
    }

    let sessionId = body.sessionId;
    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session) {
      sessionId = crypto.randomUUID();
      session = runtime.createSession();
      sessions.set(sessionId, session);
    }

    const result = await session.send(body.message);
    const requestDuration = performance.now() - requestStartTime;

    logger.info('HTTP request completed', {
      endpoint: '/chat',
      sessionId,
      durationMs: requestDuration.toFixed(2),
      durationSec: (requestDuration / 1000).toFixed(3),
    });

    return c.json({
      sessionId,
      ...formatResult(result),
      _httpTiming: { totalRequestDurationMs: requestDuration.toFixed(2) },
    });
  });

  app.post('/mobile/command', async (c) => {
    const body = await c.req.json<{ type: string;[key: string]: any }>();
    if (!mobileClient) {
      return c.json({ error: 'Mobile client not connected' }, 400);
    }
    mobileClient.send(JSON.stringify(body));
    return c.json({ success: true });
  });

  return { app, runtime, port };
}

let mobileClient: WebSocket | null = null;

function formatResult(result: TaskResult) {
  return {
    text: result.text,
    completed: result.completed,
    needsInput: result.needsInput,
    pendingQuestion: result.pendingQuestion,
    stepsUsed: result.stepsUsed,
    toolsUsed: result.toolsUsed,
  };
}

export async function startServer(config: ServerConfig = {}) {
  logger.reconfigure();

  const { app, runtime, port } = await createServer(config);

  const server = serve({ fetch: app.fetch, port }, (info) => {
    logger.info(`🚀 Agent server running on http://localhost:${info.port}`);
  });

  const wss = new WebSocketServer({ server: server as any });

  wss.on('connection', (ws) => {
    logger.info('Mobile client connected');
    mobileClient = ws;

    ws.on('message', (message) => {
      logger.info('Received from mobile:', { message: message.toString() });
    });

    ws.on('close', () => {
      logger.info('Mobile client disconnected');
      mobileClient = null;
    });
  });

  const shutdown = async () => {
    logger.info('Shutting down server...');
    sessions.clear();
    await runtime.shutdown();
    server.close();
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  return { server, shutdown };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer({
    workspaceRoot: process.env.WORKSPACE_ROOT,
  }).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

