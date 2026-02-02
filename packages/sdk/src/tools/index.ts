/**
 * @agent/sdk - Tools Module
 *
 * Central export for tool factory, provider, and utilities.
 */

// Factory
export {
  ToolFactory,
  defaultToolFactory,
  mergeToolSets,
  filterTools,
  excludeTools,
  getToolNames,
  type ToolDependencies,
  type ToolSet,
  type ToolCreator,
} from './factory';

// Provider
export {
  createAllTools,
  createToolActivationManager,
  createToolRegistry,
  instrumentTools,
  CORE_TOOL_NAMES,
  type CoreToolName,
  type ToolProviderConfig,
  type ToolProviderResult,
  type ToolActivationManager,
  type ToolRegistry,
  type ToolRegistryEntry,
} from './provider';
