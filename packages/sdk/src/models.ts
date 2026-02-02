/**
 * @agent/sdk - Model Configuration
 *
 * Model tier definitions supporting multiple providers.
 * Adapted from packages/core/src/agents/models.ts
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

// ============================================================================
// Provider Instances (Lazy Initialization)
// ============================================================================

let _openrouter: ReturnType<typeof createOpenRouter> | null = null;
let _ollama: ReturnType<typeof createOllama> | null = null;
let _openai: ReturnType<typeof createOpenAI> | null = null;
let _anthropic: ReturnType<typeof createAnthropic> | null = null;

function getOpenRouter() {
  if (!_openrouter) {
    _openrouter = createOpenRouter();
  }
  return _openrouter;
}

function getOllama() {
  if (!_ollama) {
    _ollama = createOllama({
      baseURL: process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434/api',
    });
  }
  return _ollama;
}

function getOpenAI() {
  if (!_openai) {
    _openai = createOpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
    });
  }
  return _openai;
}

function getAnthropic() {
  if (!_anthropic) {
    _anthropic = createAnthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });
  }
  return _anthropic;
}

// ============================================================================
// Model Tier Types
// ============================================================================

export type ModelTier = 'fast' | 'standard' | 'reasoning' | 'powerful';
export type ModelProvider = 'openrouter' | 'ollama' | 'openai' | 'anthropic';

export interface ModelConfig {
  provider: ModelProvider;
  name: string;
}

// ============================================================================
// Default Model Names by Provider and Tier
// ============================================================================

export const defaultModels: Record<ModelProvider, Record<ModelTier, string>> = {
  openrouter: {
    fast: 'deepseek/deepseek-chat-v3-0324:free',
    standard: 'google/gemini-2.0-flash-001',
    reasoning: 'deepseek/deepseek-r1:free',
    powerful: 'anthropic/claude-sonnet-4',
  },
  ollama: {
    fast: 'qwen3:4b',
    standard: 'qwen2.5-coder:14b',
    reasoning: 'deepseek-r1:14b',
    powerful: 'qwen2.5-coder:14b',
  },
  openai: {
    fast: 'gpt-4o-mini',
    standard: 'gpt-4o',
    reasoning: 'o3', // or o1-preview
    powerful: 'gpt-4o',
  },
  anthropic: {
    fast: 'claude-3-haiku-20240307',
    standard: 'claude-sonnet-4-20250514',
    reasoning: 'claude-sonnet-4-20250514',
    powerful: 'claude-sonnet-4-20250514',
  },
};

// ============================================================================
// Environment Variable Model Overrides
// ============================================================================

function getEnvModel(tier: ModelTier): string | undefined {
  const envKey = `MODEL_${tier.toUpperCase()}`;
  return process.env[envKey];
}

function getOllamaEnvModel(tier: ModelTier): string | undefined {
  const envKey = `OLLAMA_${tier.toUpperCase()}_MODEL`;
  return process.env[envKey];
}

// ============================================================================
// Model Creation Functions
// ============================================================================

// Note: Type assertion needed due to version mismatch between stable providers
// and AI SDK 6.0.0-beta. Provider packages use @ai-sdk/provider@3.0.2 while
// beta uses @ai-sdk/provider@3.0.0-beta.20. The runtime behavior is compatible.
function createModelForProvider(
  provider: ModelProvider,
  modelName: string
): LanguageModel {
  switch (provider) {
    case 'openrouter':
      return getOpenRouter().chat(modelName) as unknown as LanguageModel;
    case 'ollama':
      return getOllama()(modelName) as unknown as LanguageModel;
    case 'openai':
      return getOpenAI()(modelName) as unknown as LanguageModel;
    case 'anthropic':
      return getAnthropic()(modelName) as unknown as LanguageModel;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ============================================================================
// Model Tier Functions
// ============================================================================

export const models = {
  fast: (): LanguageModel => {
    if (process.env['OLLAMA_ENABLED'] === 'true') {
      const modelName = getOllamaEnvModel('fast') || defaultModels.ollama.fast;
      return getOllama()(modelName) as unknown as LanguageModel;
    }
    const modelName = getEnvModel('fast') || defaultModels.openrouter.fast;
    return getOpenRouter().chat(modelName) as unknown as LanguageModel;
  },

  standard: (): LanguageModel => {
    if (process.env['OLLAMA_ENABLED'] === 'true') {
      const modelName = getOllamaEnvModel('standard') || defaultModels.ollama.standard;
      return getOllama()(modelName) as unknown as LanguageModel;
    }
    const modelName = getEnvModel('standard') || defaultModels.openrouter.standard;
    return getOpenRouter().chat(modelName) as unknown as LanguageModel;
  },

  reasoning: (): LanguageModel => {
    if (process.env['OLLAMA_ENABLED'] === 'true') {
      const modelName = getOllamaEnvModel('reasoning') || defaultModels.ollama.reasoning;
      return getOllama()(modelName) as unknown as LanguageModel;
    }
    const modelName = getEnvModel('reasoning') || defaultModels.openrouter.reasoning;
    return getOpenRouter().chat(modelName) as unknown as LanguageModel;
  },

  powerful: (): LanguageModel => {
    if (process.env['OLLAMA_ENABLED'] === 'true') {
      const modelName = getOllamaEnvModel('powerful') || defaultModels.ollama.powerful;
      return getOllama()(modelName) as unknown as LanguageModel;
    }
    const modelName = getEnvModel('powerful') || defaultModels.openrouter.powerful;
    return getOpenRouter().chat(modelName) as unknown as LanguageModel;
  },
};

// ============================================================================
// Model Resolution
// ============================================================================

export interface ModelResolutionOptions {
  /** Specific model tier to use */
  tier?: ModelTier;
  /** Specific provider to use */
  provider?: ModelProvider;
  /** Specific model name (overrides tier/provider) */
  modelName?: string;
}

/**
 * Resolves a model based on options.
 *
 * Priority:
 * 1. Explicit modelName with provider
 * 2. Tier-based selection with provider preference
 * 3. Default tier (standard) with default provider
 */
export function resolveModel(options: ModelResolutionOptions = {}): LanguageModel {
  const { tier = 'standard', provider, modelName } = options;

  // If explicit model name provided
  if (modelName && provider) {
    return createModelForProvider(provider, modelName);
  }

  // If modelName looks like "provider/model"
  if (modelName && modelName.includes('/')) {
    // Use OpenRouter for slash-formatted model names
    return getOpenRouter().chat(modelName) as unknown as LanguageModel;
  }

  // Use tier-based selection
  return models[tier]();
}

// ============================================================================
// Model Info Helpers
// ============================================================================

export function getModelInfo(tier: ModelTier): { provider: ModelProvider; name: string } {
  if (process.env['OLLAMA_ENABLED'] === 'true') {
    return {
      provider: 'ollama',
      name: getOllamaEnvModel(tier) || defaultModels.ollama[tier],
    };
  }
  return {
    provider: 'openrouter',
    name: getEnvModel(tier) || defaultModels.openrouter[tier],
  };
}

export function listAvailableTiers(): ModelTier[] {
  return ['fast', 'standard', 'reasoning', 'powerful'];
}

export function listAvailableProviders(): ModelProvider[] {
  return ['openrouter', 'ollama', 'openai', 'anthropic'];
}
