import fs from 'fs/promises';
import path from 'path';
import { StrategyRegistry, Chunk } from './strategies/index.js';

export async function scanWorkspace(
  workspaceRoot: string,
  registry: StrategyRegistry,
  log: (message: string) => void
): Promise<Chunk[]> {
  const chunks: Chunk[] = [];

  // Directories to exclude from indexing (matches common .gitignore patterns)
  const excludedDirs = new Set([
    'node_modules',
    'dist',
    '.git',
    'build',
    '.rag-cache',
    'workspace.rag-cache',
    'logs',
    '.turbo',
    'coverage',
    '.next',
    '.nuxt',
    'out',
    'tests/temp',
  ]);

  // File patterns to exclude
  const excludedFilePatterns = [
    /\.log$/,
    /\.db$/,
    /\.db-shm$/,
    /\.db-wal$/,
    /\.tsbuildinfo$/,
  ];

  const shouldExcludeFile = (filename: string): boolean => {
    return excludedFilePatterns.some(pattern => pattern.test(filename));
  };

  const scanDir = async (dir: string): Promise<void> => {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip excluded directories
        if (entry.isDirectory() && excludedDirs.has(entry.name)) {
          continue;
        }

        // Skip excluded file patterns
        if (entry.isFile() && shouldExcludeFile(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const strategy = registry.getStrategy(fullPath);
          if (strategy) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const fileChunks = await registry.chunkFile(content, fullPath);
              chunks.push(...fileChunks);
            } catch (error) {
              log(`Failed to chunk file ${fullPath}: ${error}`);
            }
          }
        }
      }
    } catch (error) {
       log(`Error scanning directory ${dir}: ${error}`);
    }
  };

  await scanDir(workspaceRoot);
  return chunks;
}
