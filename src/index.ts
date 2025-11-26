const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions?.node;

if (isBrowser) {
  throw new Error(
    'This package is server-side only (Node.js). ' +
    'It uses native modules (better-sqlite3) and Node.js APIs (child_process, fs) ' +
    'that are not available in browsers. ' +
    'To use this agent in a frontend, run it as a backend service and connect via HTTP/WebSocket.'
  );
}

if (!isNode) {
  throw new Error(
    'This package requires Node.js >= 20. ' +
    'Current environment does not appear to be Node.js.'
  );
}

export {
  createAgentRuntime,
  type AgentRuntime,
  type AgentSession,
  type AgentConfig,
  type TaskInput,
  type TaskResult,
  type AskUserHandler,
} from './runtime/agent-runtime.js';

export type { ModelMessage } from 'ai';
