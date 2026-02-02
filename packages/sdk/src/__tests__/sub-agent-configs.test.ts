/**
 * @agent/sdk - Sub-Agent Configs Tests
 */

import { describe, it, expect } from 'vitest';
import { 
  subAgentConfigs, 
  getSubAgentConfig, 
  subAgentRoles,
  type SubAgentRole,
} from '../presets/sub-agent-configs';

describe('subAgentRoles', () => {
  it('should export role constants', () => {
    expect(subAgentRoles).toBeDefined();
    expect(Array.isArray(subAgentRoles)).toBe(true);
  });

  it('should include all expected roles', () => {
    expect(subAgentRoles).toContain('coder');
    expect(subAgentRoles).toContain('researcher');
    expect(subAgentRoles).toContain('analyst');
    expect(subAgentRoles).toContain('generic');
  });

  it('should have exactly 4 roles', () => {
    expect(subAgentRoles.length).toBe(4);
  });
});

describe('subAgentConfigs', () => {
  it('should export configs object', () => {
    expect(subAgentConfigs).toBeDefined();
    expect(typeof subAgentConfigs).toBe('object');
  });

  it('should have config for each role', () => {
    for (const role of subAgentRoles) {
      expect(subAgentConfigs[role]).toBeDefined();
    }
  });

  describe('coder config', () => {
    it('should have instructions', () => {
      expect(subAgentConfigs.coder.instructions).toBeDefined();
      expect(subAgentConfigs.coder.instructions).toContain('code');
    });

    it('should include filesystem and shell tools', () => {
      expect(subAgentConfigs.coder.tools).toContain('filesystem');
      expect(subAgentConfigs.coder.tools).toContain('shell');
    });

    it('should specify a model', () => {
      expect(subAgentConfigs.coder.model).toBeDefined();
      expect(typeof subAgentConfigs.coder.model).toBe('string');
    });
  });

  describe('researcher config', () => {
    it('should have instructions about research', () => {
      expect(subAgentConfigs.researcher.instructions).toBeDefined();
      expect(subAgentConfigs.researcher.instructions?.toLowerCase()).toContain('research');
    });

    it('should include web tool', () => {
      expect(subAgentConfigs.researcher.tools).toContain('web');
    });
  });

  describe('analyst config', () => {
    it('should have instructions about analysis', () => {
      expect(subAgentConfigs.analyst.instructions).toBeDefined();
      expect(subAgentConfigs.analyst.instructions?.toLowerCase()).toContain('analy');
    });

    it('should include reasoning tool', () => {
      expect(subAgentConfigs.analyst.tools).toContain('reasoning');
    });
  });

  describe('generic config', () => {
    it('should have instructions', () => {
      expect(subAgentConfigs.generic.instructions).toBeDefined();
    });

    it('should have broad toolset', () => {
      expect(subAgentConfigs.generic.tools?.length).toBeGreaterThan(2);
    });
  });
});

describe('getSubAgentConfig', () => {
  it('should return config for valid role', () => {
    const config = getSubAgentConfig('coder');
    expect(config).toBe(subAgentConfigs.coder);
  });

  it('should return generic config for unknown role', () => {
    const config = getSubAgentConfig('unknown-role');
    expect(config).toBe(subAgentConfigs.generic);
  });

  it('should return same object for same role', () => {
    const config1 = getSubAgentConfig('researcher');
    const config2 = getSubAgentConfig('researcher');
    expect(config1).toBe(config2);
  });
});
