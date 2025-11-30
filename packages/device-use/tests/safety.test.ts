import { describe, it, expect, beforeEach } from 'vitest';
import { SafetyValidator } from '../src/utils/safety.js';
import { DeviceUseConfig } from '../src/types.js';

describe('SafetyValidator', () => {
  let validator: SafetyValidator;
  let config: DeviceUseConfig;

  beforeEach(() => {
    config = {
      displayWidth: 1920,
      displayHeight: 1080,
      safeMode: true,
      maxActionsPerMinute: 5,
      requireConfirmation: ['key'],
    };
    validator = new SafetyValidator(config);
  });

  describe('validateAction', () => {
    it('should allow normal actions', () => {
      const result = validator.validateAction('screenshot');
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block actions requiring confirmation', () => {
      const result = validator.validateAction('key');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Action requires user confirmation');
    });

    it('should enforce rate limiting', () => {
      for (let i = 0; i < 5; i++) {
        const result = validator.validateAction('screenshot');
        expect(result.valid).toBe(true);
        validator.recordAction('screenshot');
      }

      const result = validator.validateAction('screenshot');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Rate limit exceeded');
    });
  });

  describe('validateCoordinate', () => {
    it('should allow valid coordinates', () => {
      const result = validator.validateCoordinate([100, 100]);
      expect(result.valid).toBe(true);
    });

    it('should allow undefined coordinates', () => {
      const result = validator.validateCoordinate(undefined);
      expect(result.valid).toBe(true);
    });

    it('should reject coordinates out of bounds (x too large)', () => {
      const result = validator.validateCoordinate([2000, 100]);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('out of bounds');
    });

    it('should reject coordinates out of bounds (y too large)', () => {
      const result = validator.validateCoordinate([100, 1500]);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('out of bounds');
    });

    it('should reject negative coordinates', () => {
      const result = validator.validateCoordinate([-10, 100]);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('out of bounds');
    });
  });

  describe('recordAction', () => {
    it('should record actions for rate limiting', () => {
      validator.recordAction('screenshot');
      validator.recordAction('mouse_move');
      validator.recordAction('left_click');

      for (let i = 0; i < 2; i++) {
        const result = validator.validateAction('screenshot');
        expect(result.valid).toBe(true);
        validator.recordAction('screenshot');
      }

      const result = validator.validateAction('screenshot');
      expect(result.valid).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return the configuration', () => {
      const returnedConfig = validator.getConfig();
      expect(returnedConfig.displayWidth).toBe(1920);
      expect(returnedConfig.displayHeight).toBe(1080);
      expect(returnedConfig.safeMode).toBe(true);
      expect(returnedConfig.maxActionsPerMinute).toBe(5);
    });

    it('should auto-detect platform if not provided', () => {
      const configWithoutPlatform: DeviceUseConfig = {
        displayWidth: 1920,
        displayHeight: 1080,
      };
      const validatorWithoutPlatform = new SafetyValidator(configWithoutPlatform);
      const returnedConfig = validatorWithoutPlatform.getConfig();
      expect(returnedConfig.platform).toBeDefined();
      expect(['macos', 'linux', 'windows']).toContain(returnedConfig.platform);
    });
  });
});
