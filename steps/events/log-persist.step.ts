import type { EventConfig } from 'motia'
import { z } from 'zod'

export const config: EventConfig = {
  type: 'event',
  name: 'LogPersist',
  subscribes: ['log.thought', 'log.tool', 'log.error', 'log.response'],
  input: z.object({
    sessionId: z.string(),
    type: z.enum(['thought', 'tool_call', 'tool_result', 'response', 'error']),
    data: z.any(),
  }),
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

export const handler = async (
  input: { sessionId: string; type: LogEntry['type']; data: Record<string, unknown> },
  ctx: any
) => {
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    sessionId: input.sessionId,
    traceId: ctx.traceId,
    timestamp: Date.now(),
    type: input.type,
    data: input.data,
  }

  const recentKey = `${input.sessionId}:recent`
  const recent = ((await ctx.state.get('logs', recentKey)) || []) as LogEntry[]
  recent.push(entry)
  if (recent.length > 100) recent.shift()
  await ctx.state.set('logs', recentKey, recent)

  if (ctx.streams?.logs) {
    await ctx.streams.logs.set(input.sessionId, entry.id, entry)
  }

  ctx.logger.debug('Log persisted', { id: entry.id, type: entry.type, sessionId: input.sessionId })
}
