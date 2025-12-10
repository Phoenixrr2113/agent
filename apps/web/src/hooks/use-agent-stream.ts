'use client';

import { useEffect, useCallback } from 'react';
import { useMotiaStream, useStreamEventHandler, useStreamGroup } from '@motiadev/stream-client-react';
import type { AgentStreamEvent } from '@/lib/agent-api';

interface AgentStreamData {
  id: string;
  status: string;
  thought?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  step?: number;
  error?: string;
  response?: string;
  usage?: unknown;
  plan?: unknown;
  checkpoint?: unknown;
  confirmation?: unknown;
  citations?: unknown[];
}

export function useAgentStream(
  sessionId: string | null,
  onEvent: (event: AgentStreamEvent) => void
) {
  const { data, event } = useStreamGroup<AgentStreamData>({
    streamName: 'agent',
    groupId: sessionId || '',
  });

  useStreamEventHandler(
    {
      event,
      type: 'update',
      listener: (eventData: AgentStreamEvent) => {
        onEvent(eventData);
      },
    },
    [onEvent]
  );

  useEffect(() => {
    if (data && data.length > 0) {
      const latestEvent = data[data.length - 1];
      if (latestEvent) {
        onEvent(latestEvent as unknown as AgentStreamEvent);
      }
    }
  }, [data, onEvent]);

  return { data };
}
