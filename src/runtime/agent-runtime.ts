import type { CoreMessage } from 'ai';
import { initializeAgent, cleanup } from '../application/initialization.js';
import { createAgent } from '../application/orchestrator.js';
import { logger } from '../core/logger.js';

export interface AgentConfig {
  workspaceRoot?: string;
  modelType?: 'fast' | 'standard' | 'reasoning' | 'powerful';
  maxSteps?: number;
  askUserHandler?: AskUserHandler;
}

export interface TaskInput {
  prompt?: string;
  messages?: CoreMessage[];
}

export interface TaskResult {
  text: string;
  messages: CoreMessage[];
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
  getHistory(): CoreMessage[];
  clearHistory(): void;
}

export interface AgentRuntime {
  createSession(): AgentSession;
  shutdown(): Promise<void>;
}

export async function createAgentRuntime(config: AgentConfig = {}): Promise<AgentRuntime> {
  logger.info('🚀 Creating agent runtime');

  const initResult = await initializeAgent();
  const { tools, mcpClients, usedClients, codebaseRAG, readline: rl } = initResult;

  if (config.askUserHandler) {
    const originalExecute = tools.ask_user.execute;
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
    let conversationHistory: CoreMessage[] = [];

    const runTask = async (input: TaskInput): Promise<TaskResult> => {
      if (input.prompt) {
        conversationHistory.push({ role: 'user', content: input.prompt });
      } else if (input.messages) {
        conversationHistory = [...conversationHistory, ...input.messages];
      }

      const result = await agent.generate({
        messages: conversationHistory,
      });

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
      cleanup(mcpClients, usedClients, rl);
    },
  };
}
