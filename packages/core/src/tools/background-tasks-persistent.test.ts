import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  getPersistentTaskManager,
  resetPersistentTaskManager,
  startBackgroundTaskTool,
  checkTaskStatusTool,
  getTaskOutputTool,
  cancelTaskTool,
  listTasksTool,
  cleanupOldTasksTool,
} from './background-tasks-persistent.js';

const TEST_WORKSPACE = join(process.cwd(), '.test-agent-workspace');

describe('PersistentTaskManager', () => {
  beforeEach(() => {
    if (existsSync(TEST_WORKSPACE)) {
      rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
    resetPersistentTaskManager();
  });

  afterEach(() => {
    resetPersistentTaskManager();
    if (existsSync(TEST_WORKSPACE)) {
      rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
  });

  describe('startTask', () => {
    it('should start a detached task and return task ID', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('echo "test"');

      expect(taskId).toMatch(/^task_[a-f0-9]{16}$/);

      const task = taskManager.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.command).toBe('echo "test"');
      expect(task?.status).toBe('running');
      expect(task?.pid).toBeGreaterThan(0);
    });

    it('should persist task to database', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('sleep 1');

      resetPersistentTaskManager();

      const newManager = getPersistentTaskManager(TEST_WORKSPACE);
      const task = newManager.getTask(taskId);

      expect(task).toBeDefined();
      expect(task?.id).toBe(taskId);
    });

    it('should write stdout to log file', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('echo "hello from stdout"');

      await new Promise(resolve => setTimeout(resolve, 300));

      const output = taskManager.getTaskOutput(taskId, { stderr: false });
      expect(output.content).toContain('hello from stdout');
    });

    it('should write stderr to separate log file', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('echo "error message" >&2');

      await new Promise(resolve => setTimeout(resolve, 300));

      const output = taskManager.getTaskOutput(taskId, { stderr: true });
      expect(output.content).toContain('error message');
    });

    it('should track task completion with exit code', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('exit 42');

      await new Promise(resolve => setTimeout(resolve, 300));

      const task = taskManager.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.exitCode).toBe(42);
      expect(task?.endTime).toBeDefined();
    });

    it('should handle long-running tasks', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('sleep 2 && echo "done"');

      await new Promise(resolve => setTimeout(resolve, 500));
      let task = taskManager.getTask(taskId);
      expect(task?.status).toBe('running');

      await new Promise(resolve => setTimeout(resolve, 2000));
      task = taskManager.getTask(taskId);
      expect(task?.status).toBe('completed');
    });
  });

  describe('getTask', () => {
    it('should return undefined for non-existent task', () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const task = taskManager.getTask('nonexistent');
      expect(task).toBeUndefined();
    });

    it('should return task info from database', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('echo "test"');

      const task = taskManager.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.id).toBe(taskId);
      expect(task?.logFile).toBeDefined();
      expect(task?.errorLogFile).toBeDefined();
    });
  });

  describe('getTaskOutput', () => {
    it('should read stdout from log file', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('echo "line 1"; echo "line 2"; echo "line 3"');

      await new Promise(resolve => setTimeout(resolve, 300));

      const output = taskManager.getTaskOutput(taskId);
      expect(output.content).toContain('line 1');
      expect(output.content).toContain('line 2');
      expect(output.content).toContain('line 3');
    });

    it('should truncate large output', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('for i in {1..100}; do echo "line $i"; done');

      await new Promise(resolve => setTimeout(resolve, 300));

      const output = taskManager.getTaskOutput(taskId, { maxBytes: 100 });
      expect(output.truncated).toBe(true);
      expect(output.content.length).toBeLessThanOrEqual(100);
    });

    it('should read from end of file when fromEnd is true', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('echo "first"; echo "second"; echo "third"');

      await new Promise(resolve => setTimeout(resolve, 300));

      const output = taskManager.getTaskOutput(taskId, {
        maxBytes: 20,
        fromEnd: true,
      });

      expect(output.content).toContain('third');
    });
  });

  describe('cancelTask', () => {
    it('should cancel running task', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('sleep 100');

      await new Promise(resolve => setTimeout(resolve, 200));

      const cancelled = taskManager.cancelTask(taskId);
      expect(cancelled).toBe(true);

      const task = taskManager.getTask(taskId);
      expect(task?.status).toBe('cancelled');
    });

    it('should return false for non-existent task', () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const cancelled = taskManager.cancelTask('nonexistent');
      expect(cancelled).toBe(false);
    });

    it('should return false for completed task', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('echo "done"');

      await new Promise(resolve => setTimeout(resolve, 300));

      const cancelled = taskManager.cancelTask(taskId);
      expect(cancelled).toBe(false);
    });
  });

  describe('getAllTasks', () => {
    it('should return all tasks', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      taskManager.startTask('echo "task1"');
      taskManager.startTask('echo "task2"');
      taskManager.startTask('sleep 5');

      const tasks = taskManager.getAllTasks();
      expect(tasks).toHaveLength(3);
    });

    it('should filter by status', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      taskManager.startTask('echo "task1"');
      taskManager.startTask('sleep 10');

      await new Promise(resolve => setTimeout(resolve, 300));

      const runningTasks = taskManager.getAllTasks({ status: 'running' });
      const completedTasks = taskManager.getAllTasks({ status: 'completed' });

      expect(runningTasks.length).toBeGreaterThanOrEqual(1);
      expect(completedTasks.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect limit', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      for (let i = 0; i < 10; i++) {
        taskManager.startTask(`echo "task${i}"`);
      }

      const tasks = taskManager.getAllTasks({ limit: 5 });
      expect(tasks).toHaveLength(5);
    });
  });

  describe('cleanupOldTasks', () => {
    it('should delete old completed tasks', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('echo "old task"');

      // Wait for task completion
      let task = taskManager.getTask(taskId);
      while (task?.status === 'running') {
        await new Promise(resolve => setTimeout(resolve, 100));
        task = taskManager.getTask(taskId);
      }

      const count = taskManager.cleanupOldTasks(0);
      expect(count).toBeGreaterThan(0);

      const deletedTask = taskManager.getTask(taskId);
      expect(deletedTask).toBeUndefined();
    });

    it('should not delete recent tasks', async () => {
      const taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('echo "recent task"');

      // Wait for task completion
      let task = taskManager.getTask(taskId);
      while (task?.status === 'running') {
        await new Promise(resolve => setTimeout(resolve, 100));
        task = taskManager.getTask(taskId);
      }

      const count = taskManager.cleanupOldTasks(86400000); // 1 day
      expect(count).toBe(0);

      const remainingTask = taskManager.getTask(taskId);
      expect(remainingTask).toBeDefined();
    });
  });

  describe('persistence across restarts', () => {
    it('should survive manager restart', async () => {
      let taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const taskId = taskManager.startTask('sleep 10');

      await new Promise(resolve => setTimeout(resolve, 200));

      resetPersistentTaskManager();

      taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const task = taskManager.getTask(taskId);

      expect(task).toBeDefined();
      expect(task?.id).toBe(taskId);
      expect(task?.status).toBe('running');
    });

    it('should detect orphaned tasks', async () => {
      let taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      // Start a long running task
      const taskId = taskManager.startTask('sleep 10');
      const taskInfo = taskManager.getTask(taskId);
      const pid = taskInfo?.pid;

      expect(pid).toBeDefined();

      resetPersistentTaskManager();

      // Kill the process manually to simulate crash/orphan
      if (pid) {
        try {
          process.kill(pid, 'SIGKILL');
          // Give OS time to update process table
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch {
          // Process might already be gone
        }
      }

      taskManager = getPersistentTaskManager(TEST_WORKSPACE);
      const task = taskManager.getTask(taskId);

      expect(task?.status).toBe('orphaned');
    });
  });
});

describe('Persistent Background Task Tools', () => {
  beforeEach(() => {
    if (existsSync(TEST_WORKSPACE)) {
      rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
    resetPersistentTaskManager();
  });

  afterEach(() => {
    resetPersistentTaskManager();
    if (existsSync(TEST_WORKSPACE)) {
      rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
  });

  describe('startBackgroundTaskTool', () => {
    it('should start task and return result', async () => {
      getPersistentTaskManager(TEST_WORKSPACE);

      const result = await startBackgroundTaskTool.execute({
        command: 'echo "test"',
      });

      const parsed = JSON.parse(result as string);
      expect(parsed.taskId).toMatch(/^task_[a-f0-9]{16}$/);
      expect(parsed.persistent).toBe(true);
    });
  });

  describe('checkTaskStatusTool', () => {
    it('should return task status', async () => {
      getPersistentTaskManager(TEST_WORKSPACE);

      const startResult = await startBackgroundTaskTool.execute({
        command: 'sleep 1',
      });

      const startParsed = JSON.parse(startResult as string);
      const taskId = startParsed.taskId;

      const statusResult = await checkTaskStatusTool.execute({ taskId });
      const statusParsed = JSON.parse(statusResult as string);

      expect(statusParsed.status).toBe('running');
      expect(statusParsed.persistent).toBe(true);
    });
  });

  describe('getTaskOutputTool', () => {
    it('should retrieve task output', async () => {
      getPersistentTaskManager(TEST_WORKSPACE);

      const startResult = await startBackgroundTaskTool.execute({
        command: 'echo "output test"',
      });

      const startParsed = JSON.parse(startResult as string);
      const taskId = startParsed.taskId;

      await new Promise(resolve => setTimeout(resolve, 300));

      const outputResult = await getTaskOutputTool.execute({ taskId });
      const outputParsed = JSON.parse(outputResult as string);

      expect(outputParsed.output).toContain('output test');
    });
  });

  describe('listTasksTool', () => {
    it('should list all tasks', async () => {
      getPersistentTaskManager(TEST_WORKSPACE);

      await startBackgroundTaskTool.execute({ command: 'echo "task1"' });
      await startBackgroundTaskTool.execute({ command: 'echo "task2"' });

      const result = await listTasksTool.execute({});
      const parsed = JSON.parse(result as string);

      expect(parsed.total).toBeGreaterThanOrEqual(2);
      expect(parsed.persistent).toBe(true);
    });
  });

  describe('cleanupOldTasksTool', () => {
    it('should cleanup old tasks', async () => {
      getPersistentTaskManager(TEST_WORKSPACE);

      await startBackgroundTaskTool.execute({ command: 'echo "old"' });

      await new Promise(resolve => setTimeout(resolve, 300));

      const result = await cleanupOldTasksTool.execute({ olderThanDays: 0 });
      const parsed = JSON.parse(result as string);

      expect(parsed.count).toBeGreaterThan(0);
    });
  });
});
