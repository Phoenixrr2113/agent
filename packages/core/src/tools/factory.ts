
import { logger } from '@agent/shared';

import { type CodebaseRAG } from '../core/rag/types.js';

import type * as readline from 'node:readline/promises';

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
      } catch (error) {
        logger.error(`Failed to create tool set "${name}"`, {
          error: String(error),
          toolSet: name,
        });
      }
    }
    return allTools;
  }
}

export const defaultToolFactory = new ToolFactory();
