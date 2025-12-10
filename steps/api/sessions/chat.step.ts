import type { ApiRouteConfig, ApiRouteHandler } from 'motia';
import { z } from 'zod';

const attachmentSchema = z.object({
  type: z.enum(['image', 'file']),
  name: z.string(),
  mimeType: z.string(),
  data: z.string(),
});

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Chat',
  path: '/sessions/:sessionId/chat',
  method: 'POST',
  bodySchema: z.object({
    message: z.string().min(1, 'Message is required'),
    attachments: z.array(attachmentSchema).optional(),
  }),
  emits: ['chat.started', 'agent.think'],
  flows: ['sessions', 'agent-loop'],
};

interface Attachment {
  type: 'image' | 'file';
  name: string;
  mimeType: string;
  data: string;
}

type TextPart = { type: 'text'; text: string };
type ImagePart = { type: 'image'; image: string };
type FilePart = { type: 'file'; data: string; mediaType: string; filename?: string };
type ContentPart = TextPart | ImagePart | FilePart;

function buildUserContent(message: string, attachments?: Attachment[]): string | ContentPart[] {
  if (!attachments || attachments.length === 0) {
    return message;
  }

  const parts: ContentPart[] = [{ type: 'text', text: message }];

  for (const attachment of attachments) {
    if (attachment.type === 'image') {
      parts.push({ type: 'image', image: attachment.data });
    } else {
      parts.push({
        type: 'file',
        data: attachment.data,
        mediaType: attachment.mimeType,
        filename: attachment.name,
      });
    }
  }

  return parts;
}

export const handler: ApiRouteHandler = async (req, ctx) => {
  const { sessionId } = req.pathParams as { sessionId: string };
  const { message, attachments } = req.body as { message: string; attachments?: Attachment[] };

  const sessionData = await ctx.state.get<{ createdAt: string }>('sessions', sessionId);

  if (!sessionData) {
    return {
      status: 404,
      body: { error: 'Session not found' },
    };
  }

  const historyData = await ctx.state.get<{ messages: any[] }>('sessions', `${sessionId}:history`);
  const existingMessages = historyData?.messages || [];

  const userContent = buildUserContent(message, attachments);
  const messages = [...existingMessages, { role: 'user', content: userContent }];

  await ctx.state.set('sessions', `${sessionId}:history`, { messages });

  await ctx.emit({
    topic: 'chat.started',
    data: { sessionId, message, traceId: ctx.traceId },
  });

  await ctx.emit({
    topic: 'agent.think',
    data: {
      sessionId,
      messages,
      step: 0,
    },
  });

  ctx.logger.info('Chat started - agent loop initiated', {
    sessionId,
    traceId: ctx.traceId,
    hasAttachments: !!attachments?.length,
    attachmentCount: attachments?.length || 0,
  });

  return {
    status: 202,
    body: {
      sessionId,
      traceId: ctx.traceId,
      status: 'processing',
      message: 'Request accepted. Subscribe to stream for updates.',
      streamUrl: `/streams/agent/${sessionId}`,
    },
  };
};

