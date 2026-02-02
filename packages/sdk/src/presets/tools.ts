/**
 * @fileoverview Tool presets for different agent configurations.
 * Provides none, minimal, standard, and full tool sets.
 */

import type { StreamWriter } from '../types/lifecycle';
import { createFilesystemTools } from '../tools/filesystem';
import { createShellTool } from '../tools/shell';
import { createPlanTool, type PlanToolConfig } from '../tools/plan';
import { createReasoningTool } from '../tools/reasoning';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type ToolPresetLevel = 'none' | 'minimal' | 'standard' | 'full';

export interface ToolPresetContext {
  workspaceRoot: string;
  writer?: StreamWriter;
  enableStreaming?: boolean;
}

export interface ToolPresetOptions {
  /** Override default workspace root */
  workspaceRoot?: string;
  /** Stream writer for transient data */
  writer?: StreamWriter;
  /** Enable transient streaming (default: true) */
  enableStreaming?: boolean;
  /** Plan tool config */
  planConfig?: PlanToolConfig;
  /** Additional custom tools to include */
  customTools?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Preset Definitions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create tool presets based on the selected level.
 */
export function createToolPreset(
  preset: ToolPresetLevel,
  options: ToolPresetOptions = {}
) {
  const {
    workspaceRoot = process.cwd(),
    writer,
    enableStreaming = true,
    planConfig,
    customTools = {},
  } = options;

  const ctx: ToolPresetContext = { workspaceRoot, writer, enableStreaming };

  switch (preset) {
    case 'none':
      return { ...customTools };

    case 'minimal':
      return {
        ...createMinimalPreset(ctx),
        ...customTools,
      };

    case 'standard':
      return {
        ...createStandardPreset(ctx, planConfig),
        ...customTools,
      };

    case 'full':
      return {
        ...createFullPreset(ctx, planConfig),
        ...customTools,
      };

    default:
      throw new Error(`Unknown tool preset: ${preset}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Preset Implementations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Minimal preset: Read-only filesystem + limited shell.
 * Good for pure analysis tasks without mutations.
 */
function createMinimalPreset(ctx: ToolPresetContext) {
  const fsTools = createFilesystemTools({
    workspaceRoot: ctx.workspaceRoot,
    writer: ctx.writer,
    enableStreaming: ctx.enableStreaming,
  });

  // Return only read-only tools
  return {
    read_text_file: fsTools.read_text_file,
    list_directory: fsTools.list_directory,
    get_file_info: fsTools.get_file_info,
  };
}

/**
 * Standard preset: Full filesystem, shell, plan, reasoning.
 * Good for most development tasks.
 */
function createStandardPreset(ctx: ToolPresetContext, planConfig?: PlanToolConfig) {
  const fsTools = createFilesystemTools({
    workspaceRoot: ctx.workspaceRoot,
    writer: ctx.writer,
    enableStreaming: ctx.enableStreaming,
  });

  const shell = createShellTool({
    workspaceRoot: ctx.workspaceRoot,
    writer: ctx.writer,
    enableStreaming: ctx.enableStreaming,
  });

  const plan = createPlanTool(planConfig ?? {});

  const reasoning = createReasoningTool({
    writer: ctx.writer,
  });

  return {
    ...fsTools,
    shell,
    plan,
    reasoning,
  };
}

/**
 * Full preset: All standard tools + memory + spawn_agent.
 * Good for complex, multi-agent tasks.
 */
function createFullPreset(ctx: ToolPresetContext, planConfig?: PlanToolConfig) {
  const standardTools = createStandardPreset(ctx, planConfig);

  // Note: Memory tools and spawn_agent require additional setup
  // They're included as factory functions that need configuration
  return {
    ...standardTools,
    // Memory and spawn_agent tools will be added by the agent factory
    // when proper configuration is available
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Static Presets (for quick reference)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Static preset definitions for reference.
 * Use createToolPreset() for actual tool creation.
 */
export const toolPresets = {
  none: {} as Record<string, never>,

  minimal: {
    description: 'Read-only filesystem access',
    tools: ['read_text_file', 'list_directory', 'get_file_info'],
  },

  standard: {
    description: 'Full filesystem, shell, plan, reasoning',
    tools: [
      'read_text_file', 'write_file', 'list_directory', 'create_directory', 'get_file_info',
      'shell', 'plan', 'reasoning',
    ],
  },

  full: {
    description: 'All standard tools plus memory and sub-agent spawning',
    tools: [
      'read_text_file', 'write_file', 'list_directory', 'create_directory', 'get_file_info',
      'shell', 'plan', 'reasoning', 'memory_store', 'memory_recall', 'spawn_agent',
    ],
  },
} as const;

/**
 * Get tool names included in a preset.
 */
export function getPresetToolNames(preset: ToolPresetLevel): string[] {
  if (preset === 'none') return [];
  const presetDef = toolPresets[preset];
  return 'tools' in presetDef ? [...presetDef.tools] : [];
}
