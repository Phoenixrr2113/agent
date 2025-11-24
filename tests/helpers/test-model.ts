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

  const result = await generateText(options);

  await fs.appendFile(logFile, `\n=== Result ===\n`);
  await fs.appendFile(logFile, `Text output:\n${result.text}\n\n`);

  await fs.appendFile(logFile, `Steps (${result.steps.length}):\n`);
  result.steps.forEach((step: any, idx: number) => {
    fs.appendFile(logFile, `\nStep ${idx + 1}:\n`);
    fs.appendFile(logFile, `  Text: ${step.text || '(none)'}\n`);
    if (step.toolCalls?.length) {
      fs.appendFile(logFile, `  Tool calls:\n`);
      step.toolCalls.forEach((tc: any) => {
        fs.appendFile(logFile, `    - ${tc.toolName}(${JSON.stringify(tc.args)})\n`);
      });
    }
    if (step.toolResults?.length) {
      fs.appendFile(logFile, `  Tool results:\n`);
      step.toolResults.forEach((tr: any) => {
        const resultStr = typeof tr.result === 'string'
          ? tr.result.substring(0, 200)
          : JSON.stringify(tr.result).substring(0, 200);
        fs.appendFile(logFile, `    - ${tr.toolName}: ${resultStr}\n`);
      });
    }
    fs.appendFile(logFile, `  Finish reason: ${step.finishReason}\n`);
  });

  await fs.appendFile(logFile, `\nToken usage:\n`);
  await fs.appendFile(logFile, `  Total: ${result.totalUsage.totalTokens}\n`);
  await fs.appendFile(logFile, `  Prompt: ${result.totalUsage.promptTokens}\n`);
  await fs.appendFile(logFile, `  Completion: ${result.totalUsage.completionTokens}\n`);

  return result;
}
