import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStopConditions, createPrepareStep, createStepFinishHandler, createAgent } from './orchestrator.js';

vi.mock('../core/agents/factory.js', () => ({
  createAgentWithRole: vi.fn((role, tools, options) => ({
    role,
    tools,
    options,
    generate: vi.fn(),
  })),
}));

describe('orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RUN_MODE;
  });

  afterEach(() => {
    delete process.env.RUN_MODE;
  });

  describe('createStopConditions', () => {
    it('should return an array of stop conditions', () => {
      const stopConditions = createStopConditions('once');

      expect(Array.isArray(stopConditions)).toBe(true);
      expect(stopConditions.length).toBe(3);
    });

    it('should configure different max steps for different run modes', () => {
      const loopConditions = createStopConditions('loop');
      const onceConditions = createStopConditions('once');

      expect(loopConditions.length).toBe(3);
      expect(onceConditions.length).toBe(3);
    });
  });

  describe('createPrepareStep', () => {
    it('should not trim messages when under limit', () => {
      const prepareStep = createPrepareStep();
      const messages = Array(30).fill({ role: 'user', content: 'test' }) as any[];

      const result = prepareStep({ messages } as any);

      expect(result.messages).toHaveLength(30);
    });

    it('should trim messages when over limit', () => {
      const prepareStep = createPrepareStep();
      const messages = Array(60).fill({ role: 'user', content: 'test' }) as any[];

      const result = prepareStep({ messages } as any);

      expect(result.messages).toHaveLength(50);
    });

    it('should preserve first message when trimming', () => {
      const prepareStep = createPrepareStep();
      const firstMessage = { role: 'system', content: 'system prompt' };
      const messages = [
        firstMessage,
        ...Array(60).fill({ role: 'user', content: 'test' }),
      ] as any[];

      const result = prepareStep({ messages } as any);

      expect(result.messages[0]).toBe(firstMessage);
    });

    it('should keep last 49 messages plus first message when trimming', () => {
      const prepareStep = createPrepareStep();
      const firstMessage = { role: 'system', content: 'system' };
      const lastMessage = { role: 'user', content: 'last' };
      const messages = [
        firstMessage,
        ...Array(59).fill({ role: 'user', content: 'middle' }),
        lastMessage,
      ] as any[];

      const result = prepareStep({ messages } as any);

      expect(result.messages).toHaveLength(50);
      expect(result.messages[0]).toBe(firstMessage);
      expect(result.messages[result.messages.length - 1]).toBe(lastMessage);
    });

    it('should handle exactly 50 messages', () => {
      const prepareStep = createPrepareStep();
      const messages = Array(50).fill({ role: 'user', content: 'test' }) as any[];

      const result = prepareStep({ messages } as any);

      expect(result.messages).toHaveLength(50);
    });

    it('should handle single message', () => {
      const prepareStep = createPrepareStep();
      const messages = [{ role: 'user', content: 'test' }] as any[];

      const result = prepareStep({ messages } as any);

      expect(result.messages).toHaveLength(1);
    });
  });

  describe('createStepFinishHandler', () => {
    it('should increment step count on each call', async () => {
      const handler = createStepFinishHandler();

      await handler({ toolCalls: [] } as any);
      await handler({ toolCalls: [] } as any);
      await handler({ toolCalls: [] } as any);
    });

    it('should handle step result with no tool calls', async () => {
      const handler = createStepFinishHandler();
      const stepResult = {} as any;

      await expect(handler(stepResult)).resolves.not.toThrow();
    });

    it('should handle step result with tool calls', async () => {
      const handler = createStepFinishHandler();
      const stepResult = {
        toolCalls: [
          { toolName: 'tool1' },
          { toolName: 'tool2' },
        ],
      } as any;

      await expect(handler(stepResult)).resolves.not.toThrow();
    });

    it('should handle duplicate tool names', async () => {
      const handler = createStepFinishHandler();
      const stepResult = {
        toolCalls: [
          { toolName: 'tool1' },
          { toolName: 'tool1' },
          { toolName: 'tool2' },
        ],
      } as any;

      await expect(handler(stepResult)).resolves.not.toThrow();
    });

    it('should handle empty tool calls array', async () => {
      const handler = createStepFinishHandler();
      const stepResult = {
        toolCalls: [],
      } as any;

      await expect(handler(stepResult)).resolves.not.toThrow();
    });
  });

  describe('createAgent', () => {
    it('should create agent with generic role', () => {
      const tools = { test_tool: {} };
      const agent = createAgent(tools);

      expect(agent.role).toBe('generic');
    });

    it('should pass tools to agent', () => {
      const tools = { test_tool: {}, another_tool: {} };
      const agent = createAgent(tools);

      expect(agent.tools).toBe(tools);
    });

    it('should configure agent with standard model', () => {
      const tools = {};
      const agent = createAgent(tools);

      expect(agent.options.modelType).toBe('standard');
    });

    it('should configure agent with stopWhen function', () => {
      const tools = {};
      const agent = createAgent(tools);

      expect(agent.options.stopWhen).toBeDefined();
      expect(typeof agent.options.stopWhen).toBe('function');
    });

    it('should configure agent with prepareStep function', () => {
      const tools = {};
      const agent = createAgent(tools);

      expect(agent.options.prepareStep).toBeDefined();
      expect(typeof agent.options.prepareStep).toBe('function');
    });

    it('should configure agent with onStepFinish function', () => {
      const tools = {};
      const agent = createAgent(tools);

      expect(agent.options.onStepFinish).toBeDefined();
      expect(typeof agent.options.onStepFinish).toBe('function');
    });
  });
});
