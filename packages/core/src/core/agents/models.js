import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { logger } from '@agent/shared';
const openrouter = createOpenRouter();
const MODEL_TIERS = {
    fast: process.env.MODEL_FAST || 'deepseek/deepseek-chat-v3-0324:free',
    standard: process.env.MODEL_STANDARD || 'google/gemini-2.0-flash-001',
    reasoning: process.env.MODEL_REASONING || 'deepseek/deepseek-r1:free',
    powerful: process.env.MODEL_POWERFUL || 'anthropic/claude-sonnet-4',
};
export const models = {
    fast: () => {
        const modelName = MODEL_TIERS.fast;
        logger.info('🔌 Using OpenRouter model', { tier: 'fast', model: modelName });
        return openrouter.chat(modelName);
    },
    standard: () => {
        const modelName = MODEL_TIERS.standard;
        logger.info('🔌 Using OpenRouter model', { tier: 'standard', model: modelName });
        return openrouter.chat(modelName);
    },
    reasoning: () => {
        const modelName = MODEL_TIERS.reasoning;
        logger.info('🔌 Using OpenRouter model', { tier: 'reasoning', model: modelName });
        return openrouter.chat(modelName);
    },
    powerful: () => {
        const modelName = MODEL_TIERS.powerful;
        logger.info('🔌 Using OpenRouter model', { tier: 'powerful', model: modelName });
        return openrouter.chat(modelName);
    },
};
