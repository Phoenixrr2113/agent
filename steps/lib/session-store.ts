import { createAgentRuntime, type AgentSession, type AgentRuntime } from '@agent/core';

let runtimeInstance: AgentRuntime | null = null;
const sessions = new Map<string, AgentSession>();

export async function getRuntime(): Promise<AgentRuntime> {
  if (!runtimeInstance) {
    runtimeInstance = await createAgentRuntime({
      workspaceRoot: process.env.WORKSPACE_ROOT,
    });
  }
  return runtimeInstance;
}

export async function createSession(sessionId: string): Promise<AgentSession> {
  const runtime = await getRuntime();
  const session = runtime.createSession();
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): AgentSession | undefined {
  return sessions.get(sessionId);
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function hasSession(sessionId: string): boolean {
  return sessions.has(sessionId);
}

export async function shutdownRuntime(): Promise<void> {
  if (runtimeInstance) {
    await runtimeInstance.shutdown();
    runtimeInstance = null;
  }
  sessions.clear();
}
