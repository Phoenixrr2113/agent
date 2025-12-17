import { logger, createPerformanceTimer, type PerformanceTimer, type StreamEventCallback } from '@agent/shared';

import { smoothStream } from 'ai';

import { initializeAgent } from '../application/initialization.js';
import { createAgent, createAgentWithStreaming } from '../application/orchestrator.js';
import { type AgentRole } from '../core/agents/roles.js';
import { createMemoryExtractor } from '../core/memory/extractor.js';
import { getPersistentTaskManager } from '../tools/background-tasks-persistent.js';
import { getMemoryProvider } from '../tools/memory.js';

import type { TaskMonitorCallback, PersistentTaskInfo } from '../tools/background-tasks/types.js';
import type { ModelMessage } from 'ai';

export interface AgentConfig {
  workspaceRoot?: string;
  askUserHandler?: AskUserHandler;
  maxSteps?: number;
  disableAgentSpawning?: boolean;
  disableAskUser?: boolean;
  role?: AgentRole;
  isSpawnedAgent?: boolean;
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
  performanceMetrics?: {
    totalDurationMs: number;
    agentExecutionMs: number;
    codebaseIndexingMs?: number;
  };
}

export type AskUserHandler = (question: string) => Promise<string>;

export interface AgentSession {
  send(message: string): Promise<TaskResult>;
  sendWithEvents(message: string, onEvent: StreamEventCallback): Promise<TaskResult>;
  runTask(input: TaskInput): Promise<TaskResult>;
  getHistory(): ModelMessage[];
  clearHistory(): void;
  getPerformanceTimer(): PerformanceTimer;
}

export interface AgentRuntime {
  createSession(): AgentSession;
  shutdown(): Promise<void>;
}

export async function createAgentRuntime(config: AgentConfig = {}): Promise<AgentRuntime> {
  logger.info('🚀 Creating agent runtime');

  const shouldIndexCodebase = config.role === 'coder';

  const initResult = await initializeAgent({
    workspaceRoot: config.workspaceRoot,
    enableReadline: false,
    enableCodebaseIndexing: shouldIndexCodebase,
    disableAgentSpawning: config.disableAgentSpawning,
  });
  const { tools, codebaseRAG, activationManager } = initResult;

  const memoryProvider = await getMemoryProvider();
  const memoryExtractor = createMemoryExtractor({ memoryProvider });

  const taskManager = getPersistentTaskManager(config.workspaceRoot);

  const startupSummary = taskManager.getStartupSummary();
  if (startupSummary.running.length > 0) {
    logger.info('📋 Background tasks detected at startup', {
      running: startupSummary.running.length,
      recentlyCompleted: startupSummary.recentlyCompleted.length,
      recentlyFailed: startupSummary.recentlyFailed.length,
    });

    for (const task of startupSummary.running) {
      const durationMs = Date.now() - task.startTime;
      const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(1);
      logger.info(`  ⚙️  Running: ${task.command.substring(0, 60)}`, {
        taskId: task.id,
        durationHours,
      });
    }

    for (const task of startupSummary.recentlyCompleted.slice(0, 3)) {
      logger.info(`  ✅ Completed: ${task.command.substring(0, 60)}`, {
        taskId: task.id,
      });
    }

    for (const task of startupSummary.recentlyFailed.slice(0, 3)) {
      logger.info(`  ❌ Failed: ${task.command.substring(0, 60)}`, {
        taskId: task.id,
        exitCode: task.exitCode,
      });
    }
  }




  if (config.askUserHandler) {
    const askUserHandler = config.askUserHandler;
    tools['ask_user'] = {
      ...tools['ask_user'],
      execute: async (args: { question: string }) => {
        return askUserHandler(args.question);
      },
    };
  } else {
    tools['ask_user'] = {
      ...tools['ask_user'],
      // eslint-disable-next-line @typescript-eslint/require-await
      execute: async (args: { question: string }) => {
        logger.info('🤖 ask_user auto-approved', { question: args.question });
        return 'yes';
      },
    };
  }

  if (config.disableAgentSpawning) {
    delete tools['start_agent_task'];
    delete tools['spawn_agent'];
    logger.info('🚫 Agent spawning disabled (prevents recursion)');
  }

  // Only start monitoring if not a sub-agent (to save resources)
  if (!config.disableAgentSpawning) {
    taskManager.startMonitoring((event: Parameters<TaskMonitorCallback>[0], task: PersistentTaskInfo) => {
      const durationMs = task.endTime ? task.endTime - task.startTime : 0;
      const durationString = durationMs > 3600000
        ? `${(durationMs / (1000 * 60 * 60)).toFixed(1)}h`
        : `${(durationMs / (1000 * 60)).toFixed(1)}m`;

      if (event === 'task_completed') {
        const lines = [
          `✅ Background task completed: ${task.command.substring(0, 60)}...`,
          `   Duration: ${durationString}`,
          `   Exit Code: ${task.exitCode}`,
        ];
        logger.info(lines.join('\n'));
      } else if (event === 'task_failed') {
        const lines = [
          `❌ Background task failed: ${task.command.substring(0, 60)}...`,
          `   Duration: ${durationString}`,
          `   Exit Code: ${task.exitCode}`,
        ];
        logger.error(lines.join('\n'));
      }
    });
  }

  if (config.disableAskUser) {
    delete tools['ask_user'];
    logger.info('🚫 ask_user disabled for sub-agent');
  }

  const agent = createAgent(tools, {
    activationManager,
    maxSteps: config.maxSteps || 50,
    role: config.role || 'generic',
    workspaceRoot: config.workspaceRoot,
    isSpawnedAgent: config.isSpawnedAgent,
  });

  let shutdownInProgress = false;
  const handleShutdown = async (signal: string) => {
    if (shutdownInProgress) return;
    shutdownInProgress = true;

    logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
      logger.info('🧹 Shutting down agent runtime');
      taskManager.stopMonitoring();
      taskManager.shutdown();
      await memoryExtractor.waitForPending();
      logger.info('✅ Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: String(error) });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  const createSession = (): AgentSession => {
    let conversationHistory: ModelMessage[] = [];
    const performanceTimer = createPerformanceTimer();

    const runTask = async (input: TaskInput): Promise<TaskResult> => {
      performanceTimer.reset();
      performanceTimer.start('runTask', 'agent-runtime', {
        hasPrompt: !!input.prompt,
        hasMessages: !!input.messages,
      });

      if (input.prompt) {
        conversationHistory.push({ role: 'user', content: input.prompt });
      } else if (input.messages) {
        conversationHistory = [...conversationHistory, ...input.messages];
      }

      logger.info('🧠 Sending request to AI model...');
      logger.debug('📤 Messages being sent', { count: conversationHistory.length });

      performanceTimer.start('agent.stream', 'agent-runtime', {
        messageCount: conversationHistory.length,
      });

      const result = await agent.stream({
        messages: conversationHistory,
        experimental_transform: smoothStream({ chunking: 'word' }),
      });

      const steps = await result.steps;
      const text = await result.text;
      const response = await result.response;

      const agentExecutionMs = performanceTimer.end('agent.stream', 'agent-runtime', {
        steps: steps.length,
      });

      logger.info('✅ AI model responded', {
        elapsedMs: agentExecutionMs?.toFixed(2),
        elapsedSec: agentExecutionMs ? (agentExecutionMs / 1000).toFixed(2) : 'unknown',
        steps: steps.length,
      });
      logger.debug('📥 Raw response text', { text: text?.slice(0, 500) });

      const allToolCalls = steps.flatMap((step: any) => step.toolCalls || []);
      if (allToolCalls.length > 0) {
        logger.info('🔧 Total tool calls made', { count: allToolCalls.length });
      } else {
        logger.warn('⚠️ No tool calls made - model may not be using tools correctly');
      }

      conversationHistory.push(...response.messages);

      Promise.resolve()
        .then(() => memoryExtractor.extractFromConversation(conversationHistory))
        .catch(error => {
          logger.error('Background memory extraction failed', { error: String(error) });
        });

      let codebaseIndexingMs: number | undefined;
      if (codebaseRAG) {
        const modifiedFiles = steps.some((step: any) =>
          step.toolCalls?.some((tc: any) =>
            ['write_file', 'edit_file', 'create_directory'].includes(tc.toolName)
          )
        );
        if (modifiedFiles) {
          performanceTimer.start('codebase.reindex', 'agent-runtime');
          await codebaseRAG.indexCodebase();
          codebaseIndexingMs = performanceTimer.end('codebase.reindex', 'agent-runtime');
        }
      }

      const completed = steps.some((step: any) =>
        step.toolCalls?.some((tc: any) => tc.toolName === 'task_complete')
      );

      const toolsUsed: string[] = [...new Set(
        steps.flatMap((step: any) =>
          step.toolCalls?.map((tc: any) => tc.toolName) || []
        )
      )] as string[];

      const askUserCall = steps
        .flatMap((step: any) => step.toolCalls || [])
        .find((tc: any) => tc.toolName === 'ask_user');

      const needsInput = !!askUserCall;
      const pendingQuestion = askUserCall?.args?.question as string | undefined;

      const totalDurationMs = performanceTimer.end('runTask', 'agent-runtime');

      performanceTimer.logSummary();

      return {
        text,
        messages: response.messages,
        completed,
        needsInput,
        pendingQuestion,
        stepsUsed: steps.length,
        toolsUsed,
        performanceMetrics: {
          totalDurationMs: totalDurationMs ?? 0,
          agentExecutionMs: agentExecutionMs ?? 0,
          codebaseIndexingMs,
        },
      };
    };

    return {
      send: async (message: string) => runTask({ prompt: message }),
      sendWithEvents: async (message: string, onEvent: StreamEventCallback): Promise<TaskResult> => {
        await onEvent({
          type: 'session:start',
          data: { sessionId: crypto.randomUUID() },
          timestamp: Date.now(),
        });

        performanceTimer.reset();
        performanceTimer.start('runTask', 'agent-runtime', {
          hasPrompt: true,
          hasMessages: false,
        });

        conversationHistory.push({ role: 'user', content: message });

        logger.info('🧠 Sending request to AI model (streaming)...');
        logger.debug('📤 Messages being sent', { count: conversationHistory.length });

        performanceTimer.start('agent.stream', 'agent-runtime', {
          messageCount: conversationHistory.length,
        });

        performanceTimer.start('agent.stream', 'agent-runtime', {
          messageCount: conversationHistory.length,
        });

        const scopedTools = { ...tools };
        if (!config.disableAgentSpawning) {
          scopedTools['spawn_agent'] = {
            ...tools['spawn_agent'],
            execute: async (args: {
              task: string;
              workspaceRoot?: string;
              maxSteps?: number;
              streaming?: boolean;
              role?: AgentRole;
            }) => {
              if (args.streaming) {
                logger.info('⤵️ Spawning in-process sub-agent (streaming)...', {
                  role: args.role,
                  task: args.task.slice(0, 50),
                });

                const effectiveRoot = args.workspaceRoot || config.workspaceRoot;

                const subRuntime = await createAgentRuntime({
                  workspaceRoot: effectiveRoot,
                  role: args.role,
                  disableAgentSpawning: true,
                  maxSteps: config.maxSteps || 50,
                  isSpawnedAgent: true,
                });

                const subSession = subRuntime.createSession();

                try {
                  const result = await subSession.sendWithEvents(args.task, async (event) => {
                    if (event.type === 'session:start') return;
                    await onEvent(event);
                  });

                  await subRuntime.shutdown();
                  return result.text;
                } catch (error) {
                  await subRuntime.shutdown();
                  throw error;
                }
              }

              return tools['spawn_agent'].execute(args);
            },
          };
        }

        const streamingAgent = createAgentWithStreaming(scopedTools, {
          activationManager,
          maxSteps: config.maxSteps || 50,
          role: config.role || 'generic',
          onEvent,
          workspaceRoot: config.workspaceRoot,
          isSpawnedAgent: config.isSpawnedAgent,
        });

        const result = await streamingAgent.stream({
          messages: conversationHistory,
          experimental_transform: smoothStream({ chunking: 'word' }),
        });

        let stepIndex = 0;

        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta':
              await onEvent({
                type: 'text:delta',
                data: { delta: part.text, stepIndex },
                timestamp: Date.now(),
              });
              break;

            case 'reasoning-delta':
              await onEvent({
                type: 'reasoning:delta',
                data: { delta: part.text, stepIndex },
                timestamp: Date.now(),
              });
              break;

            case 'tool-call':
              await onEvent({
                type: 'tool:call',
                data: {
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  args: (part as any).input as Record<string, unknown>,
                  stepIndex,
                },
                timestamp: Date.now(),
              });
              break;

            case 'tool-result':
              await onEvent({
                type: 'tool:result',
                data: {
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  result: (part as any).output,
                  durationMs: 0,
                  stepIndex,
                },
                timestamp: Date.now(),
              });
              break;

            case 'start-step':
              stepIndex++;
              await onEvent({
                type: 'step:start',
                data: { stepIndex },
                timestamp: Date.now(),
              });
              break;

            case 'finish-step':
              await onEvent({
                type: 'step:finish',
                data: { stepIndex, durationMs: 0 },
                timestamp: Date.now(),
              });
              break;
          }
        }

        const steps = await result.steps;
        const text = await result.text;
        const response = await result.response;

        const agentExecutionMs = performanceTimer.end('agent.stream', 'agent-runtime', {
          steps: steps.length,
        });

        logger.info('✅ AI model responded (streaming)', {
          elapsedMs: agentExecutionMs?.toFixed(2),
          elapsedSec: agentExecutionMs ? (agentExecutionMs / 1000).toFixed(2) : 'unknown',
          steps: steps.length,
        });

        conversationHistory.push(...response.messages);

        Promise.resolve()
          .then(() => memoryExtractor.extractFromConversation(conversationHistory))
          .catch(error => {
            logger.error('Background memory extraction failed', { error: String(error) });
          });

        let codebaseIndexingMs: number | undefined;
        if (codebaseRAG) {
          const modifiedFiles = steps.some((step: any) =>
            step.toolCalls?.some((tc: any) =>
              ['write_file', 'edit_file', 'create_directory'].includes(tc.toolName)
            )
          );
          if (modifiedFiles) {
            performanceTimer.start('codebase.reindex', 'agent-runtime');
            await codebaseRAG.indexCodebase();
            codebaseIndexingMs = performanceTimer.end('codebase.reindex', 'agent-runtime');
          }
        }

        const completed = steps.some((step: any) =>
          step.toolCalls?.some((tc: any) => tc.toolName === 'task_complete')
        );

        const toolsUsed: string[] = [...new Set(
          steps.flatMap((step: any) =>
            step.toolCalls?.map((tc: any) => tc.toolName) || []
          )
        )] as string[];

        const askUserCall = steps
          .flatMap((step: any) => step.toolCalls || [])
          .find((tc: any) => tc.toolName === 'ask_user');

        const needsInput = !!askUserCall;
        const pendingQuestion = askUserCall?.args?.question as string | undefined;

        const totalDurationMs = performanceTimer.end('runTask', 'agent-runtime');

        performanceTimer.logSummary();

        const taskResult: TaskResult = {
          text,
          messages: response.messages,
          completed,
          needsInput,
          pendingQuestion,
          stepsUsed: steps.length,
          toolsUsed,
          performanceMetrics: {
            totalDurationMs: totalDurationMs ?? 0,
            agentExecutionMs: agentExecutionMs ?? 0,
            codebaseIndexingMs,
          },
        };

        await onEvent({
          type: 'complete',
          data: {
            text: taskResult.text,
            completed: taskResult.completed,
            needsInput: taskResult.needsInput,
            pendingQuestion: taskResult.pendingQuestion,
            stepsUsed: taskResult.stepsUsed,
            toolsUsed: taskResult.toolsUsed,
          },
          timestamp: Date.now(),
        });

        return taskResult;
      },
      runTask,
      getHistory: () => [...conversationHistory],
      clearHistory: () => {
        conversationHistory = [];
      },
      getPerformanceTimer: () => performanceTimer,
    };
  };

  return {
    createSession,
    shutdown: async () => {
      logger.info('🧹 Shutting down agent runtime');
      taskManager.stopMonitoring();
      taskManager.shutdown();
      await memoryExtractor.waitForPending();
    },
  };
}
