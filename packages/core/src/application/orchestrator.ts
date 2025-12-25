import { logger } from '@agent/shared';
import { stepCountIs, type StepResult, type PrepareStepFunction, generateText } from 'ai';
import type { ModelMessage } from 'ai';

import { CORE_TOOL_NAMES } from './initialization.js';
import { createAgentWithRole, type AgentRole, models, type SystemContext } from '../agents/factory.js';
import type { ProfileManager } from '@agent/memory';

const MAX_CONTEXT_MESSAGES = 60;
const SUMMARIZE_THRESHOLD = 40;
const PRESERVE_HEAD = 2;
const PRESERVE_TAIL = 15;

async function summarizeContext(messages: ModelMessage[]): Promise<ModelMessage[]> {
  if (messages.length <= SUMMARIZE_THRESHOLD) {
    return messages;
  }

  const headMessages = messages.slice(0, PRESERVE_HEAD);
  const tailMessages = messages.slice(-PRESERVE_TAIL);
  const middleMessages = messages.slice(PRESERVE_HEAD, -PRESERVE_TAIL);

  if (middleMessages.length < 5) {
    return messages;
  }

  logger.info('📝 Summarizing context', {
    total: messages.length,
    middle: middleMessages.length,
    preserved: PRESERVE_HEAD + PRESERVE_TAIL,
  });

  const middleText = middleMessages.map((msg, i) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return `[${msg.role}]: ${content.slice(0, 500)}`;
  }).join('\n');

  try {
    const { text: summary } = await generateText({
      model: models.fast(),
      prompt: `Summarize the following conversation history into a concise bullet-point list. Focus on key decisions, tool outputs, and progress made. Keep it under 300 words.\n\n${middleText}`,
    });

    const summaryMessage: ModelMessage = {
      role: 'assistant',
      content: `[CONTEXT SUMMARY - ${middleMessages.length} messages condensed]\n${summary}`,
    };

    logger.info('✅ Context summarized', { originalMessages: middleMessages.length });
    return [...headMessages, summaryMessage, ...tailMessages];
  } catch (error) {
    logger.warn('⚠️ Context summarization failed, keeping original messages', { error: String(error) });
    return messages;
  }
}

let summarizationPending = false;

export function createPrepareStep(activationManager?: any): PrepareStepFunction<any> {
  return ({ messages }) => {
    let finalMessages = messages;

    if (!summarizationPending && messages.length > MAX_CONTEXT_MESSAGES) {
      summarizationPending = true;
      summarizeContext(messages)
        .then((summarized) => {
          finalMessages = summarized;
          summarizationPending = false;
        })
        .catch(() => {
          summarizationPending = false;
        });
    }

    if (activationManager) {
      const coreTools = [...CORE_TOOL_NAMES];
      const activeToolNames = activationManager.getActiveToolNames();

      logger.debug('🔧 Active tools', {
        core: coreTools.length,
        activated: activeToolNames.length,
        total: coreTools.length + activeToolNames.length,
      });

      return {
        messages: finalMessages,
        activeTools: [...coreTools, ...activeToolNames],
      };
    }

    return { messages: finalMessages };
  };
}


function cleanAIText(text: string): string {
  const xmlTagPattern = /<\/?[a-zA-Z_][a-zA-Z0-9_-]*(?:\s+[^>]*)?\/?>/g;
  const cleaned = text.replaceAll(xmlTagPattern, '').trim();
  return cleaned;
}

import type { StreamEventCallback } from '@agent/shared';

export function createStepFinishHandler(onEvent?: StreamEventCallback) {
  let stepCount = 0;
  let stepStartTime = 0;

  return async (stepResult: StepResult<any>) => {
    stepCount++;
    const stepEndTime = performance.now();
    const stepDuration = stepStartTime > 0 ? stepEndTime - stepStartTime : 0;
    const timestamp = Date.now();

    // Note: SSE events now come from fullStream in agent-runtime
    // onStepFinish only handles console logging for debugging

    logger.debug('\n' + '═'.repeat(80));
    logger.debug(`📈 STEP ${stepCount} ${stepDuration > 0 ? `(${stepDuration.toFixed(2)}ms)` : ''}`);
    logger.debug('═'.repeat(80));

    if (stepResult.text && stepResult.text.trim()) {
      const cleanedText = cleanAIText(stepResult.text);
      if (cleanedText) {
        logger.debug('\n💭 AI THINKING:');
        logger.debug('─'.repeat(40));
        logger.debug(cleanedText);
      }
    }

    if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
      for (let index = 0; index < stepResult.toolCalls.length; index++) {
        const tc = stepResult.toolCalls[index];
        if (!tc) continue;
        const tr = stepResult.toolResults?.find(r => r.toolCallId === tc.toolCallId);

        const timing = (tr as any)?.timing;
        const timingString = timing ? ` (${timing.toFixed(2)}ms)` : '';
        logger.debug(`\n🔧 TOOL CALL: ${tc.toolName}${timingString}`);
        logger.debug('─'.repeat(40));

        const input = tc.input;
        if (input && typeof input === 'object' && Object.keys(input).length > 0) {
          logger.debug('📥 INPUT:');
          const inputString = JSON.stringify(input, null, 2);
          logger.debug(inputString.length > 500 ? inputString.slice(0, 500) + '...' : inputString);
        } else {
          logger.debug('📥 INPUT: (none)');
        }

        if (tr) {
          logger.debug('\n📤 OUTPUT:');
          if (tr.output !== undefined && tr.output !== null) {
            const outputString = typeof tr.output === 'string'
              ? tr.output
              : JSON.stringify(tr.output, null, 2);
            if (outputString) {
              logger.debug(outputString.length > 1000 ? outputString.slice(0, 1000) + '...' : outputString);
            } else {
              logger.debug('(empty result)');
            }
          } else {
            logger.debug('(no output)');
          }
        } else {
          logger.debug('\n📤 OUTPUT: (tool execution pending)');
        }
      }
    } else {
      logger.debug('\n💬 No tool calls this step');
    }

    logger.debug('\n');
    stepStartTime = performance.now();
  };
}

export function createAgent(
  tools: Record<string, any>,
  options: { maxSteps?: number; activationManager?: any; role?: AgentRole; workspaceRoot?: string; isSpawnedAgent?: boolean; systemContext?: SystemContext; profileManager?: ProfileManager; userId?: string } = {}
) {
  const { maxSteps = 50, activationManager, role = 'generic', workspaceRoot, isSpawnedAgent, systemContext, profileManager, userId } = options;

  const stopWhen = ({ steps }: { steps: Array<StepResult<any>> }) => {
    const taskCompleted = steps.some((step) =>
      step.toolCalls?.some((tc) => tc.toolName === 'task_complete')
    );

    if (taskCompleted) {
      logger.info('✅ Task marked as complete by agent');
      return true;
    }

    return stepCountIs(maxSteps)({ steps });
  };

  return createAgentWithRole(role, tools, {
    modelType: 'standard',
    stopWhen,
    prepareStep: createPrepareStep(activationManager),
    onStepFinish: createStepFinishHandler(),
    workspaceRoot,
    isSpawnedAgent,
    systemContext,
    profileManager,
    userId,
  });
}

export function createAgentWithStreaming(
  tools: Record<string, any>,
  options: {
    maxSteps?: number;
    activationManager?: any;
    role?: AgentRole;
    onEvent?: StreamEventCallback;
    workspaceRoot?: string;
    isSpawnedAgent?: boolean;
    systemContext?: SystemContext;
  } = {}
) {
  const { maxSteps = 50, activationManager, role = 'generic', onEvent, workspaceRoot, isSpawnedAgent, systemContext } = options;

  const stopWhen = ({ steps }: { steps: Array<StepResult<any>> }) => {
    const taskCompleted = steps.some((step) =>
      step.toolCalls?.some((tc) => tc.toolName === 'task_complete')
    );

    if (taskCompleted) {
      logger.info('✅ Task marked as complete by agent');
      return true;
    }

    return stepCountIs(maxSteps)({ steps });
  };

  return createAgentWithRole(role, tools, {
    modelType: 'standard',
    stopWhen,
    prepareStep: createPrepareStep(activationManager),
    onStepFinish: createStepFinishHandler(onEvent),
    workspaceRoot,
    isSpawnedAgent,
    systemContext,
  });
}
