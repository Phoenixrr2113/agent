import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';
import { logger } from '@agent/shared';

const OLLAMA_ENABLED = process.env.OLLAMA_ENABLED === 'true';

const openrouter = createOpenRouter();
const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
});

const OPENROUTER_TIERS = {
  fast: process.env.MODEL_FAST || 'deepseek/deepseek-chat-v3-0324:free',
  standard: process.env.MODEL_STANDARD || 'google/gemini-2.0-flash-001',
  reasoning: process.env.MODEL_REASONING || 'deepseek/deepseek-r1:free',
  powerful: process.env.MODEL_POWERFUL || 'anthropic/claude-sonnet-4',
};

const OLLAMA_TIERS = {
  fast: process.env.OLLAMA_FAST_MODEL || 'qwen3:4b',
  standard: process.env.OLLAMA_STANDARD_MODEL || 'qwen2.5-coder:14b',
  reasoning: process.env.OLLAMA_REASONING_MODEL || 'deepseek-r1:14b',
  powerful: process.env.OLLAMA_POWERFUL_MODEL || 'qwen2.5-coder:14b',
};

export const models: any = {
  fast: () => {
    if (OLLAMA_ENABLED) {
      const modelName = OLLAMA_TIERS.fast;
      logger.info('🔌 Using Ollama model', { tier: 'fast', model: modelName });
      return ollama(modelName);
    }
    const modelName = OPENROUTER_TIERS.fast;
    logger.info('🔌 Using OpenRouter model', { tier: 'fast', model: modelName });
    return openrouter.chat(modelName);
  },

  standard: () => {
    if (OLLAMA_ENABLED) {
      const modelName = OLLAMA_TIERS.standard;
      logger.info('🔌 Using Ollama model', { tier: 'standard', model: modelName });
      return ollama(modelName);
    }
    const modelName = OPENROUTER_TIERS.standard;
    logger.info('🔌 Using OpenRouter model', { tier: 'standard', model: modelName });
    return openrouter.chat(modelName);
  },

  reasoning: () => {
    if (OLLAMA_ENABLED) {
      const modelName = OLLAMA_TIERS.reasoning;
      logger.info('🔌 Using Ollama model', { tier: 'reasoning', model: modelName });
      return ollama(modelName);
    }
    const modelName = OPENROUTER_TIERS.reasoning;
    logger.info('🔌 Using OpenRouter model', { tier: 'reasoning', model: modelName });
    return openrouter.chat(modelName);
  },

  powerful: () => {
    if (OLLAMA_ENABLED) {
      const modelName = OLLAMA_TIERS.powerful;
      logger.info('🔌 Using Ollama model', { tier: 'powerful', model: modelName });
      return ollama(modelName);
    }
    const modelName = OPENROUTER_TIERS.powerful;
    logger.info('🔌 Using OpenRouter model', { tier: 'powerful', model: modelName });
    return openrouter.chat(modelName);
  },
};
