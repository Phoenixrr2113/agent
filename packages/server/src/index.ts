import { type Server } from 'node:http'
import { join } from 'node:path'

import { createAgentRuntime, type AgentSession, type AgentRuntime, type TaskResult } from '@agent/core'
import { logger, getLogCollector, type DashboardEvent, type AgentIdentifier, type LogEntry } from '@agent/shared'
import type { DeviceAction, DeviceCapabilities, ActionResult } from '@agent/shared'
import { serve } from '@hono/node-server'
import { config } from 'dotenv'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { WebSocketServer, type WebSocket } from 'ws'

import { createApiKeyStorage, createAuthMiddleware, type ApiKeyStorage } from './auth/index.js'
import { DeviceRegistry, createLocalDesktopDevice } from './devices/index.js'

// Load environment variables from root .env
config({ path: join(process.cwd(), '../../.env') });

const logCollector = getLogCollector();
const dashboardClients = new Set<WebSocket>();

function broadcastDashboardEvent(event: DashboardEvent): void {
  const message = JSON.stringify(event);
  for (const client of dashboardClients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

function broadcastLog(entry: { timestamp: number; level: string; message: string; meta: Record<string, unknown> | undefined; formattedMessage: string }): void {
  const message = JSON.stringify({
    type: 'log',
    timestamp: entry.timestamp,
    data: entry,
  });
  for (const client of dashboardClients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

logCollector.subscribe((event) => {
  broadcastDashboardEvent(event);
});

logger.subscribe((entry) => {
  broadcastLog(entry);
});

export interface ServerConfig {
  port?: number;
  workspaceRoot?: string;
  corsOrigin?: string | string[];
  enableLocalDesktop?: boolean;
}

const sessions = new Map<string, AgentSession>()
const deviceRegistry = new DeviceRegistry()
const userRuntimes = new Map<string, AgentRuntime>()
let apiKeyStorage: ApiKeyStorage

interface CreateServerResult {
  app: Hono<any>;
  runtime: AgentRuntime;
  port: number;
  apiKeyStorage: ApiKeyStorage;
}

// eslint-disable-next-line max-lines-per-function
export async function createServer(config: ServerConfig = {}): Promise<CreateServerResult> {
  const envPort = process.env['PORT'] ? Number(process.env['PORT']) : 3000;
  const port = config.port ?? envPort;
  const workspaceRoot = config.workspaceRoot ?? process.cwd();
  
  // Initialize API key storage
  const authDbPath = join(workspaceRoot, '.agent', 'auth.db');
  apiKeyStorage = createApiKeyStorage(authDbPath);

  // Create default runtime for unauthenticated routes (health, dashboard)
  const runtime = await createAgentRuntime({
    workspaceRoot,
  });

  // Helper to get or create per-user runtime
  async function getRuntimeForUser(userId: string): Promise<AgentRuntime> {
    if (!userRuntimes.has(userId)) {
      logger.info('Creating runtime for user', { userId: userId.slice(0, 8) + '...' });
      const userRuntime = await createAgentRuntime({
        workspaceRoot,
        userId,
      });
      userRuntimes.set(userId, userRuntime);
    }
    return userRuntimes.get(userId)!;
  }

  const app = new Hono<{ Variables: { userId: string } }>();
  const authMiddleware = createAuthMiddleware(apiKeyStorage);

  app.use('*', cors({
    origin: config.corsOrigin ?? '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }));

  app.get('/health', (c: Context) => c.json({ status: 'ok' }));

  // API key management (unauthenticated for initial key creation)
  app.post('/api-keys', async (c: Context) => {
    const body = await c.req.json<{ name: string }>();
    if (!body.name) {
      return c.json({ error: 'name is required' }, 400);
    }
    const { key, keyHash } = await apiKeyStorage.create(body.name);
    logger.info('API key created', { name: body.name, keyHash: keyHash.slice(0, 8) + '...' });
    return c.json({ key, name: body.name, message: 'Save this key - it cannot be retrieved again' });
  });

  app.get('/api-keys', authMiddleware, async (c) => {
    const keys = await apiKeyStorage.list();
    return c.json({ keys: keys.map(k => ({ ...k, keyHash: k.keyHash.slice(0, 8) + '...' })) });
  });

  app.delete('/api-keys/:keyHash', authMiddleware, async (c) => {
    const keyHash = c.req.param('keyHash');
    const revoked = await apiKeyStorage.revoke(keyHash);
    if (!revoked) {
      return c.json({ error: 'Key not found' }, 404);
    }
    return c.json({ success: true });
  });

  // Protected session routes
  app.post('/sessions', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const userRuntime = await getRuntimeForUser(userId);
    const sessionId = crypto.randomUUID();
    const session = userRuntime.createSession();
    sessions.set(sessionId, session);
    logger.info('Session created', { sessionId, userId: userId.slice(0, 8) + '...' });
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

    const agentIdentifier: AgentIdentifier = {
      agentId: crypto.randomUUID(),
      sessionId,
      agentType: 'main',
    };

    const dashboardEventHandler = logCollector.createEventHandler(agentIdentifier, message);

    return streamSSE(c, async (stream) => {
      try {
        await session.sendWithEvents(message, async (event) => {
          dashboardEventHandler(event);
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

  // Protected chat routes
  app.post('/chat', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const userRuntime = await getRuntimeForUser(userId);
    const requestStartTime = performance.now();
    const body = await c.req.json<{ message: string; sessionId?: string }>();
    if (!body.message) {
      return c.json({ error: 'message is required' }, 400);
    }

    let sessionId = body.sessionId;
    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session) {
      sessionId = crypto.randomUUID();
      session = userRuntime.createSession();
      sessions.set(sessionId, session);
    }

    const agentIdentifier: AgentIdentifier = {
      agentId: crypto.randomUUID(),
      sessionId: sessionId!,
      agentType: 'main',
    };

    const dashboardEventHandler = logCollector.createEventHandler(agentIdentifier, body.message);

    const result = await session.sendWithEvents(body.message, (event) => {
      dashboardEventHandler(event);
    });
    const requestDuration = performance.now() - requestStartTime;

    logger.info('HTTP request completed', {
      endpoint: '/chat',
      sessionId,
      userId: userId.slice(0, 8) + '...',
      durationMs: requestDuration.toFixed(2),
      durationSec: (requestDuration / 1000).toFixed(3),
    });

    return c.json({
      sessionId,
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

  app.get('/dashboard/state', (c: Context) => {
    return c.json(logCollector.getSnapshot());
  })

  app.get('/dashboard/sessions', (c: Context) => {
    return c.json({ sessions: logCollector.getAllSessions() });
  })

  app.get('/dashboard/sessions/active', (c: Context) => {
    return c.json({ sessions: logCollector.getActiveSessions() });
  })

  app.get('/dashboard/sessions/:sessionId', (c: Context) => {
    const sessionId = c.req.param('sessionId');
    const session = logCollector.getSession(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    return c.json({ session });
  })

  return { app, runtime, port, apiKeyStorage };
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

  if (config.enableLocalDesktop) {
    try {
      const { DesktopDriver } = await import('@agent/device-use/drivers/desktop.js')
      const driver = new DesktopDriver()
      const localDevice = await createLocalDesktopDevice(driver)
      deviceRegistry.registerLocal(localDevice)
      logger.info('Local desktop device registered', { deviceId: localDevice.id })
    } catch (error) {
      logger.warn('Failed to register local desktop device', { error: String(error) })
    }
  }

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (url.pathname === '/dashboard/ws') {
      logger.info('Dashboard client connected');
      dashboardClients.add(ws);

      ws.send(JSON.stringify({
        type: 'state:snapshot',
        timestamp: Date.now(),
        data: { state: logCollector.getSnapshot() },
      }));

      ws.on('close', () => {
        dashboardClients.delete(ws);
        logger.info('Dashboard client disconnected');
      });
      return;
    }

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
        enableLocalDesktop: process.env['ENABLE_LOCAL_DESKTOP'] === 'true',
      });
    } catch (error: unknown) {
      console.error('Failed to start server:', error);
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(1);
    }
  })();
}
