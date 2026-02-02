/**
 * @fileoverview Tests for tool presets.
 */

import { describe, it, expect } from 'vitest';
import {
  createToolPreset,
  toolPresets,
  getPresetToolNames,
} from '../presets/tools';

describe('Tool Presets', () => {
  describe('toolPresets constants', () => {
    it('should have none preset as empty', () => {
      expect(toolPresets.none).toEqual({});
    });

    it('should have minimal preset definition', () => {
      expect(toolPresets.minimal.description).toContain('Read-only');
      expect(toolPresets.minimal.tools).toContain('read_text_file');
      expect(toolPresets.minimal.tools).toContain('list_directory');
    });

    it('should have standard preset definition', () => {
      expect(toolPresets.standard.tools).toContain('shell');
      expect(toolPresets.standard.tools).toContain('plan');
      expect(toolPresets.standard.tools).toContain('reasoning');
    });

    it('should have full preset definition', () => {
      expect(toolPresets.full.tools).toContain('spawn_agent');
    });
  });

  describe('getPresetToolNames', () => {
    it('should return empty for none', () => {
      expect(getPresetToolNames('none')).toEqual([]);
    });

    it('should return tool names for minimal', () => {
      const names = getPresetToolNames('minimal');
      expect(names).toContain('read_text_file');
      expect(names).toContain('list_directory');
    });

    it('should return more tools for standard', () => {
      const minimal = getPresetToolNames('minimal');
      const standard = getPresetToolNames('standard');
      expect(standard.length).toBeGreaterThan(minimal.length);
    });
  });

  describe('createToolPreset', () => {
    it('should create none preset as empty object', () => {
      const tools = createToolPreset('none');
      expect(Object.keys(tools)).toHaveLength(0);
    });

    it('should create minimal preset with read-only tools', () => {
      const tools = createToolPreset('minimal', {
        workspaceRoot: '/tmp',
      });

      expect(tools.read_text_file).toBeDefined();
      expect(tools.list_directory).toBeDefined();
      expect(tools.get_file_info).toBeDefined();
      expect(tools.write_file).toBeUndefined();
    });

    it('should create standard preset with all core tools', () => {
      const tools = createToolPreset('standard', {
        workspaceRoot: '/tmp',
      });

      expect(tools.read_text_file).toBeDefined();
      expect(tools.write_file).toBeDefined();
      expect(tools.shell).toBeDefined();
      expect(tools.plan).toBeDefined();
      expect(tools.reasoning).toBeDefined();
    });

    it('should create full preset', () => {
      const tools = createToolPreset('full', {
        workspaceRoot: '/tmp',
      });

      // Full includes all standard tools
      expect(tools.shell).toBeDefined();
      expect(tools.plan).toBeDefined();
    });

    it('should include custom tools', () => {
      const customTool = { description: 'Custom', execute: () => 'ok' };
      
      const tools = createToolPreset('none', {
        customTools: { myTool: customTool },
      });

      expect(tools.myTool).toBe(customTool);
    });

    it('should throw for unknown preset', () => {
      expect(() => createToolPreset('invalid' as any)).toThrow('Unknown tool preset');
    });
  });
});
