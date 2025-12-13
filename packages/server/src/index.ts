import { type Server } from 'node:http'
import { join } from 'node:path'

import { createAgentRuntime, type AgentSession, type AgentRuntime, type TaskResult } from '@agent/core'
import { logger } from '@agent/shared'
import type { DeviceAction, DeviceCapabilities, ActionResult } from '@agent/shared'
import { serve } from '@hono/node-server'
import { config } from 'dotenv'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { WebSocketServer, type WebSocket } from 'ws'

import { DeviceRegistry } from './devices/index.js'

// Load environment variables from root .env
config({ path: join(process.cwd(), '../../.env') });

export interface ServerConfig {
  port?: number;
  workspaceRoot?: string;
  corsOrigin?: string | string[];
}

const sessions = new Map<string, AgentSession>()
const deviceRegistry = new DeviceRegistry()

interface CreateServerResult {
  app: Hono;
  runtime: AgentRuntime;
  port: number;
}

// eslint-disable-next-line max-lines-per-function
export async function createServer(config: ServerConfig = {}): Promise<CreateServerResult> {
  const envPort = process.env['PORT'] ? Number(process.env['PORT']) : 3000;
  const port = config.port ?? envPort;
  
  const runtime = await createAgentRuntime({
    workspaceRoot: config.workspaceRoot ?? process.cwd(),
  });

  const app = new Hono();

  app.use('*', cors({
    origin: config.corsOrigin ?? '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }));

  app.get('/health', (c: Context) => c.json({ status: 'ok' }));

  app.post('/sessions', (c: Context) => {
    const sessionId = crypto.randomUUID();
    const session = runtime.createSession();
    sessions.set(sessionId, session);
    logger.info('Session created', { sessionId });
    return c.json({ sessionId });
  });

  app.delete('/sessions/:sessionId', (c: Context) => {
    const sessionId = c.req.param('sessionId');
    if (!sessions.has(sessionId)) {
      return c.json({ error: 'Session not found' }, 404);
    }
    sessions.delete(sessionId);
    logger.info('Session deleted', { sessionId });
    return c.json({ success: true });
  });

  app.post('/sessions/:sessionId/chat', async (c: Context) => {
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

  app.get('/sessions/:sessionId/chat/stream', (c: Context) => {
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
      try {
        await session.sendWithEvents(message, async (event) => {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event.data),
          });
        });
      } catch (error) {
        logger.error('Streaming error', { error: String(error), sessionId });
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'STREAM_ERROR',
          }),
        });
      }
    });
  });

  app.get('/sessions/:sessionId/history', (c: Context) => {
    const sessionId = c.req.param('sessionId');
    const session = sessions.get(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    return c.json({ messages: session.getHistory() });
  });

  app.post('/sessions/:sessionId/clear', (c: Context) => {
    const sessionId = c.req.param('sessionId');
    const session = sessions.get(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    session.clearHistory();
    return c.json({ success: true });
  });

  app.post('/chat', async (c: Context) => {
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
      ...formatResult(result),
      _httpTiming: { totalRequestDurationMs: requestDuration.toFixed(2) },
    });
  });

  app.post('/mobile/command', async (c: Context) => {
    const body = await c.req.json<{ type: string; [key: string]: unknown }>()
    if (!mobileClient) {
      return c.json({ error: 'Mobile client not connected' }, 400)
    }
    mobileClient.send(JSON.stringify(body))
    return c.json({ success: true })
  })

  app.get('/devices', (c: Context) => {
    return c.json({ devices: deviceRegistry.listDevices() })
  })

  app.post('/devices/:deviceId/action', async (c: Context) => {
    const deviceId = c.req.param('deviceId')
    const action = await c.req.json<DeviceAction>()
    try {
      const result = await deviceRegistry.executeAction(deviceId, action)
      return c.json(result)
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'UNKNOWN',
      })
    }
  })

  return { app, runtime, port };
}

let mobileClient: WebSocket | null = null;

function formatResult(result: TaskResult): object {
  return {
    text: result.text,
    completed: result.completed,
    needsInput: result.needsInput,
    pendingQuestion: result.pendingQuestion,
    stepsUsed: result.stepsUsed,
    toolsUsed: result.toolsUsed,
  };
}

export interface StartServerResult {
  server: Server;
  shutdown: () => Promise<void>;
}

export async function startServer(config: ServerConfig = {}): Promise<StartServerResult> {
  logger.reconfigure();

  const { app, runtime, port } = await createServer(config);

  const server = serve({ fetch: app.fetch, port }, (info) => {
    logger.info(`🚀 Agent server running on http://localhost:${info.port}`);
  }) as unknown as Server;

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    let deviceId: string | null = null

    ws.on('message', (message) => {
      const data = JSON.parse(message.toString()) as {
        type?: string
        capabilities?: DeviceCapabilities
        actionId?: string
        result?: ActionResult
      }

      if (data.type === 'device:register' && data.capabilities) {
        deviceId = deviceRegistry.register(ws, data.capabilities)
        logger.info('Device registered', { deviceId, platform: data.capabilities.platform })
        return
      }

      if (data.type === 'action:result' && deviceId && data.actionId && data.result) {
        deviceRegistry.handleActionResult(deviceId, data.actionId, data.result)
        return
      }

      if (!deviceId) {
        logger.info('Mobile client connected')
        mobileClient = ws
      }

      logger.info('Received message:', { message: message.toString() })
    })

    ws.on('close', () => {
      if (deviceId) {
        deviceRegistry.unregister(deviceId)
        logger.info('Device unregistered', { deviceId })
      } else {
        logger.info('Mobile client disconnected')
        mobileClient = null
      }
    })
  })

  const shutdown = async (): Promise<void> => {
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
  void (async () => {
    try {
      await startServer({
        workspaceRoot: process.env['WORKSPACE_ROOT'] ?? process.cwd(),
      });
    } catch (error: unknown) {
      console.error('Failed to start server:', error);
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(1);
    }
  })();
}
