import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PersistentTaskManager } from './task-manager.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync, existsSync } from 'fs';

describe('PersistentTaskManager', () => {
  let taskManager: PersistentTaskManager;
  let workDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    workDir = join(tmpdir(), `agent-test-${Date.now()}-${Math.random()}`);
    mkdirSync(workDir, { recursive: true });

    taskManager = new PersistentTaskManager(workDir);
  });

  afterEach(() => {
    taskManager.shutdown();
    try {
      if (existsSync(workDir)) {
        rmSync(workDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it('should initialize correctly', () => {
    expect(taskManager).toBeDefined();
    expect(taskIdGenerator(taskManager)).toBeDefined();
  });

  it('should generate unique task IDs', () => {
    const id1 = taskManager.generateTaskId();
    const id2 = taskManager.generateTaskId();
    expect(id1).toMatch(/^task_[0-9a-f]+$/);
    expect(id1).not.toBe(id2);
  });

  it('should start a task', async () => {
    const taskId = taskManager.startTask('echo "hello"', workDir);
    expect(taskId).toBeDefined();

    const task = taskManager.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.command).toBe('echo "hello"');
    expect(task?.status).toBe('running');

    // Wait for task completion
    await new Promise<void>(resolve => {
      const interval = setInterval(() => {
        const t = taskManager.getTask(taskId);
        if (t?.status !== 'running') {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });

    const completedTask = taskManager.getTask(taskId);
    expect(completedTask?.status).toBe('completed');
    expect(completedTask?.exitCode).toBe(0);
  });

  it('should capture task output', async () => {
    const taskId = taskManager.startTask('echo "output testing"', workDir);
    
    await new Promise<void>(resolve => {
      const interval = setInterval(() => {
        const t = taskManager.getTask(taskId);
        if (t?.status !== 'running') {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });

    const output = taskManager.getTaskOutput(taskId);
    expect(output.content).toContain('output testing');
  });

  it('should handle failed tasks', async () => {
    const taskId = taskManager.startTask('exit 1', workDir);

    await new Promise<void>(resolve => {
      const interval = setInterval(() => {
        const t = taskManager.getTask(taskId);
        if (t?.status !== 'running') {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });

    const task = taskManager.getTask(taskId);
    expect(task?.status).toBe('failed');
    expect(task?.exitCode).toBe(1);
  });

});

function taskIdGenerator(tm: PersistentTaskManager) {
    return tm.generateTaskId();
}
