export type ChainStatus = 'ready' | 'running' | 'complete' | 'error' | 'paused';
export type StepErrorHandler = 'retry' | 'skip' | 'abort';

export interface ChainStep {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  dependsOn?: string[];
  onError?: StepErrorHandler;
  maxRetries?: number;
  guidance?: string;
}

export interface Chain {
  id: string;
  goal: string;
  steps: ChainStep[];
  status: ChainStatus;
  results: Map<string, unknown>;
  currentStepIndex: number;
  createdAt: number;
}

export interface StepResult {
  stepId: string;
  tool: string;
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
}

export interface ChainResult {
  chainId: string;
  status: 'complete' | 'error' | 'paused';
  completedSteps: StepResult[];
  failedStep?: StepResult;
  remainingSteps?: string[];
  totalDurationMs: number;
}

export interface ChainExecutorConfig {
  tools: Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
  onStepComplete?: (step: StepResult) => void;
  onStepError?: (step: StepResult) => void;
}
