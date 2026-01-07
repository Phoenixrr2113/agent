import { executeCommand } from '../utils/shell.js';

export async function runTypeCheck(): Promise<{ passed: boolean; details: string }> {
  const result = await executeCommand('pnpm exec tsc --noEmit', {
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.exitCode === 0) {
    const output = result.stdout || result.stderr || '';
    return { passed: true, details: output ? output.substring(0, 500) : 'No type errors found' };
  }
  const errorOutput = result.stderr || result.stdout || result.error || '';
  return { passed: false, details: errorOutput.substring(0, 1000) };
}

export async function runTestCommand(): Promise<{ passed: boolean; details: string }> {
  const result = await executeCommand('pnpm test', {
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.exitCode === 0) {
    const output = result.stdout || result.stderr || '';
    const testSummary = output.split('\n').slice(-10).join('\n');
    return { passed: true, details: testSummary || 'All tests passed' };
  }
  const errorOutput = result.stderr ?? result.stdout ?? result.error ?? '';
  return { passed: false, details: errorOutput.substring(0, 1000) };
}
