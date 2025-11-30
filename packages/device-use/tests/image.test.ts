import { describe, it, expect } from 'vitest';
import { bufferToBase64 } from '../src/utils/image.js';

describe('Image utilities', () => {
  describe('bufferToBase64', () => {
    it('should convert buffer to base64 string', async () => {
      const buffer = Buffer.from('test');
      const result = await bufferToBase64(buffer);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
