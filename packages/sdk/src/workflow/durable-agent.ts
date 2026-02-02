/**
 * @agent/sdk - Durable Agent Factory
 *
 * Creates agents with workflow durability features.
 * Supports crash recovery, scheduled execution, and approval workflows.
 */

import type { AgentOptions } from '../types/agent';

// ============================================================================
// Types
// ============================================================================

/**
 * Result from an agent generation.
 */
export interface GenerateResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Options for agent generation.
 */
export interface GenerateOptions {
  prompt: string;
  maxSteps?: number;
}

/**
 * Webhook response for approval workflows.
 */
export interface WebhookResponse {
  approved: boolean;
  feedback?: string;
  modifiedContent?: string;
}

/**
 * Durable agent interface with standard and durable methods.
 */
export interface DurableAgent {
  /**
   * Standard generate method (non-durable).
   */
  generate: (options: GenerateOptions) => Promise<GenerateResult>;

  /**
   * Durable generate that survives crashes.
   * Uses 'use workflow' directive for full durability.
   */
  durableGenerate: (prompt: string) => Promise<string>;

  /**
   * Generate with approval workflow.
   * Pauses for webhook approval before finalizing.
   */
  withApproval: (
    prompt: string,
    webhookPath: string
  ) => Promise<GenerateResult>;

  /**
   * Scheduled generation with delay.
   * Uses workflow sleep to delay without holding compute.
   */
  scheduled: (prompt: string, delay: string) => Promise<GenerateResult>;
}

// ============================================================================
// Stub Implementations
// ============================================================================

// Note: These are stubs that will be replaced when the agent factory
// (task 2.1.1) is complete. The workflow package integration requires
// the actual runtime to be available.

/**
 * Placeholder for workflow sleep function.
 * Will be replaced with actual import from 'workflow' package.
 */
async function workflowSleep(_duration: string): Promise<void> {
  // Stub - actual implementation uses workflow package
  console.warn('workflowSleep: stub implementation, not actually sleeping');
}

/**
 * Placeholder for webhook wait function.
 * Will be replaced with actual workflow webhook integration.
 */
async function waitForWebhook(
  _path: string,
  _context: Record<string, unknown>
): Promise<WebhookResponse> {
  // Stub - actual implementation uses workflow package
  console.warn('waitForWebhook: stub implementation');
  return { approved: true };
}

// ============================================================================
// Durable Agent Factory
// ============================================================================

/**
 * Create a durable agent with workflow integration.
 *
 * The durable agent provides methods that leverage the workflow package
 * for crash recovery, scheduled execution, and approval workflows.
 *
 * @param options - Agent configuration options
 * @returns Durable agent instance
 *
 * @example
 * ```typescript
 * const agent = createDurableAgent({
 *   role: 'coder',
 *   toolPreset: 'standard',
 * });
 *
 * // Standard generation (no durability)
 * const result = await agent.generate({ prompt: 'Hello' });
 *
 * // Durable generation (survives crashes)
 * const text = await agent.durableGenerate('Create a component');
 *
 * // With approval workflow
 * const approved = await agent.withApproval('Draft email', '/api/approve');
 *
 * // Scheduled generation
 * const delayed = await agent.scheduled('Send reminder', '1h');
 * ```
 */
export function createDurableAgent(options: AgentOptions): DurableAgent {
  // Note: This is a stub implementation. The full implementation requires
  // the agent factory (task 2.1.1) to be complete.

  const generate = async (genOptions: GenerateOptions): Promise<GenerateResult> => {
    // Stub - will call actual agent.generate when available
    console.warn('DurableAgent.generate: stub implementation');
    return {
      text: `[Stub response for: ${genOptions.prompt}]`,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  };

  return {
    generate,

    durableGenerate: async (prompt: string): Promise<string> => {
      // The "use workflow" directive marks this as a durable workflow.
      // The workflow runtime will checkpoint and resume on crash.
      "use workflow";

      const result = await generate({ prompt });
      return result.text;
    },

    withApproval: async (
      prompt: string,
      webhookPath: string
    ): Promise<GenerateResult> => {
      "use workflow";

      // Generate draft
      const draft = await generate({ prompt });

      // Wait for approval via webhook
      const approval = await waitForWebhook(webhookPath, {
        draft: draft.text,
      });

      if (!approval.approved) {
        throw new Error(`Approval rejected: ${approval.feedback || 'No reason provided'}`);
      }

      // If approved, finalize (optionally with modifications)
      const finalPrompt = approval.modifiedContent
        ? `Finalize with modifications: ${approval.modifiedContent}. Original: ${draft.text}`
        : `Finalize: ${draft.text}`;

      return generate({ prompt: finalPrompt });
    },

    scheduled: async (
      prompt: string,
      delay: string
    ): Promise<GenerateResult> => {
      "use workflow";

      // Sleep without holding compute
      await workflowSleep(delay);

      // Execute after delay
      return generate({ prompt });
    },
  };
}

// ============================================================================
// Workflow Helpers
// ============================================================================

/**
 * Parse a duration string into milliseconds.
 * Supports: 30s, 5m, 1h, 1d
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like '30s', '5m', '1h', '1d'`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Format milliseconds as a human-readable duration.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
  return `${Math.round(ms / 86400000)}d`;
}
