import { describe, it, expect } from 'vitest';
import { shellTool } from './shell.js';

describe('Shell Tool Security', () => {
  it('should block interactive commands like vi', async () => {
    const resultString = await shellTool.execute({ command: 'vi test.txt' });
    const result = JSON.parse(resultString as string);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Interactive command');
    expect(result.error).toContain('not supported');
  });

  it('should block interactive commands like nano', async () => {
    const resultString = await shellTool.execute({ command: 'nano test.txt' });
    const result = JSON.parse(resultString as string);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Interactive command');
    expect(result.error).toContain('not supported');
  });

  it('should allow non-interactive commands', async () => {
    // We mock executeCommand or checking if it actually runs. 
    // Since we don't want to actually run commands in unit tests if possible, 
    // but the shell tool imports executeCommand from ./utils/shell.js. 
    // For this specific test, we might technically be running `ls`, which is fine.
    const resultString = await shellTool.execute({ command: 'echo "hello"' });
    const result = JSON.parse(resultString as string);
    
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('hello');
  });
});
