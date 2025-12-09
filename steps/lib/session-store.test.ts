import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@agent/core', () => ({
  createAgentRuntime: vi.fn().mockResolvedValue({
    createSession: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue({
        text: 'Test response',
        completed: true,
        needsInput: false,
        stepsUsed: 1,
        toolsUsed: [],
      }),
      getHistory: vi.fn().mockReturnValue([]),
      clearHistory: vi.fn(),
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('session-store', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it('should create a session and store it', async () => {
    const { createSession, hasSession, getSession } = await import('./session-store.js');
    const sessionId = 'test-session-1';

    const session = await createSession(sessionId);

    expect(session).toBeDefined();
    expect(hasSession(sessionId)).toBe(true);
    expect(getSession(sessionId)).toBe(session);
  });

  it('should delete a session', async () => {
    const { createSession, deleteSession, hasSession } = await import('./session-store.js');
    const sessionId = 'test-session-2';

    await createSession(sessionId);
    expect(hasSession(sessionId)).toBe(true);

    const result = deleteSession(sessionId);

    expect(result).toBe(true);
    expect(hasSession(sessionId)).toBe(false);
  });

  it('should return undefined for non-existent session', async () => {
    const { getSession, hasSession } = await import('./session-store.js');

    expect(getSession('non-existent')).toBeUndefined();
    expect(hasSession('non-existent')).toBe(false);
  });
});
