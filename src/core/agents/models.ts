import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
});

export const models = {
  fast: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama(process.env.OLLAMA_FAST_MODEL || 'llama3.2:3b');
    }
    return createOpenRouter().chat(process.env.MODEL || 'qwen/qwen3-coder:free');
  },

  standard: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama(process.env.OLLAMA_STANDARD_MODEL || 'qwen2.5-coder:14b');
    }
    return createOpenRouter().chat(process.env.MODEL || 'qwen/qwen3-coder:free');
  },

  reasoning: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama(process.env.OLLAMA_REASONING_MODEL || 'deepseek-r1:14b');
    }
    return createOpenRouter().chat('deepseek/deepseek-chat-v3:free');
  },

  powerful: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama(process.env.OLLAMA_POWERFUL_MODEL || 'qwen2.5-coder:32b');
    }
    return createOpenRouter().chat('anthropic/claude-sonnet-4.5');
  },
};
