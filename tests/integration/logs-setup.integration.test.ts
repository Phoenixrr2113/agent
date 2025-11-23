import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

describe('Logs directory setup', () => {
  const logsDir = path.join(process.cwd(), 'logs');
  const testLogFile = path.join(logsDir, 'test.log');

  afterEach(async () => {
    try {
      await fs.rm(testLogFile, { force: true });
    } catch {
    }
  });

  it('should create logs directory if it does not exist', async () => {
    await fs.mkdir(logsDir, { recursive: true });

    const stats = await fs.stat(logsDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should allow writing to logs directory', async () => {
    await fs.mkdir(logsDir, { recursive: true });

    await fs.writeFile(testLogFile, 'test log entry\n');

    const content = await fs.readFile(testLogFile, 'utf-8');
    expect(content).toBe('test log entry\n');
  });

  it('should allow appending to log files', async () => {
    await fs.mkdir(logsDir, { recursive: true });

    await fs.writeFile(testLogFile, 'first entry\n');
    await fs.appendFile(testLogFile, 'second entry\n');

    const content = await fs.readFile(testLogFile, 'utf-8');
    expect(content).toBe('first entry\nsecond entry\n');
  });
});
