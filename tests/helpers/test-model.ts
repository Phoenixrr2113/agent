import { models } from '../../src/agents.js';
import { streamText } from 'ai';
import type { ToolSet } from 'ai';
import type { CoreMessage } from 'ai';
import fs from 'fs/promises';

export function getTestModel() {
  return models.standard();
}

export function hasModelProvider(): boolean {
  if (process.env.OLLAMA_ENABLED === 'true') {
    return true;
  }
  return !!process.env.OPENROUTER_API_KEY;
}

let logsInitialized = false;

export async function streamTextWithLogging(params: {
  model: ReturnType<typeof getTestModel>;
  messages?: CoreMessage[];
  prompt?: string;
  tools?: ToolSet;
  maxSteps?: number;
}) {
  if (!logsInitialized) {
    await fs.mkdir('./logs/tests', { recursive: true });
    logsInitialized = true;
  }

  const result = streamText(params);

  (async () => {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        prompt: params.prompt,
        messagesCount: params.messages?.length,
        tools: params.tools ? Object.keys(params.tools) : [],
      };

      await fs.appendFile(
        './logs/tests/test-runs.jsonl',
        JSON.stringify(logEntry) + '\n'
      );

      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }

      await fs.appendFile(
        './logs/tests/test-outputs.log',
        `\n=== ${timestamp} ===\n${fullText}\n`
      );

      const response = await result.response;
      await fs.appendFile(
        './logs/tests/test-responses.jsonl',
        JSON.stringify({ timestamp, response: response.messages }) + '\n'
      );
    } catch (error) {
      console.error('Error logging test run:', error);
    }
  })();

  return result;
}
