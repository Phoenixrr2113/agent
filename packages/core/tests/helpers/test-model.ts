import fs from 'node:fs/promises';
import path from 'node:path';

import { type GenerateTextResult, type LanguageModel, generateText } from 'ai';
import { expect } from 'vitest';

import { models } from '../../src/core/agents/models.js';

export function getTestModel(): LanguageModel {
   
  return models.standard();
}

export function hasModelProvider(): boolean {
  return process.env['OLLAMA_ENABLED'] === 'true' || !!process.env['OPENROUTER_API_KEY'];
}

async function appendLog(logFile: string, content: string): Promise<void> {
    await fs.appendFile(logFile, content);
}

async function logToolCalls(logFile: string, step: any): Promise<void> {
    if (step.toolCalls?.length) {
      await appendLog(logFile, `  Tool calls (${String(step.toolCalls.length)}):\n`);
      for (const tc of step.toolCalls) {
        await appendLog(logFile, `    - ${tc.toolName}(${JSON.stringify(tc.args)})\n`);
      }
    }
}

async function logToolResults(logFile: string, step: any): Promise<void> {
    if (step.toolResults?.length) {
      await appendLog(logFile, `  Tool results (${String(step.toolResults.length)}):\n`);
      for (const tr of step.toolResults) {
        let resultString = '(undefined)';
        if (tr.result !== undefined && tr.result !== null) {
          if (typeof tr.result === 'string') {
            resultString = tr.result.substring(0, 200);
          } else {
            const jsonString = JSON.stringify(tr.result);
            resultString = jsonString ? jsonString.substring(0, 200) : '(unable to stringify)';
          }
        }
        await appendLog(logFile, `    - ${tr.toolName}: ${resultString}\n`);
      }
    }
}

export async function generateTextWithLogging(options: Parameters<typeof generateText>[0]): Promise<GenerateTextResult<any, any>> {
  const testName = expect.getState().currentTestName ?? 'unknown-test';
  const timestamp = new Date().toISOString().replaceAll(':', '-');

  await fs.mkdir('./logs/tests', { recursive: true });

  const logFile = path.join('./logs/tests', `${testName.replaceAll(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.log`);

  await appendLog(logFile, `\n=== Test: ${testName} ===\n`);
  await appendLog(logFile, `=== Started: ${timestamp} ===\n\n`);
  
  const promptContent = options.messages ?? options.prompt;
  await appendLog(logFile, `Input messages:\n${JSON.stringify(promptContent, null, 2)}\n\n`);

  const toolCount = options.tools ? Object.keys(options.tools).length : 0;
  await appendLog(logFile, `Tools available: ${String(toolCount)}\n`);
  if (toolCount > 0) {
    await appendLog(logFile, `Tool names: ${Object.keys(options.tools ?? {}).join(', ')}\n`);
  }
  
  const maxSteps = (options as any).maxSteps;
  await appendLog(logFile, `Max steps: ${String(maxSteps ?? 'default')}\n\n`);

  const result = await generateText(options);

  await appendLog(logFile, `\n=== Result ===\n`);

  // Log reasoning if present (for reasoning models like DeepSeek-R1)
  if (result.reasoningText) {
    await appendLog(logFile, `Reasoning:\n${result.reasoningText}\n\n`);
  }

  await appendLog(logFile, `Text output:\n${result.text}\n\n`);

  await appendLog(logFile, `Steps (${String(result.steps.length)}):\n`);
  for (const [index, step] of result.steps.entries()) {
    await appendLog(logFile, `\nStep ${String(index + 1)}:\n`);
    await appendLog(logFile, `  Text: ${step.text ?? '(none)'}\n`);

    await logToolCalls(logFile, step);
    await logToolResults(logFile, step);

    await appendLog(logFile, `  Finish reason: ${step.finishReason}\n`);
  }

  await appendLog(logFile, `\nToken usage:\n`);
  // Use any cast to access usage properties if checking failed
  const usage = result.usage as any;
  await appendLog(logFile, `  Total: ${String(usage.totalTokens)}\n`);
  await appendLog(logFile, `  Prompt: ${String(usage.promptTokens)}\n`);
  await appendLog(logFile, `  Completion: ${String(usage.completionTokens)}\n`);
  
  if (usage.reasoningTokens) {
    await appendLog(logFile, `  Reasoning: ${String(usage.reasoningTokens)}\n`);
  }

  return result;
}
