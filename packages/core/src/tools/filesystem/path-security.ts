import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

let allowedDirectories: string[] = [];

export function setAllowedDirectories(directories: string[]): void {
  allowedDirectories = directories.map(dir => path.resolve(expandHome(normalizePath(dir))));
}

export function getAllowedDirectories(): string[] {
  return [...allowedDirectories];
}

export function expandHome(filepath: string): string {
  if (filepath.startsWith('~')) {
    return filepath.replace('~', os.homedir());
  }
  return filepath;
}

export function normalizePath(p: string): string {
  let cleaned = p.normalize('NFC').trim().replaceAll(/^["']|["']$/g, '');

  if (cleaned.startsWith('/mnt/')) {
    return cleaned;
  }

  if (process.platform === 'win32') {
    if (/^\/[a-zA-Z]\//.test(cleaned)) {
      cleaned = cleaned[1] + ':' + cleaned.slice(2);
    }

    if (cleaned.startsWith("\\\\")) {
      cleaned = cleaned.replace(/^\\+/, '\\\\');
    }

    if (/^[a-z]:/.test(cleaned)) {
    if (cleaned && cleaned.length > 0 && typeof cleaned[0] === 'string') {
      cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
    }
    }

    return cleaned.replaceAll('/', '\\');
  }

  return cleaned;
}

export function isPathWithinAllowedDirectories(targetPath: string): boolean {
  if (typeof targetPath !== 'string' || !targetPath) {
    throw new Error('Path must be a non-empty string');
  }

  if (!Array.isArray(allowedDirectories) || allowedDirectories.length === 0) {
    throw new Error('No allowed directories configured');
  }

  if (targetPath.includes('\x00')) {
    throw new Error('Path contains null bytes');
  }

  // Windows ADS check (Issue 55)
  if (process.platform === 'win32' && targetPath.includes('::$')) {
    throw new Error('Path contains Windows Alternate Data Stream pattern');
  }

  for (const dir of allowedDirectories) {
    if (dir.includes('\x00')) {
      throw new Error('Allowed directory contains null bytes');
    }
  }

  let normalizedPath: string;
  try {
    normalizedPath = path.normalize(path.resolve(targetPath));
  } catch {
    throw new Error(`Failed to normalize path: ${targetPath}`);
  }

  if (!path.isAbsolute(normalizedPath)) {
    throw new Error(`Path is not absolute after normalization: ${targetPath}`);
  }

  // Case sensitivity check (Issue 56)
  const isCaseInsensitive = process.platform === 'win32' || process.platform === 'darwin';

  for (const allowedDir of allowedDirectories) {
    let normalizedAllowedDir: string;
    try {
      normalizedAllowedDir = path.normalize(path.resolve(allowedDir));
    } catch {
      continue;
    }

    let pPath = normalizedPath;
    let aDir = normalizedAllowedDir;

    if (isCaseInsensitive) {
      pPath = pPath.toLowerCase();
      aDir = aDir.toLowerCase();
    }

    if (pPath === aDir) {
      return true;
    }

    if (aDir === path.sep) {
      return true;
    }

    if (process.platform === 'win32' && /^[A-Z]:\\?$/.test(normalizedAllowedDir)) {
      const pathDrive = normalizedPath.substring(0, 2).toLowerCase();
      const allowedDrive = normalizedAllowedDir.substring(0, 2).toLowerCase();
      if (pathDrive === allowedDrive) {
        return true;
      }
    }

    const separator = isCaseInsensitive
      ? (aDir.endsWith(path.sep) ? '' : path.sep)
      : (normalizedAllowedDir.endsWith(path.sep) ? '' : path.sep);

    // For case-insensitive logic, we used lowercase aDir. So use proper separator check.
    // Actually simpler:
    const separator_ = path.sep;
    const suffix = aDir.endsWith(separator_) ? '' : separator_;
    if (pPath.startsWith(aDir + suffix)) {
      return true;
    }
  }

  return false;
}

export async function validatePath(targetPath: string): Promise<string> {
  const expandedPath = expandHome(normalizePath(targetPath));
  const resolvedPath = path.resolve(expandedPath);

  let realPath: string;
  try {
    realPath = await fs.realpath(resolvedPath);
  } catch {
    realPath = resolvedPath;
  }

  if (!isPathWithinAllowedDirectories(realPath)) {
    throw new Error(
      `Access denied: ${targetPath} is outside allowed directories (${allowedDirectories.join(', ')})`
    );
  }

  return realPath;
}

export async function validateNewPath(targetPath: string): Promise<string> {
  const expandedPath = expandHome(normalizePath(targetPath));
  const resolvedPath = path.resolve(expandedPath);

  if (!isPathWithinAllowedDirectories(resolvedPath)) {
    throw new Error(
      `Access denied: ${targetPath} is outside allowed directories`
    );
  }

  let currentPath = resolvedPath;
  let existingParent: string | null = null;

  while (currentPath !== path.dirname(currentPath)) {
    try {
      await fs.access(currentPath);
      existingParent = currentPath;
      break;
    } catch {
      currentPath = path.dirname(currentPath);
    }
  }

  if (existingParent) {
    try {
      const realParent = await fs.realpath(existingParent);
      if (!isPathWithinAllowedDirectories(realParent)) {
        throw new Error(
          `Access denied: parent directory is outside allowed directories`
        );
      }
    } catch {
      throw new Error(`Parent directory validation failed`);
    }
  }

  return resolvedPath;
}

export async function validateAfterOperation(targetPath: string): Promise<void> {
  try {
    const realPath = await fs.realpath(targetPath);
    if (!isPathWithinAllowedDirectories(realPath)) {
      await fs.unlink(targetPath).catch(() => {});
      throw new Error(
        `Security violation: created path resolves outside allowed directories. Path has been removed.`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Security violation')) {
      throw error;
    }
    throw new Error(`Post-operation validation failed: ${error}`);
  }
}
