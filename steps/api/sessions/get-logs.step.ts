import type { ApiRouteConfig } from 'motia'
import { z } from 'zod'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetSessionLogs',
  path: '/sessions/:sessionId/logs',
  method: 'GET',
  emits: [],
  flows: ['observability'],
}

interface LogEntry {
  id: string
  sessionId: string
  traceId: string
  timestamp: number
  type: 'thought' | 'tool_call' | 'tool_result' | 'response' | 'error'
  data: Record<string, unknown>
}

export const handler = async (req: any, ctx: any) => {
  const { sessionId } = req.pathParams
  const type = req.query?.type as string | undefined
  const limit = Number(req.query?.limit) || 100

  const recentKey = `${sessionId}:recent`
  let logs = ((await ctx.state.get('logs', recentKey)) || []) as LogEntry[]

  if (type) {
    logs = logs.filter((l: LogEntry) => l.type === type)
  }

  logs = logs.slice(-limit)

  ctx.logger.info('Retrieved session logs', { sessionId, count: logs.length })

  return {
    status: 200,
    body: { logs, count: logs.length, sessionId },
  }
}
