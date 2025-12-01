import { stepCountIs, type StepResult, type PrepareStepFunction } from 'ai';
import { createAgentWithRole } from '../core/agents/factory.js';
import { logger } from '@agent/shared';

export function createPrepareStep(activationManager?: any): PrepareStepFunction<any> {
  return ({ messages }) => {
    const MAX_CONTEXT_MESSAGES = 50;

    let finalMessages = messages;
    if (messages.length > MAX_CONTEXT_MESSAGES) {
      logger.info('🔄 Trimming context', { from: messages.length, to: MAX_CONTEXT_MESSAGES });
      finalMessages = [
        messages[0],
        ...messages.slice(-(MAX_CONTEXT_MESSAGES - 1)),
      ];
    }

    // Filter inactive tool schemas from context window
    if (activationManager) {
      const coreTools = [
        'shell',
        'plan',
        'ask_user',
        'task_complete',
        'search_tools',
        'activate_tool',
        'deactivate_tool',
      ];
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
  const cleaned = text.replace(xmlTagPattern, '').trim();
  return cleaned;
}

export function createStepFinishHandler() {
  let stepCount = 0;
  let stepStartTime = 0;

  return async (stepResult: StepResult<any>) => {
    stepCount++;
    const stepEndTime = performance.now();
    const stepDuration = stepStartTime > 0 ? stepEndTime - stepStartTime : 0;

    console.log('\n' + '═'.repeat(80));
    console.log(`📈 STEP ${stepCount} ${stepDuration > 0 ? `(${stepDuration.toFixed(2)}ms)` : ''}`);
    console.log('═'.repeat(80));

    if (stepResult.text && stepResult.text.trim()) {
      const cleanedText = cleanAIText(stepResult.text);
      if (cleanedText) {
        console.log('\n💭 AI THINKING:');
        console.log('─'.repeat(40));
        console.log(cleanedText);
      }
    }

    if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
      for (let i = 0; i < stepResult.toolCalls.length; i++) {
        const tc = stepResult.toolCalls[i];
        const tr = stepResult.toolResults?.find(r => r.toolCallId === tc.toolCallId);

        const timing = (tr as any)?.timing;
        const timingStr = timing ? ` (${timing.toFixed(2)}ms)` : '';
        console.log(`\n🔧 TOOL CALL: ${tc.toolName}${timingStr}`);
        console.log('─'.repeat(40));

        const input = tc.input;
        if (input && typeof input === 'object' && Object.keys(input).length > 0) {
          console.log('📥 INPUT:');
          const inputStr = JSON.stringify(input, null, 2);
          console.log(inputStr.length > 500 ? inputStr.slice(0, 500) + '...' : inputStr);
        } else {
          console.log('📥 INPUT: (none)');
        }

        if (tr) {
          console.log('\n📤 OUTPUT:');
          if (tr.output !== undefined && tr.output !== null) {
            const outputStr = typeof tr.output === 'string'
              ? tr.output
              : JSON.stringify(tr.output, null, 2);
            if (outputStr) {
              console.log(outputStr.length > 1000 ? outputStr.slice(0, 1000) + '...' : outputStr);
            } else {
              console.log('(empty result)');
            }
          } else {
            console.log('(no output)');
          }
        } else {
          console.log('\n📤 OUTPUT: (tool execution pending)');
        }
      }
    } else {
      console.log('\n💬 No tool calls this step');
    }

    console.log('\n');
    stepStartTime = performance.now();
  };
}

export function createAgent(
  tools: Record<string, any>,
  options: { maxSteps?: number; activationManager?: any } = {}
) {
  const { maxSteps = 50, activationManager } = options;

  return createAgentWithRole('generic', tools, {
    modelType: 'standard',
    stopWhen: stepCountIs(maxSteps),
    prepareStep: createPrepareStep(activationManager),
    onStepFinish: createStepFinishHandler(),
  });
}
