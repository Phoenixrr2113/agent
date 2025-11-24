import { models } from '../../src/agents.js';
import { generateText } from 'ai';
import fs from 'fs/promises';
import path from 'path';

export function getTestModel() {
  return models.standard();
}

export function hasModelProvider(): boolean {
  if (process.env.OLLAMA_ENABLED === 'true') {
    return true;
  }
  return !!process.env.OPENROUTER_API_KEY;
}

export async function generateTextWithLogging(options: Parameters<typeof generateText>[0]) {
  const testName = expect.getState().currentTestName || 'unknown-test';
  const timestamp = new Date().toISOString().replace(/:/g, '-');

  await fs.mkdir('./logs/tests', { recursive: true });

  const logFile = path.join('./logs/tests', `${testName.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.log`);

  await fs.appendFile(logFile, `\n=== Test: ${testName} ===\n`);
  await fs.appendFile(logFile, `=== Started: ${timestamp} ===\n\n`);
  await fs.appendFile(logFile, `Input messages:\n${JSON.stringify(options.messages || options.prompt, null, 2)}\n\n`);

  const toolCount = options.tools ? Object.keys(options.tools).length : 0;
  await fs.appendFile(logFile, `Tools available: ${toolCount}\n`);
  if (toolCount > 0) {
    await fs.appendFile(logFile, `Tool names: ${Object.keys(options.tools || {}).join(', ')}\n`);
  }
  await fs.appendFile(logFile, `Max steps: ${options.maxSteps || 'default'}\n\n`);

  const result = await generateText(options);

  await fs.appendFile(logFile, `\n=== Result ===\n`);

  // Log reasoning if present (for reasoning models like DeepSeek-R1)
  if (result.reasoningText) {
    await fs.appendFile(logFile, `Reasoning:\n${result.reasoningText}\n\n`);
  }

  await fs.appendFile(logFile, `Text output:\n${result.text}\n\n`);

  await fs.appendFile(logFile, `Steps (${result.steps.length}):\n`);
  for (const [idx, step] of result.steps.entries()) {
    await fs.appendFile(logFile, `\nStep ${idx + 1}:\n`);
    await fs.appendFile(logFile, `  Text: ${step.text || '(none)'}\n`);

    if (step.toolCalls?.length) {
      await fs.appendFile(logFile, `  Tool calls (${step.toolCalls.length}):\n`);
      for (const tc of step.toolCalls) {
        await fs.appendFile(logFile, `    - ${tc.toolName}(${JSON.stringify(tc.args)})\n`);
      }
    }

    if (step.toolResults?.length) {
      await fs.appendFile(logFile, `  Tool results (${step.toolResults.length}):\n`);
      for (const tr of step.toolResults) {
        let resultStr = '(undefined)';
        if (tr.result !== undefined && tr.result !== null) {
          if (typeof tr.result === 'string') {
            resultStr = tr.result.substring(0, 200);
          } else {
            const jsonStr = JSON.stringify(tr.result);
            resultStr = jsonStr ? jsonStr.substring(0, 200) : '(unable to stringify)';
          }
        }
        await fs.appendFile(logFile, `    - ${tr.toolName}: ${resultStr}\n`);
      }
    }

    await fs.appendFile(logFile, `  Finish reason: ${step.finishReason}\n`);
  }

  await fs.appendFile(logFile, `\nToken usage:\n`);
  await fs.appendFile(logFile, `  Total: ${result.totalUsage.totalTokens}\n`);
  await fs.appendFile(logFile, `  Prompt: ${result.totalUsage.promptTokens}\n`);
  await fs.appendFile(logFile, `  Completion: ${result.totalUsage.completionTokens}\n`);
  if (result.usage.reasoningTokens) {
    await fs.appendFile(logFile, `  Reasoning: ${result.usage.reasoningTokens}\n`);
  }

  return result;
}
