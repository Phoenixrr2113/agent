import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateText } from 'ai';
import { z } from 'zod';
import { setupTestWorkspace, teardownTestWorkspace } from '../helpers/test-utils.js';
import { getTestModel, hasModelProvider } from '../helpers/test-model.js';

describe.skipIf(!hasModelProvider())('Interactive Mode E2E tests', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await setupTestWorkspace('e2e-interactive');
  });

  afterEach(async () => {
    await teardownTestWorkspace(workspace);
  });

  it('should handle ask_user tool for clarification', async () => {
    const userResponses = ['Yes, please proceed', 'Blue'];
    let responseIndex = 0;

    const tools = {
      ask_user: {
        description: 'Ask the user a question and wait for their response',
        parameters: z.object({
          question: z.string(),
        }),
        execute: async ({ question }: { question: string }) => {
          expect(question).toBeTruthy();
          return userResponses[responseIndex++] || 'default response';
        },
      },
    };

    const result = await generateText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'Ask me if I want to proceed, then ask me my favorite color',
        },
      ],
      tools,
      maxSteps: 5,
    });


    expect(result.messages).toBeDefined();
    const toolCalls = result.messages.filter(
      (m: any) => m.role === 'assistant' && m.toolInvocations
    );
    expect(toolCalls.length).toBeGreaterThan(0);
  });

  it('should handle task_complete tool to signal completion', async () => {
    let taskCompleted = false;
    let completionSummary = '';

    const tools = {
      task_complete: {
        description: 'Call this when you have fully completed the task',
        parameters: z.object({
          summary: z.string(),
        }),
        execute: async ({ summary }: { summary: string }) => {
          taskCompleted = true;
          completionSummary = summary;
          return `Task completed: ${summary}`;
        },
      },
    };

    const result = await generateText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'Complete this simple task: say hello, then call task_complete',
        },
      ],
      tools,
      maxSteps: 5,
    });


    expect(taskCompleted).toBe(true);
    expect(completionSummary).toBeTruthy();
  });

  it('should use dynamic stop condition based on task_complete', async () => {
    let stepCount = 0;
    const tools = {
      count_step: {
        description: 'Count a step',
        parameters: z.object({}),
        execute: async () => {
          stepCount++;
          return `Step ${stepCount}`;
        },
      },
      task_complete: {
        description: 'Signal task completion',
        parameters: z.object({
          summary: z.string(),
        }),
        execute: async ({ summary }: { summary: string }) => {
          return `Completed: ${summary}`;
        },
      },
    };

    function stopWhen(result: any): boolean {
      const hasTaskComplete = result.toolCalls?.some(
        (call: any) => call.toolName === 'task_complete'
      );
      return hasTaskComplete || result.stepCount >= 10;
    }

    const result = await generateText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'Count 2 steps, then call task_complete',
        },
      ],
      tools,
      stopWhen,
    });


    expect(result.steps).toBeLessThan(10);
    const hasTaskComplete = result.messages.some(
      (m: any) => m.role === 'assistant' &&
        m.toolInvocations?.some((t: any) => t.toolName === 'task_complete')
    );
    expect(hasTaskComplete).toBe(true);
  });

  it('should maintain conversation history across multiple turns', async () => {
    const conversationHistory: any[] = [];
    const tools = {
      remember: {
        description: 'Remember a fact',
        parameters: z.object({
          fact: z.string(),
        }),
        execute: async ({ fact }: { fact: string }) => {
          return `Remembered: ${fact}`;
        },
      },
    };

    conversationHistory.push({
      role: 'user',
      content: 'Remember that my name is Alice',
    });

    const result1 = await generateText({
      model: getTestModel(),
      messages: conversationHistory,
      tools,
      maxSteps: 3,
    });

    conversationHistory.push(...result1.messages);

    conversationHistory.push({
      role: 'user',
      content: 'What is my name?',
    });

    const result2 = await generateText({
      model: getTestModel(),
      messages: conversationHistory,
      tools,
      maxSteps: 3,
    });

    expect(conversationHistory.length).toBeGreaterThan(2);
    const finalText = result2.messages
      .filter((m: any) => m.role === 'assistant')
      .map((m: any) => m.content)
      .join(' ')
      .toLowerCase();

    expect(finalText).toContain('alice');
  });
});
