import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isDangerousCommand, executeCommand, executeCommandSafe } from './shell.js';

describe('shell utilities', () => {
  describe('isDangerousCommand', () => {
    it('should detect rm -rf commands', () => {
      expect(isDangerousCommand('rm -rf /')).toBe(true);
      expect(isDangerousCommand('rm -rf ~')).toBe(true);
      expect(isDangerousCommand('rm --recursive /home')).toBe(true);
    });

    it('should detect dd commands', () => {
      expect(isDangerousCommand('dd if=/dev/zero of=/dev/sda')).toBe(true);
    });

    it('should detect mkfs commands', () => {
      expect(isDangerousCommand('mkfs.ext4 /dev/sda1')).toBe(true);
    });

    it('should detect fork bomb', () => {
      expect(isDangerousCommand(':(){ :|:& };:')).toBe(true);
    });

    it('should allow safe commands', () => {
      expect(isDangerousCommand('ls -la')).toBe(false);
      expect(isDangerousCommand('cat file.txt')).toBe(false);
      expect(isDangerousCommand('git status')).toBe(false);
      expect(isDangerousCommand('npm install')).toBe(false);
      expect(isDangerousCommand('rm file.txt')).toBe(false);
    });
  });

  describe('executeCommand', () => {
    it('should execute simple command and return result', async () => {
      const result = await executeCommand('echo "hello"');
      expect(result.stdout).toBe('hello');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
      expect(result.killed).toBe(false);
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('should capture stderr', async () => {
      const result = await executeCommand('echo "error" >&2');
      expect(result.stderr).toBe('error');
      expect(result.exitCode).toBe(0);
    });

    it('should return non-zero exit code for failed commands', async () => {
      const result = await executeCommand('exit 1');
      expect(result.exitCode).toBe(1);
    });

    it('should respect timeout', async () => {
      const result = await executeCommand('sleep 10', { timeout: 100 });
      expect(result.killed).toBe(true);
    });

    it('should respect cwd option', async () => {
      const result = await executeCommand('pwd', { cwd: '/tmp' });
      expect(result.stdout).toContain('tmp');
    });
  });

  describe('executeCommandSafe', () => {
    it('should return success for valid commands', async () => {
      const result = await executeCommandSafe('echo "test"');
      expect(result.success).toBe(true);
      expect(result.result?.stdout).toBe('test');
    });

    it('should block dangerous commands', async () => {
      const result = await executeCommandSafe('rm -rf /');
      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.error).toBe('Command blocked for safety');
    });

    it('should return success: false for failed commands', async () => {
      const result = await executeCommandSafe('exit 42');
      expect(result.success).toBe(false);
      expect(result.result?.exitCode).toBe(42);
    });
  });
});
