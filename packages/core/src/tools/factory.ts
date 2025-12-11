import * as readline from 'readline/promises';
import { CodebaseRAG } from '../core/rag/types.js';

export interface ToolDependencies {
  rl?: readline.Interface;
  allowedDirectories?: string[];
  workspaceRoot?: string;
  codebaseRAG?: CodebaseRAG;
}

export type ToolSet = Record<string, any>;

export type ToolCreator = (deps: ToolDependencies) => ToolSet;

export class ToolFactory {
  private factories = new Map<string, ToolCreator>();

  register(name: string, creator: ToolCreator) {
    this.factories.set(name, creator);
  }

  createAll(deps: ToolDependencies): ToolSet {
    const allTools: ToolSet = {};
    for (const [name, creator] of this.factories.entries()) {
      try {
        const tools = creator(deps);
        Object.assign(allTools, tools);
      } catch (e) {
        // In a real app we'd use a logger, but we don't want to enforce it as a dependency here just yet
        // or we can expect logger in deps
      }
    }
    return allTools;
  }
}

export const defaultToolFactory = new ToolFactory();
