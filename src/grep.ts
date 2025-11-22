import fs from 'fs/promises';
import path from 'path';

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

export async function grepWorkspace(
  pattern: string,
  workspaceRoot: string,
  options?: {
    filePattern?: string;
    ignoreCase?: boolean;
    maxResults?: number;
  }
): Promise<GrepMatch[]> {
  const matches: GrepMatch[] = [];
  const {
    filePattern,
    ignoreCase = false,
    maxResults = 100,
  } = options || {};

  const regex = new RegExp(pattern, ignoreCase ? 'gi' : 'g');
  const fileRegex = filePattern ? new RegExp(filePattern) : null;

  const scanDirectory = async (dir: string): Promise<void> => {
    if (matches.length >= maxResults) {
      return;
    }

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (matches.length >= maxResults) {
          break;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          if (fileRegex && !fileRegex.test(entry.name)) {
            continue;
          }

          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
              if (regex.test(lines[i])) {
                matches.push({
                  file: fullPath,
                  line: i + 1,
                  content: lines[i],
                });
              }
            }
          } catch (error) {
            continue;
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error);
    }
  };

  await scanDirectory(workspaceRoot);
  return matches;
}
