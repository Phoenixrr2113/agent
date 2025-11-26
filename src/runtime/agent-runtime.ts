import type { ModelMessage } from 'ai';
import { initializeAgent } from '../application/initialization.js';
import { createAgent } from '../application/orchestrator.js';
import { logger } from '../core/logger.js';

export interface AgentConfig {
  workspaceRoot?: string;
  enableRAG?: boolean;
  askUserHandler?: AskUserHandler;
}

export interface TaskInput {
  prompt?: string;
  messages?: ModelMessage[];
}

export interface TaskResult {
  text: string;
  messages: ModelMessage[];
  completed: boolean;
  needsInput: boolean;
  pendingQuestion?: string;
  stepsUsed: number;
  toolsUsed: string[];
}

export type AskUserHandler = (question: string) => Promise<string>;

export interface AgentSession {
  send(message: string): Promise<TaskResult>;
  runTask(input: TaskInput): Promise<TaskResult>;
  getHistory(): ModelMessage[];
  clearHistory(): void;
}

export interface AgentRuntime {
  createSession(): AgentSession;
  shutdown(): Promise<void>;
}

export async function createAgentRuntime(config: AgentConfig = {}): Promise<AgentRuntime> {
  logger.info('🚀 Creating agent runtime');

  const initResult = await initializeAgent({
    workspaceRoot: config.workspaceRoot,
    enableRAG: config.enableRAG ?? true,
    enableReadline: false,
  });
  const { tools, codebaseRAG } = initResult;

  if (config.askUserHandler) {
    tools.ask_user = {
      ...tools.ask_user,
      execute: async (args: { question: string }) => {
        return config.askUserHandler!(args.question);
      },
    };
  } else {
    tools.ask_user = {
      ...tools.ask_user,
      execute: async (args: { question: string }) => {
        logger.info('🤖 ask_user auto-approved', { question: args.question });
        return 'yes';
      },
    };
  }

  const agent = createAgent(tools);

  const createSession = (): AgentSession => {
    let conversationHistory: ModelMessage[] = [];

    const runTask = async (input: TaskInput): Promise<TaskResult> => {
      if (input.prompt) {
        conversationHistory.push({ role: 'user', content: input.prompt });
      } else if (input.messages) {
        conversationHistory = [...conversationHistory, ...input.messages];
      }

      logger.info('🧠 Sending request to AI model...');
      logger.debug('📤 Messages being sent', { count: conversationHistory.length });
      const startTime = Date.now();

      const result = await agent.generate({
        messages: conversationHistory,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info('✅ AI model responded', { elapsedSeconds: elapsed, steps: result.steps.length });
      logger.debug('📥 Raw response text', { text: result.text?.slice(0, 500) });

      const allToolCalls = result.steps.flatMap((step: any) => step.toolCalls || []);
      if (allToolCalls.length > 0) {
        logger.info('🔧 Total tool calls made', { count: allToolCalls.length });
      } else {
        logger.warn('⚠️ No tool calls made - model may not be using tools correctly');
      }

      conversationHistory = result.response.messages;

      const modifiedFiles = result.steps.some((step: any) =>
        step.toolCalls?.some((tc: any) =>
          ['write_file', 'edit_file', 'create_directory'].includes(tc.toolName)
        )
      );
      if (modifiedFiles) {
        await codebaseRAG.indexCodebase();
      }

      const completed = result.steps.some((step: any) =>
        step.toolCalls?.some((tc: any) => tc.toolName === 'task_complete')
      );

      const askUserCall = result.steps
        .flatMap((step: any) => step.toolCalls || [])
        .find((tc: any) => tc.toolName === 'ask_user');

      const needsInput = !!askUserCall;
      const pendingQuestion = askUserCall?.args?.question as string | undefined;

      const toolsUsed: string[] = [...new Set(
        result.steps.flatMap((step: any) =>
          step.toolCalls?.map((tc: any) => tc.toolName) || []
        )
      )];

      return {
        text: result.text,
        messages: result.response.messages,
        completed,
        needsInput,
        pendingQuestion,
        stepsUsed: result.steps.length,
        toolsUsed,
      };
    };

    return {
      send: async (message: string) => runTask({ prompt: message }),
      runTask,
      getHistory: () => [...conversationHistory],
      clearHistory: () => {
        conversationHistory = [];
      },
    };
  };

  return {
    createSession,
    shutdown: async () => {
      logger.info('🧹 Shutting down agent runtime');
    },
  };
}
