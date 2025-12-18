import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLogCollector, getLogCollector, resetLogCollector } from './log-collector.js';
import type { StreamEvent } from '../streaming/types.js';
import type { AgentIdentifier, DashboardEvent } from './types.js';

describe('createLogCollector', () => {
  let collector: ReturnType<typeof createLogCollector>;

  beforeEach(() => {
    collector = createLogCollector();
  });

  describe('subscribe', () => {
    it('should emit initial state snapshot to new subscribers', () => {
      const callback = vi.fn();
      collector.subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as DashboardEvent;
      expect(event.type).toBe('state:snapshot');
      expect(event.data).toHaveProperty('state');
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = collector.subscribe(callback);

      callback.mockClear();
      unsubscribe();

      const agent: AgentIdentifier = {
        agentId: 'agent-1',
        sessionId: 'session-1',
        agentType: 'main',
      };
      collector.startRound(agent, 'test message');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('startRound', () => {
    it('should create a new session and round', () => {
      const agent: AgentIdentifier = {
        agentId: 'agent-1',
        sessionId: 'session-1',
        agentType: 'main',
      };

      const round = collector.startRound(agent, 'Hello world');

      expect(round.roundId).toBeDefined();
      expect(round.agentId).toBe('agent-1');
      expect(round.sessionId).toBe('session-1');
      expect(round.roundIndex).toBe(0);
      expect(round.input.message).toBe('Hello world');
      expect(round.status).toBe('pending');

      const session = collector.getSession('session-1');
      expect(session).toBeDefined();
      expect(session?.agentType).toBe('main');
      expect(session?.rounds.length).toBe(1);
    });

    it('should emit session:created and round:started events', () => {
      const callback = vi.fn();
      collector.subscribe(callback);
      callback.mockClear();

      const agent: AgentIdentifier = {
        agentId: 'agent-1',
        sessionId: 'session-1',
        agentType: 'main',
      };
      collector.startRound(agent, 'test');

      const events = callback.mock.calls.map((call) => (call[0] as DashboardEvent).type);
      expect(events).toContain('session:created');
      expect(events).toContain('round:started');
    });

    it('should handle spawned agents with parent', () => {
      const agent: AgentIdentifier = {
        agentId: 'agent-2',
        sessionId: 'session-2',
        agentType: 'spawned',
        parentAgentId: 'agent-1',
        role: 'coder',
      };

      collector.startRound(agent, 'sub task');

      const session = collector.getSession('session-2');
      expect(session?.agentType).toBe('spawned');
      expect(session?.parentAgentId).toBe('agent-1');
      expect(session?.role).toBe('coder');
    });
  });

  describe('processStreamEvent', () => {
    const agent: AgentIdentifier = {
      agentId: 'agent-1',
      sessionId: 'session-1',
      agentType: 'main',
    };

    it('should handle session:start event and create round', () => {
      const event: StreamEvent = {
        type: 'session:start',
        data: { sessionId: 'session-1' },
        timestamp: Date.now(),
      };

      collector.processStreamEvent(agent, event, 'Hello world');

      const session = collector.getSession('session-1');
      expect(session).toBeDefined();
      expect(session?.rounds.length).toBe(1);
    });

    it('should handle tool:call event', () => {
      collector.startRound(agent, 'test');

      const event: StreamEvent = {
        type: 'tool:call',
        data: {
          toolCallId: 'tool-1',
          toolName: 'read_file',
          args: { path: '/test.ts' },
          stepIndex: 0,
        },
        timestamp: Date.now(),
      };

      collector.processStreamEvent(agent, event);

      const session = collector.getSession('session-1');
      const round = session?.rounds[0];
      expect(round?.toolExecutions.length).toBe(1);
      expect(round?.toolExecutions[0].toolName).toBe('read_file');
      expect(round?.toolExecutions[0].status).toBe('running');
    });

    it('should handle tool:result event', () => {
      collector.startRound(agent, 'test');

      const callEvent: StreamEvent = {
        type: 'tool:call',
        data: {
          toolCallId: 'tool-1',
          toolName: 'read_file',
          args: { path: '/test.ts' },
          stepIndex: 0,
        },
        timestamp: Date.now(),
      };
      collector.processStreamEvent(agent, callEvent);

      const resultEvent: StreamEvent = {
        type: 'tool:result',
        data: {
          toolCallId: 'tool-1',
          toolName: 'read_file',
          result: 'file content',
          durationMs: 100,
          stepIndex: 0,
        },
        timestamp: Date.now() + 100,
      };
      collector.processStreamEvent(agent, resultEvent);

      const session = collector.getSession('session-1');
      const tool = session?.rounds[0].toolExecutions[0];
      expect(tool?.status).toBe('success');
      expect(tool?.result).toBe('file content');
    });

    it('should handle error event', () => {
      collector.startRound(agent, 'test');

      const callback = vi.fn();
      collector.subscribe(callback);
      callback.mockClear();

      const event: StreamEvent = {
        type: 'error',
        data: {
          message: 'Something went wrong',
          code: 'TEST_ERROR',
        },
        timestamp: Date.now(),
      };

      collector.processStreamEvent(agent, event);

      const session = collector.getSession('session-1');
      const round = session?.rounds[0];
      expect(round?.errors.length).toBe(1);
      expect(round?.errors[0].message).toBe('Something went wrong');
      expect(round?.errors[0].code).toBe('TEST_ERROR');
      expect(collector.state.totalErrors).toBe(1);
    });

    it('should handle complete event', () => {
      collector.startRound(agent, 'test');

      const event: StreamEvent = {
        type: 'complete',
        data: {
          text: 'Task completed',
          completed: true,
          needsInput: false,
          stepsUsed: 3,
          toolsUsed: ['read_file', 'write_file'],
        },
        timestamp: Date.now(),
      };

      collector.processStreamEvent(agent, event);

      const session = collector.getSession('session-1');
      const round = session?.rounds[0];
      expect(round?.status).toBe('completed');
      expect(round?.output?.text).toBe('Task completed');
      expect(round?.output?.completed).toBe(true);
      expect(round?.stepsUsed).toBe(3);
      expect(round?.performance).toBeDefined();
    });

    it('should handle reasoning:finish event', () => {
      collector.startRound(agent, 'test');

      const event: StreamEvent = {
        type: 'reasoning:finish',
        data: {
          reasoning: 'I will read the file first',
          durationMs: 500,
          stepIndex: 0,
        },
        timestamp: Date.now(),
      };

      collector.processStreamEvent(agent, event);

      const session = collector.getSession('session-1');
      const round = session?.rounds[0];
      expect(round?.reasoning.length).toBe(1);
      expect(round?.reasoning[0].content).toBe('I will read the file first');
    });
  });

  describe('createEventHandler', () => {
    it('should create handler that processes events', () => {
      const agent: AgentIdentifier = {
        agentId: 'agent-1',
        sessionId: 'session-1',
        agentType: 'main',
      };

      const handler = collector.createEventHandler(agent, 'Hello world');

      const startEvent: StreamEvent = {
        type: 'session:start',
        data: { sessionId: 'session-1' },
        timestamp: Date.now(),
      };
      handler(startEvent);

      const session = collector.getSession('session-1');
      expect(session).toBeDefined();
      expect(session?.rounds.length).toBe(1);
      expect(session?.rounds[0].input.message).toBe('Hello world');
    });
  });

  describe('getSnapshot', () => {
    it('should return serializable state', () => {
      const agent: AgentIdentifier = {
        agentId: 'agent-1',
        sessionId: 'session-1',
        agentType: 'main',
      };
      collector.startRound(agent, 'test');

      const snapshot = collector.getSnapshot();

      expect(Array.isArray(snapshot.sessions)).toBe(true);
      expect(snapshot.sessions.length).toBe(1);
      expect(snapshot.activeSessionIds).toContain('session-1');
      expect(snapshot.totalRounds).toBe(1);
    });
  });

  describe('clear', () => {
    it('should reset all state', () => {
      const agent: AgentIdentifier = {
        agentId: 'agent-1',
        sessionId: 'session-1',
        agentType: 'main',
      };
      collector.startRound(agent, 'test');

      collector.clear();

      expect(collector.state.sessions.size).toBe(0);
      expect(collector.state.activeSessionIds.length).toBe(0);
      expect(collector.state.totalRounds).toBe(0);
    });
  });

  describe('maxSessions limit', () => {
    it('should remove oldest session when limit exceeded', () => {
      const limitedCollector = createLogCollector({ maxSessions: 2 });

      for (let i = 0; i < 3; i++) {
        const agent: AgentIdentifier = {
          agentId: `agent-${i}`,
          sessionId: `session-${i}`,
          agentType: 'main',
        };
        limitedCollector.startRound(agent, `test ${i}`);
      }

      expect(limitedCollector.state.sessions.size).toBe(2);
      expect(limitedCollector.getSession('session-0')).toBeUndefined();
      expect(limitedCollector.getSession('session-1')).toBeDefined();
      expect(limitedCollector.getSession('session-2')).toBeDefined();
    });
  });
});

describe('getLogCollector', () => {
  beforeEach(() => {
    resetLogCollector();
  });

  it('should return singleton instance', () => {
    const collector1 = getLogCollector();
    const collector2 = getLogCollector();

    expect(collector1).toBe(collector2);
  });
});

describe('resetLogCollector', () => {
  it('should reset the global collector', () => {
    const collector1 = getLogCollector();
    const agent: AgentIdentifier = {
      agentId: 'agent-1',
      sessionId: 'session-1',
      agentType: 'main',
    };
    collector1.startRound(agent, 'test');

    resetLogCollector();

    const collector2 = getLogCollector();
    expect(collector2).not.toBe(collector1);
    expect(collector2.state.sessions.size).toBe(0);
  });
});
