/**
 * @agent/sdk - Workflow Module
 *
 * Exports for workflow durability and orchestration.
 */

// Durable tool wrappers
export {
  wrapToolAsDurableStep,
  wrapToolsAsDurable,
  wrapSelectedToolsAsDurable,
  wrapToolAsIndependentStep,
  getDurabilityConfig,
  setDurabilityConfig,
  DURABILITY_CONFIG,
  type DurabilityConfig,
} from './durable-tool';

// Durable agent factory
export {
  createDurableAgent,
  parseDuration,
  formatDuration,
  type DurableAgent,
  type GenerateResult,
  type GenerateOptions,
  type WebhookResponse,
} from './durable-agent';
