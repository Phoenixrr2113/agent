import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';
import { logger } from '@agent/shared';

const openrouter = createOpenRouter();
const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
});

export const models: any = {
  fast: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      const modelName = process.env.OLLAMA_FAST_MODEL || 'qwen3:4b';
      logger.info('🔌 Using Ollama model', { tier: 'fast', model: modelName });
      return ollama(modelName);
    }
    const modelName = process.env.MODEL_FAST || 'deepseek/deepseek-chat-v3-0324:free';
    logger.info('🔌 Using OpenRouter model', { tier: 'fast', model: modelName });
    return openrouter.chat(modelName);
  },

  standard: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      const modelName = process.env.OLLAMA_STANDARD_MODEL || 'qwen2.5-coder:14b';
      logger.info('🔌 Using Ollama model', { tier: 'standard', model: modelName });
      return ollama(modelName);
    }
    const modelName = process.env.MODEL_STANDARD || 'google/gemini-2.0-flash-001';
    logger.info('🔌 Using OpenRouter model', { tier: 'standard', model: modelName });
    return openrouter.chat(modelName);
  },

  reasoning: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      const modelName = process.env.OLLAMA_REASONING_MODEL || 'deepseek-r1:14b';
      logger.info('🔌 Using Ollama model', { tier: 'reasoning', model: modelName });
      return ollama(modelName);
    }
    const modelName = process.env.MODEL_REASONING || 'deepseek/deepseek-r1:free';
    logger.info('🔌 Using OpenRouter model', { tier: 'reasoning', model: modelName });
    return openrouter.chat(modelName);
  },

  powerful: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      const modelName = process.env.OLLAMA_POWERFUL_MODEL || 'qwen2.5-coder:14b';
      logger.info('🔌 Using Ollama model', { tier: 'powerful', model: modelName });
      return ollama(modelName);
    }
    const modelName = process.env.MODEL_POWERFUL || 'anthropic/claude-sonnet-4';
    logger.info('🔌 Using OpenRouter model', { tier: 'powerful', model: modelName });
    return openrouter.chat(modelName);
  },
};
