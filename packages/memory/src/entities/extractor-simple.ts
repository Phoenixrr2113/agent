import { logger } from '@agent/shared';
import { randomUUID } from 'node:crypto';
import type { ModelMessage } from 'ai';

const GRAPHITI_URL = process.env['GRAPHITI_URL'] || 'http://localhost:8000';

interface GraphitiMemory {
  addMessages(messages: ModelMessage[], groupId?: string): Promise<void>;
  search(query: string, groupIds?: string[]): Promise<any>;
}

export function createGraphitiMemory(): GraphitiMemory {
  let lastProcessedIndex = -1;

  async function request(path: string, method: string, body?: unknown) {
    const response = await fetch(`${GRAPHITI_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Graphiti API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  return {
    async addMessages(messages: ModelMessage[], groupId = 'default'): Promise<void> {
      const newMessages = messages.slice(lastProcessedIndex + 1);
      if (newMessages.length === 0) return;

      // Convert to Graphiti message format - Graphiti handles all extraction internally
      const graphitiMessages = newMessages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => {
          const content = typeof msg.content === 'string' 
            ? msg.content 
            : JSON.stringify(msg.content);
          return {
            uuid: randomUUID(),
            content,
            role: msg.role,
            role_type: msg.role,
            name: `${msg.role}_${Date.now()}`,
            timestamp: new Date().toISOString(),
            source_description: 'agent_conversation',
          };
        });

      if (graphitiMessages.length === 0) return;

      logger.info('Sending messages to Graphiti...', { count: graphitiMessages.length });

      try {
        await request('/messages', 'POST', {
          group_id: groupId,
          messages: graphitiMessages,
        });
        lastProcessedIndex = messages.length - 1;
        logger.info('Messages stored in Graphiti');
      } catch (error) {
        logger.error('Graphiti storage failed', { error: String(error) });
      }
    },

    async search(query: string, groupIds?: string[]) {
      return request('/search', 'POST', {
        query,
        group_ids: groupIds,
        max_facts: 10,
      });
    },
  };
}

// Simple extractor interface for backwards compatibility
export function createSimpleMemoryExtractor(groupId = 'default') {
  const graphiti = createGraphitiMemory();
  
  return {
    async extractFromConversation(messages: ModelMessage[]): Promise<void> {
      await graphiti.addMessages(messages, groupId);
    },
    async waitForPending(): Promise<void> {
      // No-op - Graphiti handles async processing internally
    },
  };
}
