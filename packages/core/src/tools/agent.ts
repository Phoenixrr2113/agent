
import { logger } from '@agent/shared';
import { tool } from 'ai';
import { z } from 'zod';

import type * as readline from 'node:readline/promises';

export function createAgentTools(rl: readline.Interface | null) {
  return {
    task_complete: tool({
      description:
        'Signal that you have fully completed the user\'s request. IMPORTANT: Calling this tool ENDS your execution immediately - no further actions will be taken. Only call when you are truly done.',
      inputSchema: z.object({
        summary: z.string().describe('A brief summary of what was accomplished'),
        nextSteps: z.string().optional().default('').describe('Optional suggestions for what the user might want to do next'),
      }),
      execute: ({ summary, nextSteps = '' }: { summary: string; nextSteps?: string }) => {
        let result = `Task completed: ${summary}`;
        if (nextSteps) {
          result += `\n\nSuggested next steps: ${nextSteps}`;
        }
        return result;
      },
    }),
    ask_user: tool({
      description: 'Ask the user a question and wait for their response. Use this when you need clarification, approval, or additional information from the user.',
      inputSchema: z.object({
        question: z.string().describe('The question to ask the user'),
      }),
      execute: async ({ question }: { question: string }) => {
        if (!rl) {
          logger.warn('⚠️  No readline interface available for user input');
          return 'User interaction not available';
        }

        logger.info('🤔 Agent', { question });
        const answer = await rl.question('👤 You: ');
        return answer;
      },
    }),
  };
}

