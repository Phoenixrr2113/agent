import { tool } from 'ai';
import { z } from 'zod';
import * as readline from 'readline/promises';
import { logger } from '../core/logger.js';

export function createAgentTools(rl: readline.Interface | null, approvalMode: string) {
  return {
    task_complete: tool({
      description: 'Call this when you have fully completed the user\'s request and have nothing more to do. This will end the current agent iteration.',
      inputSchema: z.object({
        summary: z.string().describe('A brief summary of what was accomplished'),
        nextSteps: z.string().optional().default('').describe('Optional suggestions for what the user might want to do next'),
      }),
      execute: async ({ summary, nextSteps = '' }: { summary: string; nextSteps?: string }) => {
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
        if (approvalMode === 'auto') {
          logger.info('🤖 Agent question (auto-approved)', { question });
          logger.warn('⚠️  Agent is running in auto-mode. To interact with the agent, use "pnpm chat" instead of "pnpm dev".');
          return 'yes';
        }

        if (approvalMode === 'manual' && rl) {
          logger.info('🤔 Agent', { question });
          const answer = await rl.question('👤 You: ');
          return answer;
        }

        return 'Tool available but approval mode not configured';
      },
    }),
  };
}

