import { models } from '../../src/agents.js';

export function getTestModel() {
  return models.standard();
}

export function hasModelProvider(): boolean {
  if (process.env.OLLAMA_ENABLED === 'true') {
    return true;
  }
  return !!process.env.OPENROUTER_API_KEY;
}
