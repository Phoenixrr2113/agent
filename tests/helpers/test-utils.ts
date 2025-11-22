import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createTempDirectory(name: string): Promise<string> {
  const tempDir = path.join(__dirname, '..', 'temp', name);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

export async function cleanupTempDirectory(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
  }
}

export async function copyFixtures(targetDir: string): Promise<void> {
  const fixturesDir = path.join(__dirname, '..', 'fixtures');
  const files = await fs.readdir(fixturesDir);

  for (const file of files) {
    const sourcePath = path.join(fixturesDir, file);
    const targetPath = path.join(targetDir, file);
    const stats = await fs.stat(sourcePath);

    if (stats.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

export async function writeTestFile(dirPath: string, filename: string, content: string): Promise<string> {
  const filePath = path.join(dirPath, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

export async function readTestFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

export function generateTestCode(lines: number, pattern: string = 'const x = 1;'): string {
  return Array(lines).fill(pattern).join('\n');
}

export async function setupTestWorkspace(name: string): Promise<string> {
  const workspace = await createTempDirectory(name);
  await copyFixtures(workspace);
  return workspace;
}

export async function teardownTestWorkspace(workspace: string): Promise<void> {
  await cleanupTempDirectory(workspace);
}
